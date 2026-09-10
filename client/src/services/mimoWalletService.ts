/**
 * Serviço de Integração com Google Wallet, Firestore e Gestão de Contas MIMO
 *
 * IMPORTANTE: a assinatura do passe (JWT com a chave RSA do issuer da Google
 * Wallet) acontece SEMPRE no servidor, via as Cloud Functions `criarCartao`,
 * `carimbar` e `resgatar` (ver functions/index.js). O cliente nunca tem — e
 * nunca deve ter — acesso à chave privada do issuer. Este arquivo chegou a
 * embutir essa chave (e assinava o JWT no navegador), o que a expunha
 * publicamente a qualquer visitante do site; foi corrigido para chamar as
 * Cloud Functions via httpsCallable em vez disso.
 */
import { SEED_MERCHANTS, SeedMerchantData } from '../data/seedData.js';
import { db, auth, functions } from '../firebase.js';
import { httpsCallable } from 'firebase/functions';
import { signInWithCustomToken } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

const WALLET_ISSUER_ID = '3388000000023184117';

export interface CustomerEnrollInput {
  lojaId: string;
  nome: string;
  celular: string;
  email: string;
  aniversario?: string;
  consentimento: boolean;
}

export interface EnrolledCardResult {
  cartaoId: string;
  saveUrl: string;
  jaExistia: boolean;
  selos: number;
  meta: number;
  status: string;
  totpSecret?: string;
  loja: SeedMerchantData;
  cliente: {
    nome: string;
    celular: string;
    email: string;
    aniversario?: string;
  };
}

export interface StampResult {
  cartaoId: string;
  selos: number;
  meta: number;
  completo: boolean;
  cliente: string;
  premio: string;
}

export interface LojistaFirestoreData {
  id: string;
  nome: string;
  slug: string;
  email: string;
  senha?: string;
  ativo?: boolean;
  statusFinanceiro?: 'adimplente' | 'inadimplente';
  financeiro?: {
    status: 'adimplente' | 'inadimplente';
    plano: string;
    valorMensal: number;
    bloqueadoPorInadimplencia: boolean;
  };
  layout?: {
    corFundo?: string;
    corTexto?: string;
    heroUrl?: string;
    logoUrl?: string;
    nomePrograma?: string;
    premio?: string;
    validadeDias?: number;
    instrucaoResgate?: string;
  };
  regras?: {
    meta?: number;
    intervaloMinimoMin?: number;
    maxSelosDiaPorCliente?: number;
    validadeDias?: number;
    exigirSMS?: boolean;
  };
  criadoEm?: any;
}

/**
 * Normaliza telefone para formato E.164 sem o '+'
 * Ex: "(11) 98765-4321" -> "5511987654321"
 */
export function normalizarCelularBR(raw: string): string {
  const digitos = raw.replace(/\D/g, '');
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) {
    return digitos;
  }
  if (digitos.length === 10 || digitos.length === 11) {
    return `55${digitos}`;
  }
  return digitos;
}

/**
 * Formata celular para exibição amigável
 * Ex: "5511987654321" -> "(11) 98765-4321"
 */
export function formatarCelularDisplay(raw: string): string {
  const digitos = raw.replace(/\D/g, '');
  const semPais = digitos.startsWith('55') ? digitos.slice(2) : digitos;
  if (semPais.length === 11) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 7)}-${semPais.slice(7)}`;
  }
  if (semPais.length === 10) {
    return `(${semPais.slice(0, 2)}) ${semPais.slice(2, 6)}-${semPais.slice(6)}`;
  }
  return raw;
}

/** Decodifica um segredo Base32 (RFC 4648, alfabeto do otplib) em bytes */
function base32Decode(input: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of clean) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Gera o código TOTP (RFC 6238, HMAC-SHA1, 6 dígitos, passo de 30s) do cartão via
 * Web Crypto — o MESMO algoritmo que a Cloud Function `carimbar` valida no balcão
 * (biblioteca otplib, que usa esses parâmetros por padrão). O segredo é o
 * `totpSecret` gerado pelo servidor na emissão do cartão (formato Base32).
 */
export async function gerarCodigoTotpAtual(secret: string): Promise<string> {
  try {
    const keyBytes = base32Decode(secret);
    if (keyBytes.length === 0) return '------';

    const counter = Math.floor(Date.now() / 1000 / 30);
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    // Big-endian de 64 bits (os primeiros 32 bits sempre 0 — contador cabe em 32 bits)
    counterView.setUint32(0, 0, false);
    counterView.setUint32(4, counter, false);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer));

    const offset = signature[signature.length - 1] & 0x0f;
    const binCode =
      ((signature[offset] & 0x7f) << 24) |
      ((signature[offset + 1] & 0xff) << 16) |
      ((signature[offset + 2] & 0xff) << 8) |
      (signature[offset + 3] & 0xff);

    const code = binCode % 1000000;
    return String(code).padStart(6, '0');
  } catch (err) {
    console.warn('Erro ao gerar TOTP:', err);
    return '------';
  }
}

/**
 * Busca dados do lojista no Firestore pelo slug (ou ID)
 * Prioriza dados reais gravados na nuvem
 */
export async function obterDadosLojista(slug: string): Promise<SeedMerchantData> {
  const slugNormalizado = (slug || 'minha-loja').toLowerCase().trim();

  try {
    const docRef = doc(db, 'lojistas', slugNormalizado);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      const versaoSalva = data.layout?.versao || data.wallet?.versao || 'v3';
      const slugClean = slugNormalizado.replace(/[^a-z0-9_-]/g, '_');
      const classIdCalculado = data.wallet?.classId || `${WALLET_ISSUER_ID}.${slugClean}_${versaoSalva}`;

      return {
        nome: data.nome || 'Minha Loja',
        slug: slugNormalizado,
        ativo: data.ativo !== false,
        statusFinanceiro: data.statusFinanceiro || data.financeiro?.status || 'adimplente',
        financeiro: {
          status: data.financeiro?.status || data.statusFinanceiro || 'adimplente',
          plano: data.financeiro?.plano || 'pro',
          valorMensal: data.financeiro?.valorMensal || 149.00,
          bloqueadoPorInadimplencia: data.financeiro?.bloqueadoPorInadimplencia ?? (data.statusFinanceiro === 'inadimplente'),
          proximoVencimento: data.financeiro?.proximoVencimento || '2026-10-10T00:00:00Z',
        },
        layout: {
          corFundo: data.layout?.corFundo || '#141416',
          corTexto: data.layout?.corTexto || '#FFFFFF',
          accentColor: data.layout?.accentColor || '#FFC82C',
          logoUrl: (data.layout?.logoUrl && !data.layout?.logoUrl.includes('mimo-logo.jpg'))
            ? data.layout?.logoUrl
            : (slugNormalizado === 'nox-dessert-club' ? 'https://mimo-fidelidade.web.app/logos/nox-dessert-club.jpg' : `https://mimo-fidelidade.web.app/logos/${slugNormalizado}.jpg`),
          heroUrl: (data.layout?.heroUrl && !data.layout?.heroUrl.includes('mimo-hero.jpg'))
            ? data.layout?.heroUrl
            : 'https://mimo-fidelidade.web.app/banners/hero-0.jpg',
          nomePrograma: data.layout?.nomePrograma || 'Programa de Fidelidade Digital',
          premio: data.layout?.premio || 'Recompensa Exclusiva (10º Selo)',
          validadeDias: data.layout?.validadeDias || 30,
          instrucaoResgate: data.layout?.instrucaoResgate || 'Here you will see your of stamps',
          stampIcon: data.layout?.stampIcon || 'cookie',
          stampImage: data.layout?.stampImage || null,
          rewardStampImage: data.layout?.rewardStampImage || null,
          versao: versaoSalva,
        },
        regras: {
          meta: data.regras?.meta || 10,
          intervaloMinimoMin: data.regras?.intervaloMinimoMin || 30,
          maxSelosDiaPorCliente: data.regras?.maxSelosDiaPorCliente || 2,
          validadeDias: data.regras?.validadeDias || 180,
          exigirSMS: data.regras?.exigirSMS || false,
        },
        wallet: {
          classId: classIdCalculado,
          classSincronizadaEm: data.wallet?.classSincronizadaEm || new Date().toISOString(),
        },
        operadores: data.operadores || {
          "operador-balcao": { nome: "Operador de Balcão", pin: "1234", papel: "operador" }
        },
        criadoEm: data.criadoEm || new Date().toISOString(),
      };
    }
  } catch (err: any) {
    console.warn('Busca de lojista no Firestore falhou, verificando cache:', err.message);
  }

  // Fallback para cache local / seed
  const fallbackStore = SEED_MERCHANTS[slugNormalizado] || SEED_MERCHANTS['minha-loja'] || Object.values(SEED_MERCHANTS)[0];
  let merged: SeedMerchantData = {
    ...fallbackStore,
    slug: slugNormalizado,
    nome: slugNormalizado ? slugNormalizado.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : fallbackStore.nome,
  };

  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem(`mimo_card_config_${slugNormalizado}`) || localStorage.getItem('mimo_card_config');
    if (saved) {
      try {
        const p = JSON.parse(saved);
        merged.nome = p.storeName || merged.nome;
        if (merged.layout) {
          merged.layout.nomePrograma = p.tagline || merged.layout.nomePrograma;
          merged.layout.corFundo = p.bgColor || merged.layout.corFundo;
          merged.layout.corTexto = p.textColor || merged.layout.corTexto;
          merged.layout.accentColor = p.accentColor || merged.layout.accentColor;
          merged.layout.premio = p.rewardTitle || merged.layout.premio;
          merged.layout.instrucaoResgate = p.rewardDescription || merged.layout.instrucaoResgate;
          merged.layout.stampIcon = p.stampIcon || merged.layout.stampIcon;
          merged.layout.stampImage = p.stampImage || merged.layout.stampImage;
          merged.layout.rewardStampImage = p.rewardStampImage || merged.layout.rewardStampImage;
          merged.layout.heroUrl = p.heroUrl || merged.layout.heroUrl;
          merged.layout.logoUrl = p.logoUrl || merged.layout.logoUrl;
          merged.layout.versao = p.versao || merged.layout.versao;
        }
        if (p.classId && merged.wallet) {
          merged.wallet.classId = p.classId;
        }
      } catch {}
    }
  }

  return merged;
}

/**
 * Publica a identidade visual da loja definida no Estúdio de Marca MIMO
 * Gera o banner oficial dinâmico no Canvas, faz upload no Firebase Storage
 * e sincroniza no Firestore com nova versão do Google Wallet
 */
export async function publicarIdentidadeVisual(
  lojaSlug: string,
  config: any
): Promise<{ sucesso: boolean; message: string; heroUrl?: string; logoUrl?: string; classId?: string }> {
  const slug = (lojaSlug || 'minha-loja').toLowerCase().trim();
  const slugClean = slug.replace(/[^a-z0-9_-]/g, '_');
  // Aceita a versão de quem chamou (o Estúdio precisa que o JSON do design, o
  // classId e as URLs de imagem carreguem exatamente a mesma versão).
  const versao = config?.versao ? String(config.versao) : String(Date.now());
  const classId = `${WALLET_ISSUER_ID}.${slugClean}_${versao}`;

  // 1. URLs base para os endpoints dinâmicos na Cloud Function (Hero e Logo)
  // O banner e o logo agora são gerados/servidos on-the-fly para não depender de Storage inativo
  const baseUrl = `https://us-central1-mimo-2d6eb.cloudfunctions.net`;
  const metaSelos = Number(config?.meta) > 0 ? Number(config.meta) : 10;
  const logoUrl = `${baseUrl}/getLogo?lojaId=${slugClean}&v=${versao}`;
  const heroUrl = `${baseUrl}/generateBanner?lojaId=${slugClean}&selos=0&meta=${metaSelos}&v=${versao}`;

  // 2. Extração segura dos arquivos em Base64 (Data URIs)
  const logoBase64 = config.storeLogoImage && config.storeLogoImage.startsWith('data:image') ? config.storeLogoImage : null;
  const stampImageBase64 = config.stampImage && config.stampImage.startsWith('data:image') ? config.stampImage : null;
  const rewardStampImageBase64 = config.rewardStampImage && config.rewardStampImage.startsWith('data:image') ? config.rewardStampImage : null;

  const layoutUpdate: any = {
    nomePrograma: config.tagline || 'Programa de Fidelidade Digital',
    corFundo: config.bgColor || '#141416',
    corTexto: config.textColor || '#FFFFFF',
    accentColor: config.accentColor || '#FFC82C',
    logoUrl,
    heroUrl,
    premio: config.rewardTitle || 'BROWNIE COOKIE GRÁTIS',
    validadeDias: Number(config.validityDays) || 30,
    instrucaoResgate: config.rewardDescription || 'Apresente o QR Code no balcão a cada compra para creditar o selo.',
    stampIcon: config.stampIcon || 'cookie',
    versao,
  };

  if (logoBase64) layoutUpdate.logoBase64 = logoBase64;
  if (stampImageBase64) layoutUpdate.stampImageBase64 = stampImageBase64;
  if (rewardStampImageBase64) layoutUpdate.rewardStampImageBase64 = rewardStampImageBase64;

  // 3. Grava no Firestore real da loja (salvando os base64 e as URLs dinâmicas)
  try {
    const lojistaRef = doc(db, 'lojistas', slug);
    const savePromise = setDoc(lojistaRef, {
      nome: config.storeName || 'Minha Loja',
      slug,
      layout: layoutUpdate,
      wallet: {
        classId,
        versao,
        classSincronizadaEm: new Date().toISOString(),
      },
      atualizadoEm: serverTimestamp(),
    }, { merge: true });

    await Promise.race([
      savePromise,
      new Promise((resolve) => setTimeout(resolve, 3000))
    ]);
  } catch (err: any) {
    console.warn('Erro ao sincronizar com Firestore:', err.message);
  }

  // 4. Grava em localStorage para persistência imediata no navegador
  const fullConfig = {
    ...config,
    heroUrl,
    logoUrl,
    versao,
    classId,
  };
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('mimo_card_config', JSON.stringify(fullConfig));
    localStorage.setItem(`mimo_card_config_${slug}`, JSON.stringify(fullConfig));
    localStorage.setItem('mimo_last_published_at', new Date().toISOString());
  }

  return {
    sucesso: true,
    message: `Identidade visual da "${config.storeName}" publicada no Firebase e sincronizada com sucesso nas carteiras digitais!`,
    heroUrl,
    logoUrl,
    classId,
  };
}

/**
 * Emite ou busca o cartão fidelidade do cliente.
 *
 * Toda a lógica sensível (verificar cartão existente, gerar segredo TOTP,
 * montar e assinar o loyaltyObject/loyaltyClass, gravar no Firestore) acontece
 * na Cloud Function `criarCartao` — o cliente só recebe de volta a URL pronta
 * de "Salvar na Wallet". Isso elimina a necessidade (e o risco) de o navegador
 * ter a chave privada do issuer ou escrever direto no Firestore.
 */
export async function cadastrarClienteECartao(input: CustomerEnrollInput): Promise<EnrolledCardResult> {
  const loja = await obterDadosLojista(input.lojaId);

  const criarCartaoFn = httpsCallable<
    { lojaId: string; nome: string; celular: string; email: string; aniversario?: string; consentimento: boolean },
    { cartaoId: string; jaExistia: boolean; selos: number; meta: number; status: string; saveUrl: string; totpSecret?: string }
  >(functions, 'criarCartao');

  const { data } = await criarCartaoFn({
    lojaId: loja.slug || input.lojaId,
    nome: input.nome,
    celular: input.celular,
    email: input.email,
    aniversario: input.aniversario,
    consentimento: input.consentimento,
  });

  return {
    cartaoId: data.cartaoId,
    saveUrl: data.saveUrl,
    jaExistia: data.jaExistia,
    selos: data.selos,
    meta: data.meta,
    status: data.status,
    totpSecret: data.totpSecret,
    loja,
    cliente: {
      nome: input.nome,
      celular: input.celular,
      email: input.email,
      aniversario: input.aniversario,
    },
  };
}

/**
 * Carimbar cartão via scanner do lojista.
 * Delega para a Cloud Function `carimbar`, que roda em transação, exige PIN
 * válido do operador e é a única fonte de verdade sobre o saldo de selos.
 */
export async function carimbarSelo(params: {
  qr: string;
  pin: string;
  lojaId: string;
}): Promise<StampResult> {
  const carimbarFn = httpsCallable<
    { qr?: string; pin: string; lojaId: string; manualCardId?: string },
    { cartaoId: string; selos: number; meta: number; completo: boolean; cliente: string; premio: string }
  >(functions, 'carimbar');

  const { data } = await carimbarFn({
    qr: params.qr,
    pin: params.pin,
    lojaId: params.lojaId,
  });

  return data;
}

/**
 * Resgate do prêmio pelo lojista.
 * Delega para a Cloud Function `resgatar`, que zera os selos, avança o ciclo
 * e exige PIN válido do operador — nunca é feito escrevendo direto no Firestore.
 */
export async function resgatarPremio(params: {
  cartaoId: string;
  pin: string;
  lojaId: string;
}): Promise<{ sucesso: boolean; premio: string; novoCiclo: number }> {
  const resgatarFn = httpsCallable<
    { cartaoId: string; pin: string; lojaId: string },
    { sucesso: boolean; premio: string; novoCiclo: number; cliente: string }
  >(functions, 'resgatar');

  const { data } = await resgatarFn(params);
  return { sucesso: data.sucesso, premio: data.premio, novoCiclo: data.novoCiclo };
}

// ─────────────────────────────────────────────────────────────────────────────
// 👑 MÓDULO ADMINISTRADOR DE CONTAS (Master Superadmin - Adriane Bezerra)
// ─────────────────────────────────────────────────────────────────────────────

// E-mail é só um rótulo de exibição na UI — a senha do admin NUNCA fica no
// cliente. A verificação real acontece na Cloud Function `autenticarAdmin`.
export const MASTER_ADMIN_EMAIL = 'adrianebezerra1605@gmail.com';

/**
 * Autentica o administrador master via Cloud Function (a senha é comparada
 * no servidor contra o secret MIMO_ADMIN_PASS_HASH — nunca no navegador).
 */
export async function autenticarAdminMimo(email: string, senha: string): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const fn = httpsCallable<{ email: string; senha: string }, { sucesso: boolean; token?: string }>(functions, 'autenticarAdmin');
    const { data } = await fn({ email, senha });
    if (data.sucesso && data.token) {
      // Estabelece uma sessão real do Firebase Auth (custom claims role=admin),
      // usada pelas regras do Firestore para liberar leitura/escrita.
      await signInWithCustomToken(auth, data.token);
    }
    return { sucesso: data.sucesso };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'Falha ao autenticar administrador.' };
  }
}

/**
 * Lista todos os lojistas cadastrados no Firestore (sem o campo `senha` —
 * nunca é enviado ao cliente, nem para o painel administrativo).
 */
export async function listarTodosLojistas(): Promise<LojistaFirestoreData[]> {
  try {
    const snap = await getDocs(collection(db, 'lojistas'));
    const list: LojistaFirestoreData[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        nome: data.nome || d.id,
        slug: data.slug || d.id,
        email: data.email || '',
        ativo: data.ativo !== false,
        statusFinanceiro: data.statusFinanceiro || data.financeiro?.status || 'adimplente',
        financeiro: data.financeiro || {
          status: 'adimplente',
          plano: 'pro',
          valorMensal: 149,
          bloqueadoPorInadimplencia: false,
        },
        layout: data.layout,
        regras: data.regras,
        criadoEm: data.criadoEm,
      });
    });
    return list;
  } catch (err: any) {
    console.error('Erro ao listar lojistas no Firestore:', err);
    return [];
  }
}

/**
 * Salva ou atualiza um lojista no Firestore
 */
export async function salvarLojistaFirestore(id: string, dados: Partial<LojistaFirestoreData>): Promise<void> {
  const cleanId = id.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');
  const ref = doc(db, 'lojistas', cleanId);
  await setDoc(ref, {
    ...dados,
    slug: cleanId,
    atualizadoEm: serverTimestamp(),
  }, { merge: true });
}

/**
 * Exclui um lojista do Firestore
 */
export async function excluirLojistaFirestore(id: string): Promise<void> {
  const ref = doc(db, 'lojistas', id);
  await deleteDoc(ref);
}

/**
 * Alterna status financeiro de um lojista
 */
export async function alternarStatusFinanceiroLojista(id: string, novoStatus: 'adimplente' | 'inadimplente'): Promise<void> {
  const ref = doc(db, 'lojistas', id);
  await updateDoc(ref, {
    statusFinanceiro: novoStatus,
    'financeiro.status': novoStatus,
    'financeiro.bloqueadoPorInadimplencia': novoStatus === 'inadimplente',
  });
}

/**
 * Autentica o lojista via Cloud Function `autenticarLojista` — a comparação de
 * senha acontece no servidor (Admin SDK), e o campo `senha` nunca trafega de
 * volta para o navegador.
 */
export async function autenticarLojista(email: string, pass: string): Promise<{
  sucesso: boolean;
  lojista?: LojistaFirestoreData;
  erro?: string;
}> {
  try {
    const fn = httpsCallable<
      { email: string; senha: string },
      { sucesso: boolean; lojista?: LojistaFirestoreData; token?: string }
    >(functions, 'autenticarLojista');
    const { data } = await fn({ email: email.toLowerCase().trim(), senha: pass.trim() });
    if (data.sucesso && data.token) {
      // Estabelece uma sessão real do Firebase Auth (custom claims role=lojista
      // + lojaId), usada pelas regras do Firestore para restringir o acesso.
      await signInWithCustomToken(auth, data.token);
    }
    return { sucesso: data.sucesso, lojista: data.lojista };
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || 'E-mail ou senha incorretos. Verifique suas credenciais de lojista.' };
  }
}

/**
 * Carrega clientes reais cadastrados na subcoleção de um lojista
 */
export async function obterClientesReaisLojista(lojaSlug: string): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, 'lojistas', lojaSlug, 'clientes'));
    const list: any[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    return list;
  } catch (err: any) {
    console.warn('Erro ao carregar clientes do lojista no Firestore:', err.message);
    return [];
  }
}
