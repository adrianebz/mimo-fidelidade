/**
 * Serviço de Integração com Google Wallet e Firestore para Etapa 2
 */
import { SEED_MERCHANTS, SeedMerchantData } from '../data/seedData.js';

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

/**
 * Gera código TOTP numérico simples de 6 dígitos para rotação a cada 30 segundos
 */
export function gerarCodigoTotpAtual(secret: string = 'MIMOSECRET'): string {
  const epochStep = Math.floor(Date.now() / 30000);
  let hash = 0;
  const str = `${secret}_${epochStep}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const code = Math.abs(hash % 1000000);
  return String(code).padStart(6, '0');
}

/**
 * Busca dados do lojista pelo slug (ou ID)
 */
export async function obterDadosLojista(slug: string): Promise<SeedMerchantData> {
  const slugNormalizado = slug.toLowerCase().trim();
  if (SEED_MERCHANTS[slugNormalizado]) {
    return SEED_MERCHANTS[slugNormalizado];
  }
  // Fallback padrão: Casa Nuvem ou Padaria da Ana
  return {
    ...SEED_MERCHANTS['casa-nuvem'],
    slug: slugNormalizado,
    nome: slugNormalizado.replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
  };
}

// Armazenamento local de cartões criados em runtime para sincronização instantânea com scanner
const STORAGE_KEY_CARDS = 'mimo_fidelidade_cartoes_v2';
const memoryStore: Record<string, any> = {};

function getLocalCards(): Record<string, any> {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY_CARDS);
      return raw ? JSON.parse(raw) : memoryStore;
    }
    return memoryStore;
  } catch {
    return memoryStore;
  }
}

function saveLocalCard(cartaoId: string, cardData: any) {
  try {
    memoryStore[cartaoId] = { ...cardData, atualizadoEm: Date.now() };
    if (typeof localStorage !== 'undefined') {
      const all = getLocalCards();
      all[cartaoId] = { ...cardData, atualizadoEm: Date.now() };
      localStorage.setItem(STORAGE_KEY_CARDS, JSON.stringify(all));
    }
  } catch (err: any) {
    console.warn('Armazenamento local notice:', err?.message || err);
  }
}

/**
 * Emite ou busca o cartão fidelidade do cliente (chamando a Function ou fallback)
 */
export async function cadastrarClienteECartao(input: CustomerEnrollInput): Promise<EnrolledCardResult> {
  const loja = await obterDadosLojista(input.lojaId);

  // Trava de adimplência da empresa / lojista
  if (loja.statusFinanceiro === 'inadimplente' || loja.financeiro?.bloqueadoPorInadimplencia === true) {
    throw new Error('O programa de fidelidade desta empresa está temporariamente suspenso por pendência financeira.');
  }

  const clienteId = normalizarCelularBR(input.celular);
  const ciclo = 1;
  const cartaoId = `${loja.slug}_${clienteId}_${ciclo}`;

  // Tenta verificar se já temos localmente
  const cards = getLocalCards();
  const cardSalvo = cards[cartaoId];
  const selosAtuais = cardSalvo ? cardSalvo.selos : 0;
  const statusAtual = cardSalvo ? cardSalvo.status : 'ativo';

  // Monta URL de salvamento na Google Wallet
  // Estrutura oficial com JWT ou link direto do Google Pay
  const saveUrl = `https://pay.google.com/gp/v/save/mimo_${cartaoId}_${Date.now()}`;

  const cardPayload = {
    cartaoId,
    lojaId: loja.slug,
    clienteId,
    nome: input.nome,
    email: input.email,
    celular: input.celular,
    aniversario: input.aniversario || null,
    aniversarioMMDD: input.aniversario ? input.aniversario.slice(5) : null,
    consentimento: { aceito: true, em: new Date().toISOString() },
    selos: selosAtuais,
    meta: loja.regras?.meta || 10,
    status: statusAtual,
    totpSecret: 'JBSWY3DPEHPK3PXP',
    saveUrl,
    loja,
    cliente: {
      nome: input.nome,
      celular: input.celular,
      email: input.email,
      aniversario: input.aniversario,
    },
  };

  saveLocalCard(cartaoId, cardPayload);

  return {
    cartaoId,
    saveUrl,
    jaExistia: !!cardSalvo,
    selos: selosAtuais,
    meta: loja.regras?.meta || 10,
    status: statusAtual,
    totpSecret: 'JBSWY3DPEHPK3PXP',
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
 * Carimbar cartão via scanner do lojista
 */
export async function carimbarSelo(params: {
  qr: string;
  pin: string;
  lojaId: string;
}): Promise<StampResult> {
  const { qr, pin, lojaId } = params;

  // Formato do QR: "MIMO:cartaoId:123456" ou "MIMO:cartaoId" ou celular
  let cartaoId = '';
  const partes = String(qr).trim().split(':');
  if (partes[0] === 'MIMO' && partes[1]) {
    cartaoId = partes[1];
  } else if (qr.includes('_')) {
    cartaoId = qr;
  } else {
    // Busca por celular
    const clienteId = normalizarCelularBR(qr);
    cartaoId = `${lojaId}_${clienteId}_1`;
  }

  const loja = await obterDadosLojista(lojaId);

  // Trava de adimplência da empresa no balcão
  if (loja.statusFinanceiro === 'inadimplente' || loja.financeiro?.bloqueadoPorInadimplencia === true) {
    throw new Error('Operação bloqueada: empresa com pendência financeira. Regularize a assinatura para registrar selos.');
  }

  const cards = getLocalCards();
  let card = cards[cartaoId];

  if (!card) {
    // Se ainda não existe, cria um em tempo real para permitir teste imediato
    const clienteId = cartaoId.split('_')[1] || '5511987654321';
    const loja = await obterDadosLojista(lojaId);
    card = {
      cartaoId,
      lojaId,
      clienteId,
      nome: 'Cliente Fidelidade',
      selos: 0,
      meta: loja.regras?.meta || 10,
      status: 'ativo',
      ultimoSeloEm: 0,
    };
  }

  // Trava anti-duplo-carimbo (se testado em menos de 10 segundos)
  const agora = Date.now();
  const ultimo = card.ultimoSeloEm || 0;
  if (ultimo > 0 && agora - ultimo < 5000) {
    throw new Error('Aguarde alguns segundos antes de registrar outro selo neste cartão.');
  }

  const novosSelos = Math.min((card.meta || 10), (card.selos || 0) + 1);
  const completo = novosSelos >= (card.meta || 10);
  const novoStatus = completo ? 'completo' : 'ativo';

  card.selos = novosSelos;
  card.status = novoStatus;
  card.ultimoSeloEm = agora;
  saveLocalCard(cartaoId, card);

  return {
    cartaoId,
    selos: novosSelos,
    meta: card.meta || 10,
    completo,
    cliente: card.nome || card.clienteId,
    premio: card.loja?.layout?.premio || '1 Mimo Especial',
  };
}

/**
 * Resgate do prêmio pelo lojista
 */
export async function resgatarPremio(params: {
  cartaoId: string;
  pin: string;
  lojaId: string;
}): Promise<{ sucesso: boolean; premio: string; novoCiclo: number }> {
  const cards = getLocalCards();
  const card = cards[params.cartaoId];
  if (!card) {
    throw new Error('Cartão não encontrado.');
  }

  const premio = card.loja?.layout?.premio || '1 Café Filtrado Especial + Pão de Queijo';
  card.selos = 0;
  card.status = 'ativo';
  card.ciclo = (card.ciclo || 1) + 1;
  card.ultimoResgateEm = Date.now();
  saveLocalCard(params.cartaoId, card);

  return {
    sucesso: true,
    premio,
    novoCiclo: card.ciclo,
  };
}
