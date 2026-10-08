/**
 * Apple Wallet (iOS) — geração do .pkpass, Web Service de registro de
 * dispositivos e push via APNs.
 *
 * Fluxo:
 *  1. criarCartao devolve `applePassUrl` → GET /appleWallet/pass/{cartaoId}?t=TOKEN
 *     O Safari do iPhone abre o .pkpass e oferece "Adicionar" à Carteira.
 *  2. Ao adicionar, o iOS chama POST /v1/devices/{device}/registrations/{passType}/{serial}
 *     com o pushToken do aparelho — gravamos em `appleWalletRegistrations`.
 *  3. Quando um selo é carimbado, o trigger atualizarPasse chama
 *     notificarDispositivosApple(): push vazio via APNs (HTTP/2) para cada aparelho.
 *  4. O iOS então consulta GET /v1/devices/.../registrations/{passType}?passesUpdatedSince=
 *     e baixa a versão nova em GET /v1/passes/{passType}/{serial}.
 *
 * Certificados (Firebase Secrets, nunca versionados):
 *  - APPLE_PASS_CERT : certificado Pass Type ID (PEM)
 *  - APPLE_PASS_KEY  : chave privada do certificado (PEM)
 *  - APPLE_WWDR_CERT : Apple WWDR G4 (PEM)
 * O mesmo certificado do Pass Type ID autentica no APNs (topic = passTypeIdentifier).
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http2 = require('http2');
const admin = require('firebase-admin');
const { bitmapToPngBuffer, loadBase64Image } = require('./banner');
const { renderFaixaApple, renderLogoApple } = require('./passe-apple-imagens');
const { montarCamposDoPasse } = require('./pass-fields');

const APPLE_PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID || 'pass.com.boomii.fidelidade';
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || 'RSZW7A8BKJ';
const APPLE_SECRETS = ['APPLE_PASS_CERT', 'APPLE_PASS_KEY', 'APPLE_WWDR_CERT'];
const REG_COLLECTION = 'appleWalletRegistrations';
const APNS_HOST = 'https://api.push.apple.com';

const FN_BASE = () =>
  `https://us-central1-${process.env.GCLOUD_PROJECT || 'mimo-2d6eb'}.cloudfunctions.net`;
const WEB_SERVICE_URL = () => `${FN_BASE()}/appleWallet`;

/** Secrets podem chegar com "\n" literal quando colados no terminal, ou arquivo local como fallback */
function lerPem(nome) {
  const v = process.env[nome];
  if (v) {
    return v.includes('-----BEGIN') ? v.replace(/\\n/g, '\n') : Buffer.from(v, 'base64').toString('utf8');
  }
  const arqs = {
    APPLE_PASS_CERT: 'pass.pem',
    APPLE_PASS_KEY: 'pass.key',
    APPLE_WWDR_CERT: 'wwdr.pem',
  };
  const nomeArq = arqs[nome];
  if (nomeArq) {
    const parentPath = path.join(__dirname, '..', nomeArq);
    if (fs.existsSync(parentPath)) return fs.readFileSync(parentPath, 'utf8');
    const localPath = path.join(__dirname, nomeArq);
    if (fs.existsSync(localPath)) return fs.readFileSync(localPath, 'utf8');
  }
  throw new Error(`Secret ou certificado ${nome} não configurado.`);
}

function certificados() {
  return {
    signerCert: lerPem('APPLE_PASS_CERT'),
    signerKey: lerPem('APPLE_PASS_KEY'),
    wwdr: lerPem('APPLE_WWDR_CERT'),
  };
}

/** Token que o iOS envia em "Authorization: ApplePass <token>" (mín. 16 chars). */
function novoAuthToken() {
  return crypto.randomBytes(24).toString('hex');
}

/** Garante que o cartão tenha authToken da Apple; grava se ainda não tiver. */
async function garantirAuthToken(cartaoRef, cartaoData) {
  if (cartaoData?.apple?.authToken) return cartaoData.apple.authToken;
  const token = novoAuthToken();
  await cartaoRef.set({ apple: { authToken: token } }, { merge: true });
  return token;
}

function urlDownloadPasse(cartaoId, token) {
  return `${WEB_SERVICE_URL()}/pass/${encodeURIComponent(cartaoId)}?t=${token}`;
}

function tokensIguais(a, b) {
  if (!a || !b) return false;
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function hexParaRgb(hex, fallback) {
  const clean = String(hex || '').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return fallback;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function calcularLuminancia(hex) {
  const clean = String(hex || '').replace('#', '').trim();
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return 0;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function garantirContraste(corTexto, corFundo, padraoEscuro = '#FFFFFF', padraoClaro = '#141416') {
  const lumFundo = calcularLuminancia(corFundo);
  const lumTexto = calcularLuminancia(corTexto);
  const maisClaro = Math.max(lumFundo, lumTexto);
  const maisEscuro = Math.min(lumFundo, lumTexto);
  const ratio = (maisClaro + 0.05) / (maisEscuro + 0.05);
  if (ratio < 2.5) {
    return lumFundo < 0.4 ? padraoEscuro : padraoClaro;
  }
  return corTexto;
}

function passVersionTag(cartao, loja) {
  const c = [
    cartao?.selos || 0,
    cartao?.status || '',
    cartao?.ciclo || 1,
    cartao?.meta || 10,
    cartao?.clienteNome || '',
    cartao?.aviso?.id || '',
    loja?.design?.version || loja?.layout?.versao || 'v1',
    loja?.design?.updatedAt || '',
    loja?.nome || '',
    loja?.design?.colors?.background || loja?.layout?.corFundo || '',
    loja?.design?.colors?.accent || loja?.layout?.accentColor || '',
    loja?.design?.colors?.text || loja?.layout?.corTexto || '',
    loja?.design?.stamps?.iconKey || loja?.layout?.stampIcon || '',
    loja?.design?.stamps?.shape || loja?.layout?.stampShape || '',
    loja?.design?.stamps?.fill || loja?.layout?.stampFill || '',
  ].join('|');
  return crypto.createHash('md5').update(c).digest('hex');
}

/** Momento (ms) da última alteração real do passe (selos ou identidade visual da loja). */
function ultimaAtualizacaoMs(cartaoSnap, lojaSnap) {
  const cartao = cartaoSnap?.data ? cartaoSnap.data() : cartaoSnap || {};
  const loja = lojaSnap?.data ? lojaSnap.data() : lojaSnap || {};

  // O mais recente dos três: uma edição de cadastro ou exclusão (atualizadoEm)
  // depois do último selo também precisa chegar ao iPhone.
  const cTime = Math.max(
    0,
    ...[cartao.ultimoSeloEm, cartao.criadoEm, cartao.atualizadoEm]
      .filter((t) => t?.toMillis)
      .map((t) => t.toMillis())
  );

  let lTime = 0;
  if (loja.design?.updatedAt) {
    const t = new Date(loja.design.updatedAt).getTime();
    if (!isNaN(t)) lTime = t;
  } else if (loja.design?.version && !isNaN(Number(loja.design.version))) {
    lTime = Number(loja.design.version);
  } else if (loja.layout?.versao && !isNaN(Number(loja.layout.versao))) {
    lTime = Number(loja.layout.versao);
  } else if (loja.atualizadoEm?.toMillis) {
    lTime = loja.atualizadoEm.toMillis();
  }

  // Um aviso novo (aniversário, lembrete) muda o passe sem mudar os selos.
  const aTime = Number(cartao.aviso?.em) || 0;

  return Math.max(cTime, lTime, aTime, 1000);
}

// ─── Imagens ────────────────────────────────────────────────────────────────

let fallbackIconBitmap = null;
async function carregarIconePadrao() {
  if (fallbackIconBitmap) return fallbackIconBitmap;
  const PImage = require('pureimage');
  fallbackIconBitmap = await PImage.decodePNGFromStream(
    fs.createReadStream(path.join(__dirname, 'assets', 'boomii-icon.png'))
  );
  return fallbackIconBitmap;
}

/** Redimensiona um bitmap mantendo proporção, centralizado num canvas W×H transparente. */
async function encaixarPng(bitmap, W, H, fundo) {
  const PImage = require('pureimage');
  const img = PImage.make(W, H);
  const ctx = img.getContext('2d');
  if (fundo) {
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, W, H);
  } else if (typeof ctx.clearRect === 'function') {
    ctx.clearRect(0, 0, W, H);
  }
  const escala = Math.min(W / bitmap.width, H / bitmap.height);
  const w = Math.max(1, Math.round(bitmap.width * escala));
  const h = Math.max(1, Math.round(bitmap.height * escala));
  ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height, Math.round((W - w) / 2), Math.round((H - h) / 2), w, h);
  return bitmapToPngBuffer(img);
}

async function montarImagens(loja, cartao) {
  const design = loja.design || null;
  const layout = loja.layout || {};
  const bgColor = design?.colors?.background || layout.corFundo || '#141416';

  const logoDataUrl = design?.brand?.logoDataUrl || layout.logoBase64;
  const iconePadrao = await carregarIconePadrao();
  const logoBitmap = (await loadBase64Image(logoDataUrl)) || iconePadrao;

  // Ícone (notificações / tela de bloqueio): quadrado, fundo sólido na cor do cartão.
  const icon3x = await encaixarPng(logoBitmap, 87, 87, bgColor);
  const icon2x = await encaixarPng(logoBitmap, 58, 58, bgColor);
  const icon1x = await encaixarPng(logoBitmap, 29, 29, bgColor);

  // Logo e faixa saem do mesmo código que gera a prévia do Estúdio
  // (passe-apple-imagens.js), para o cartão no iPhone ser o que o lojista viu.
  const logo3x = await bitmapToPngBuffer(await renderLogoApple(loja, 3, iconePadrao));
  const logo2x = await bitmapToPngBuffer(await renderLogoApple(loja, 2, iconePadrao));
  const logo1x = await bitmapToPngBuffer(await renderLogoApple(loja, 1, iconePadrao));

  const selos = cartao.selos || 0;
  const meta = cartao.meta || design?.stamps?.total || loja.regras?.meta || 10;
  const strip3x = await bitmapToPngBuffer(await renderFaixaApple(loja, selos, meta, 3));
  const strip2x = await bitmapToPngBuffer(await renderFaixaApple(loja, selos, meta, 2));

  return {
    'icon.png': icon1x,
    'icon@2x.png': icon2x,
    'icon@3x.png': icon3x,
    'logo.png': logo1x,
    'logo@2x.png': logo2x,
    'logo@3x.png': logo3x,
    'strip.png': strip2x,
    'strip@2x.png': strip2x,
    'strip@3x.png': strip3x,
  };
}

// ─── pass.json ──────────────────────────────────────────────────────────────

function montarPassJson(cartaoId, cartao, loja, authToken) {
  const design = loja.design || null;
  const layout = loja.layout || {};

  const nomeLoja = design?.brand?.storeName || loja.nome || 'Minha Loja';
  const nomePrograma = design?.brand?.tagline || layout.nomePrograma || 'Programa de Fidelidade Digital';
  const bg = design?.colors?.background || layout.corFundo || '#141416';
  const rawFg = design?.colors?.text || layout.corTexto || '#FFFFFF';
  const fg = garantirContraste(rawFg, bg, '#FFFFFF', '#141416');
  const rawLabel = design?.colors?.muted || rawFg;
  const labelColor = garantirContraste(rawLabel, bg, '#FFFFFF', '#27272A');
  const accent = design?.colors?.accent || layout.accentColor || '#FFC82C';

  const meta = cartao.meta || loja.regras?.meta || 10;
  const selos = cartao.selos || 0;
  const faltam = Math.max(0, meta - selos);
  const completo = cartao.status === 'completo' || selos >= meta;
  const premio = design?.reward?.label || layout.premio || loja.regras?.premio || '1 Recompensa Especial';
  const validadeDias = layout.validadeDias || loja.regras?.validadeDias || 30;
  const instrucao = layout.instrucaoResgate || 'Apresente o QR Code no balcão a cada compra para creditar o selo.';
  const slug = loja.slug || cartao.lojaId;
  const codigo = `BOOMII-PASS-${String(cartaoId).slice(-4).toUpperCase()}`;
  const qrConfig = design?.qr || {};

  /*
   * Campos vindos do Estúdio de Marca, não fixos aqui.
   *
   * A Apple distribui os campos em faixas de tamanho fixo, então a lista
   * configurada é repartida: as duas primeiras entram na faixa secundária, as
   * duas seguintes na auxiliar e o excedente vai para o verso do passe — que
   * rola e comporta qualquer quantidade.
   */
  const campos = montarCamposDoPasse(loja, {
    nome: cartao.clienteNome,
    selos,
    meta,
    recompensa: premio,
    tagline: nomePrograma,
    unidade: cartao.unidade,
    // Mesmo valor da prévia e da Google; "quantos faltam" já tem campo próprio.
    status: completo ? 'Completo' : 'Ativo',
    ciclo: cartao.ciclo || 1,
    validadeDias,
  });

  const paraCampoApple = (campo, alinhamento) => ({
    key: campo.chave,
    label: campo.rotulo,
    value: campo.valor,
    ...(alinhamento ? { textAlignment: alinhamento } : {}),
  });

  // Com strip, o iOS junta as faixas secundária e auxiliar numa única linha de
  // até 4 campos. Primeiro à esquerda, último à direita e os do meio
  // centralizados: distribui a linha por igual, em vez de deixar um campo do
  // meio colado ao vizinho. A prévia do Estúdio aplica a mesma regra.
  const frente = campos.slice(0, 4);
  const alinhar = (i) => {
    if (frente.length < 2 || i === 0) return 'PKTextAlignmentLeft';
    if (i === frente.length - 1) return 'PKTextAlignmentRight';
    return 'PKTextAlignmentCenter';
  };
  const secundarios = frente.slice(0, 2).map((c, i) => paraCampoApple(c, alinhar(i)));
  const auxiliares = frente.slice(2, 4).map((c, i) => paraCampoApple(c, alinhar(i + 2)));
  const excedentes = campos.slice(4).map((c) => paraCampoApple(c, null));

  return {
    formatVersion: 1,
    passTypeIdentifier: APPLE_PASS_TYPE_ID,
    teamIdentifier: APPLE_TEAM_ID,
    serialNumber: cartaoId,
    organizationName: nomeLoja,
    description: `Cartão fidelidade ${nomeLoja}`,
    logoText: nomeLoja,
    backgroundColor: hexParaRgb(bg, 'rgb(20, 20, 22)'),
    foregroundColor: hexParaRgb(fg, 'rgb(255, 255, 255)'),
    labelColor: hexParaRgb(labelColor, 'rgb(255, 255, 255)'),
    webServiceURL: WEB_SERVICE_URL(),
    authenticationToken: authToken,
    sharingProhibited: true,
    // Cliente excluído pela loja: o iOS marca o passe como inválido.
    ...(cartao.status === 'excluido' ? { voided: true } : {}),
    storeCard: {
      headerFields: [
        {
          key: 'selos',
          label: 'SELOS',
          value: `${selos}/${meta}`,
          textAlignment: 'PKTextAlignmentRight',
          // Sem changeMessage: quem notifica é o campo `aviso` (verso), para
          // um carimbo não gerar duas notificações e o lojista poder
          // desligar/editar o texto no painel.
        },
      ],
      primaryFields: [],
      secondaryFields: secundarios,
      auxiliaryFields: auxiliares,
      backFields: [
        // Última mensagem da loja. Quando o valor muda, o iOS mostra o
        // changeMessage na tela de bloqueio — é a notificação do passe.
        // O campo existe sempre (com texto de boas-vindas): se ele só
        // aparecesse junto com o primeiro aviso, o iOS não notificaria.
        {
          key: 'aviso',
          label: cartao.aviso?.titulo || 'Mensagens da loja',
          value: cartao.aviso?.texto || `Bem-vindo ao programa de fidelidade da ${nomeLoja}!`,
          changeMessage: cartao.aviso?.titulo
            ? `${String(cartao.aviso.titulo).replace(/%/g, '%%')} %@`
            : '%@',
        },
        // Campos configurados que não couberam nas faixas da frente.
        ...excedentes,
        { key: 'programa', label: 'Programa', value: `${nomePrograma} — ${nomeLoja}` },
        {
          key: 'progresso',
          label: 'Progresso do ciclo',
          value: completo
            ? `Cartão completo (${selos}/${meta}). Retire sua recompensa no caixa.`
            : `${selos} de ${meta} selos acumulados. Faltam ${faltam}.`,
        },
        {
          key: 'instrucoes',
          label: 'Instruções no balcão',
          value: `${instrucao} Validade de ${validadeDias} dias após completar os ${meta} selos.`,
        },
        { key: 'codigo', label: 'Código do cartão', value: cartao.clienteId || codigo },
        {
          key: 'portal',
          label: 'Minha cartela & regulamento',
          value: `https://boomii-fidelidade.web.app/c/${slug}`,
        },
        { key: 'plataforma', label: 'Plataforma', value: 'BOOMII — Fidelidade em Carteira Digital' },
      ],
    },
    // QR e código abaixo dele seguem os interruptores do Estúdio.
    barcodes: qrConfig.enabled === false
      ? []
      : [
          {
            format: 'PKBarcodeFormatQR',
            // Mesmo prefixo lido pelo scanner do lojista (carimbar aceita "BOOMII:{cartaoId}").
            message: `BOOMII:${cartaoId}`,
            messageEncoding: 'iso-8859-1',
            ...(qrConfig.showPassCode === false ? {} : { altText: codigo }),
          },
        ],
  };
}

/** Gera o .pkpass assinado para um cartão. */
async function gerarPkpass(cartaoId, cartao, loja, authToken) {
  const { PKPass } = require('passkit-generator');
  const passJson = montarPassJson(cartaoId, cartao, loja, authToken);
  const imagens = await montarImagens(loja, cartao);

  const pass = new PKPass(
    { ...imagens, 'pass.json': Buffer.from(JSON.stringify(passJson)) },
    certificados()
  );
  return pass.getAsBuffer();
}

// ─── APNs ───────────────────────────────────────────────────────────────────

function enviarPushApns(session, pushToken) {
  return new Promise((resolve) => {
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': APPLE_PASS_TYPE_ID,
      'content-type': 'application/json',
    });
    let status = 0;
    let body = '';
    req.setEncoding('utf8');
    req.on('response', (headers) => {
      status = headers[':status'];
    });
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => resolve({ status, body }));
    req.on('error', (err) => resolve({ status: 0, body: err.message }));
    req.setTimeout(10000, () => {
      req.close();
      resolve({ status: 0, body: 'timeout' });
    });
    // Wallet exige payload vazio: o iOS só usa o push como "sinal" para buscar a atualização.
    req.end('{}');
  });
}

/**
 * Notifica todos os iPhones que têm os passes informados.
 * Tolerante a falhas: nunca lança — o carimbo já foi gravado e não pode falhar por causa do push.
 */
async function notificarDispositivosApple(serials) {
  const lista = [...new Set((serials || []).filter(Boolean))];
  if (!lista.length) return { enviados: 0 };

  let certs;
  try {
    certs = certificados();
  } catch (err) {
    console.warn('APNs: certificados ausentes, push ignorado.', err.message);
    return { enviados: 0 };
  }

  const db = admin.firestore();
  const regs = [];
  for (let i = 0; i < lista.length; i += 30) {
    const snap = await db.collection(REG_COLLECTION).where('serialNumber', 'in', lista.slice(i, i + 30)).get();
    regs.push(...snap.docs);
  }
  if (!regs.length) return { enviados: 0 };

  const session = http2.connect(APNS_HOST, { cert: certs.signerCert, key: certs.signerKey });
  session.on('error', (err) => console.warn('APNs sessão:', err.message));

  let enviados = 0;
  try {
    // Um pushToken pode ter vários passes; basta um push por aparelho.
    const porToken = new Map();
    regs.forEach((d) => {
      const t = d.get('pushToken');
      if (!t) return;
      if (!porToken.has(t)) porToken.set(t, []);
      porToken.get(t).push(d.ref);
    });

    for (const [token, refs] of porToken) {
      const { status, body } = await enviarPushApns(session, token);
      if (status === 200) {
        enviados++;
      } else if (status === 410 || (status === 400 && /BadDeviceToken|DeviceTokenNotForTopic/.test(body))) {
        // Aparelho removeu o passe / token inválido: limpa o registro.
        await Promise.all(refs.map((r) => r.delete().catch(() => {})));
        console.log(`APNs: token removido (${status}) ${body}`);
      } else {
        console.warn(`APNs: falha ${status} ${body}`);
      }
    }
  } finally {
    session.close();
  }
  console.log(`APNs: ${enviados} push(es) enviados para ${lista.length} passe(s).`);
  return { enviados };
}

// ─── Web Service (endpoints chamados pelo iOS) ──────────────────────────────

function lerCorpo(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.rawBody || req.body || '');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function tokenDoHeader(req) {
  const h = req.get('Authorization') || '';
  const m = h.match(/^ApplePass\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function carregarCartaoELoja(serial) {
  const db = admin.firestore();
  const cartaoSnap = await db.doc(`cartoes/${serial}`).get();
  if (!cartaoSnap.exists) return {};
  const cartao = cartaoSnap.data();
  const lojaSnap = await db.doc(`lojistas/${cartao.lojaId}`).get();
  return { cartaoSnap, cartao, lojaSnap, loja: lojaSnap.data() || {} };
}

async function enviarPkpass(res, serial, cartao, loja, token, lastModifiedMs) {
  const buffer = await gerarPkpass(serial, cartao, loja, token);
  const vTag = passVersionTag(cartao, loja);
  res.set('Content-Type', 'application/vnd.apple.pkpass');
  res.set('Content-Disposition', `attachment; filename="boomii-${(loja.slug || 'cartao')}.pkpass"`);
  res.set('Cache-Control', 'no-store');
  res.set('ETag', `"${vTag}"`);
  if (lastModifiedMs) res.set('Last-Modified', new Date(lastModifiedMs).toUTCString());
  return res.status(200).send(buffer);
}

async function handler(req, res) {
  // Em cloudfunctions.net o nome da função já vem removido do path; tratamos os dois casos.
  const rota = req.path.replace(/^\/appleWallet/, '') || '/';
  const partes = rota.split('/').filter(Boolean).map(decodeURIComponent);
  const db = admin.firestore();

  try {
    // ── Download inicial do passe (link do cadastro) ───────────────────────
    // GET /pass/{cartaoId}?t={authToken}
    if (req.method === 'GET' && partes[0] === 'pass' && partes.length === 2) {
      const serial = partes[1];
      const { cartaoSnap, cartao, lojaSnap, loja } = await carregarCartaoELoja(serial);
      if (!cartao || !tokensIguais(req.query.t, cartao.apple?.authToken)) {
        return res.status(404).send('Cartão não encontrado.');
      }
      return enviarPkpass(res, serial, cartao, loja, cartao.apple.authToken, ultimaAtualizacaoMs(cartaoSnap, lojaSnap));
    }

    if (partes[0] !== 'v1') return res.status(404).send('Not found');

    // ── POST /v1/log ───────────────────────────────────────────────────────
    if (req.method === 'POST' && partes[1] === 'log') {
      const { logs } = lerCorpo(req);
      (logs || []).forEach((l) => console.warn('[Apple Wallet log]', l));
      return res.status(200).send();
    }

    // ── /v1/devices/{device}/registrations/{passType}[/{serial}] ───────────
    if (partes[1] === 'devices' && partes[3] === 'registrations') {
      const deviceId = partes[2];
      const passType = partes[4];
      const serial = partes[5];
      if (passType !== APPLE_PASS_TYPE_ID) return res.status(404).send();

      // Lista de passes atualizados (sem autenticação, conforme especificação da Apple)
      if (req.method === 'GET' && !serial) {
        const regs = await db.collection(REG_COLLECTION).where('deviceLibraryIdentifier', '==', deviceId).get();
        if (regs.empty) return res.status(404).send();

        const desde = Number(req.query.passesUpdatedSince || 0);
        const atualizados = [];
        let maisRecente = desde;
        for (const r of regs.docs) {
          const s = r.get('serialNumber');
          const { cartaoSnap, lojaSnap } = await carregarCartaoELoja(s);
          if (!cartaoSnap) continue;
          const ts = ultimaAtualizacaoMs(cartaoSnap, lojaSnap);
          if (!desde || ts > desde) atualizados.push(s);
          if (ts > maisRecente) maisRecente = ts;
        }
        if (!atualizados.length) return res.status(204).send();
        return res.status(200).json({ serialNumbers: atualizados, lastUpdated: String(maisRecente) });
      }

      if (!serial) return res.status(404).send();

      const { cartao } = await carregarCartaoELoja(serial);
      if (!cartao || !tokensIguais(tokenDoHeader(req), cartao.apple?.authToken)) {
        return res.status(401).send();
      }
      const regRef = db.collection(REG_COLLECTION).doc(`${deviceId}__${serial}`);

      // Registro do aparelho
      if (req.method === 'POST') {
        const { pushToken } = lerCorpo(req);
        if (!pushToken) return res.status(400).send();
        const existente = await regRef.get();
        await regRef.set(
          {
            deviceLibraryIdentifier: deviceId,
            serialNumber: serial,
            passTypeIdentifier: passType,
            pushToken,
            lojaId: cartao.lojaId || null,
            atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
            ...(existente.exists ? {} : { criadoEm: admin.firestore.FieldValue.serverTimestamp() }),
          },
          { merge: true }
        );
        // Marca no cartão que ele está numa Apple Wallet (útil para o CRM).
        await db.doc(`cartoes/${serial}`).set(
          { apple: { instalado: true, ultimoRegistroEm: admin.firestore.FieldValue.serverTimestamp() } },
          { merge: true }
        );
        return res.status(existente.exists ? 200 : 201).send();
      }

      // Remoção (passe apagado do iPhone)
      if (req.method === 'DELETE') {
        await regRef.delete();
        return res.status(200).send();
      }
    }

    // ── GET /v1/passes/{passType}/{serial} — versão mais recente do passe ──
    if (req.method === 'GET' && partes[1] === 'passes' && partes.length === 4) {
      const [, , passType, serial] = partes;
      if (passType !== APPLE_PASS_TYPE_ID) return res.status(404).send();
      const { cartaoSnap, cartao, lojaSnap, loja } = await carregarCartaoELoja(serial);
      if (!cartao) return res.status(404).send();
      if (!tokensIguais(tokenDoHeader(req), cartao.apple?.authToken)) return res.status(401).send();

      const ts = ultimaAtualizacaoMs(cartaoSnap, lojaSnap);
      const ims = req.get('If-Modified-Since');
      const inm = req.get('If-None-Match');
      const vTag = passVersionTag(cartao, loja);

      if (inm && inm.replace(/"/g, '') === vTag) {
        return res.status(304).send();
      }

      if (ims) {
        const imsDate = new Date(ims).getTime();
        if (!isNaN(imsDate) && Math.floor(ts / 1000) <= Math.floor(imsDate / 1000)) {
          return res.status(304).send();
        }
      }
      return enviarPkpass(res, serial, cartao, loja, cartao.apple.authToken, ts);
    }

    return res.status(404).send('Not found');
  } catch (err) {
    console.error('appleWallet erro:', err);
    return res.status(500).send('Internal error');
  }
}

module.exports = {
  APPLE_PASS_TYPE_ID,
  APPLE_TEAM_ID,
  APPLE_SECRETS,
  garantirAuthToken,
  novoAuthToken,
  urlDownloadPasse,
  gerarPkpass,
  montarPassJson,
  carregarIconePadrao,
  notificarDispositivosApple,
  handler,
};
