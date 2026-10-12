/**
 * Planos comerciais do Boomii e o que cada um libera.
 *
 * Fonte ÚNICA de verdade do lado do servidor — o painel tem um espelho em
 * client/src/planos.ts só para exibir cadeados. Quem decide de fato é aqui:
 * o painel pode ser contornado por quem entende de tecnologia; o servidor não.
 *
 * O plano mora em `lojistas/{id}.financeiro.plano`, campo que só o admin
 * grava (firestore.rules bloqueia o lojista de alterar `financeiro`).
 *
 * Clientes são ilimitados em todos os planos — a diferença está no motor de
 * retenção (avisos automáticos), no visual e na gestão.
 */
const { HttpsError } = require('firebase-functions/v2/https');

const ORDEM = ['essencial', 'pro', 'completo'];

const NOMES = { essencial: 'Essencial', pro: 'Pro', completo: 'Completo' };

const RECURSOS = {
  essencial: {
    variosSelosPorLeitura: false,
    estudioCompleto: false,
    avisoNovoSelo: false,
    avisoQuaseLa: false,
    avisoAniversario: false,
    avisoLembrete: false,
    textosPersonalizados: false,
    envioManual: false,
    indicadoresAvancados: false,
    fichaCliente: false,
    exportarClientes: false,
    filiais: false,
    operadores: false,
    campanhas: false,
    semMarca: false,
  },
  pro: {
    variosSelosPorLeitura: true,
    estudioCompleto: true,
    avisoNovoSelo: true,
    avisoQuaseLa: true,
    avisoAniversario: true,
    avisoLembrete: true,
    textosPersonalizados: true,
    envioManual: true,
    indicadoresAvancados: true,
    fichaCliente: true,
    exportarClientes: false,
    filiais: false,
    operadores: false,
    campanhas: false,
    semMarca: false,
  },
  completo: {
    variosSelosPorLeitura: true,
    estudioCompleto: true,
    avisoNovoSelo: true,
    avisoQuaseLa: true,
    avisoAniversario: true,
    avisoLembrete: true,
    textosPersonalizados: true,
    envioManual: true,
    indicadoresAvancados: true,
    fichaCliente: true,
    exportarClientes: true,
    filiais: true,
    operadores: true,
    campanhas: true,
    semMarca: true,
  },
};

/** Preços de referência (R$/mês). Unidade extra só existe no Completo. */
const PRECOS = { essencial: 69, pro: 149, completo: 279, unidadeExtra: 79, unidadesIncluidas: 1 };

/**
 * Plano da loja, normalizado. Nomes antigos continuam aceitos (starter,
 * balcao, rede...). Loja SEM plano gravado conta como Pro: são as lojas que
 * já usavam tudo antes dos planos existirem — tirar recursos delas sem aviso
 * seria um downgrade silencioso.
 */
function planoDaLoja(loja) {
  const bruto = String(loja?.financeiro?.plano || loja?.plano || '').toLowerCase().trim();
  if (['essencial', 'starter', 'balcao', 'basico'].includes(bruto)) return 'essencial';
  if (['completo', 'rede', 'marca', 'unlimited', 'enterprise'].includes(bruto)) return 'completo';
  return 'pro';
}

function temRecurso(loja, recurso) {
  return !!RECURSOS[planoDaLoja(loja)]?.[recurso];
}

/** Menor plano que libera o recurso — para a mensagem de erro/upgrade. */
function planoMinimo(recurso) {
  return ORDEM.find((p) => RECURSOS[p][recurso]) || 'completo';
}

/** Lança permission-denied com o nome do plano necessário. */
function exigirRecurso(loja, recurso, descricao) {
  if (temRecurso(loja, recurso)) return;
  const minimo = NOMES[planoMinimo(recurso)];
  throw new HttpsError(
    'permission-denied',
    `${descricao || 'Este recurso'} está disponível a partir do plano ${minimo}.`
  );
}

// ─── Visual do cartão no Essencial ──────────────────────────────────────────
//
// O Essencial usa o "modelo Boomii": o lojista escolhe nome, logo, cores,
// quantidade de selos e o prêmio; o acabamento (formato, ícones e imagens dos
// selos, ícone/imagem do prêmio, campos do passe, opções do QR) é o padrão.

const CAMPOS_BASICOS = {
  cliente: { enabled: true, label: 'CLIENTE' },
  faltam: { enabled: true, label: 'FALTAM' },
  recompensa: { enabled: true, label: 'RECOMPENSA' },
  unidade: { enabled: false, label: 'UNIDADE' },
  programa: { enabled: false, label: 'PROGRAMA' },
  status: { enabled: false, label: 'STATUS' },
  validade: { enabled: false, label: 'VALIDADE' },
  ciclo: { enabled: false, label: 'CICLO' },
};

const QR_BASICO = {
  enabled: true,
  format: 'boomii',
  showPassCode: true,
  label: 'Apresente no caixa para creditar o selo',
};

/** Design reduzido ao modelo básico, preservando o que o Essencial edita. */
function designBasico(design) {
  if (!design || typeof design !== 'object') return design;
  const total = Number(design.stamps?.total) || 10;
  return {
    ...design,
    stamps: {
      ...(design.stamps || {}),
      total,
      shape: 'circle',
      fill: 'number',
      iconKey: 'cookie',
      imageDataUrl: null,
      showNumbersOnEmpty: true,
      columns: total <= 6 ? total : 5,
      perScan: 1,
      maxPerScan: 1,
      allowOperatorOverride: false,
    },
    reward: {
      ...(design.reward || {}),
      iconKey: 'gift',
      imageDataUrl: null,
      color: design.colors?.accent || design.reward?.color || '#FFC82C',
    },
    fields: CAMPOS_BASICOS,
    qr: QR_BASICO,
  };
}

/** Campos legados do `layout` que carregam visual premium (imagens/ícones). */
const LAYOUT_PREMIUM = ['stampImageBase64', 'rewardStampImageBase64', 'stampImage', 'rewardStampImage', 'stampIcon'];

function mesmoJSON(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** true se o visual da loja já está dentro do que o plano permite. */
function visualDentroDoPlano(loja) {
  if (temRecurso(loja, 'estudioCompleto')) return true;
  const temLayoutPremium = LAYOUT_PREMIUM.some((k) => loja?.layout?.[k]);
  return !temLayoutPremium && (!loja?.design || mesmoJSON(designBasico(loja.design), loja.design));
}

module.exports = {
  ORDEM,
  NOMES,
  RECURSOS,
  PRECOS,
  planoDaLoja,
  temRecurso,
  planoMinimo,
  exigirRecurso,
  designBasico,
  visualDentroDoPlano,
  LAYOUT_PREMIUM,
};
