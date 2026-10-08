/**
 * Notificações pela própria carteira (Apple Wallet e Google Wallet).
 *
 * Não há e-mail nem SMS: o aviso aparece na tela de bloqueio do celular do
 * cliente, como notificação do próprio passe. Custo zero por mensagem.
 *
 * Fluxo:
 *  1. Quem gera o evento (carimbar, campanhaAniversario, lembretePremio) grava
 *     `aviso` no documento do cartão.
 *  2. O trigger atualizarPasse percebe que `aviso.id` mudou e:
 *     - Apple: manda o push do APNs; o iPhone rebaixa o .pkpass, vê que o campo
 *       `aviso` mudou de valor e exibe o `changeMessage` na tela de bloqueio;
 *     - Google: chama `addMessage` com TEXT_AND_NOTIFY.
 *
 * Limites das plataformas (não contornáveis):
 *  - Google: no máximo 3 notificações por passe a cada 24 h; acima disso a
 *    mensagem entra no passe sem tocar o celular.
 *  - Apple: só notifica se o TEXTO do campo mudar. Dois avisos idênticos
 *    seguidos geram uma notificação só — por isso os textos padrão sempre
 *    trazem um número que muda (selos, dias).
 */

/** Textos e regras padrão. O lojista sobrescreve em `lojistas/{id}.notificacoes`. */
const PADRAO = {
  selo: {
    ativo: true,
    titulo: 'Novo selo!',
    texto: 'Você ganhou {creditadosTexto} na {loja}. Cartela: {selos}/{meta}.',
  },
  quaseLa: {
    ativo: true,
    /** Avisa quando faltarem esta quantidade de selos ou menos. */
    faltam: 1,
    titulo: 'Quase lá!',
    texto: 'Só {faltamTexto} para ganhar {premio}!',
  },
  completo: {
    ativo: true,
    titulo: 'Prêmio liberado! 🎉',
    texto: 'Cartela completa! Mostre o QR no balcão da {loja} e retire: {premio}.',
  },
  aniversario: {
    ativo: true,
    /** Selos de presente no dia do aniversário (0 = só a mensagem). */
    bonus: 1,
    titulo: 'Feliz aniversário, {nome}! 🎂',
    texto: 'A {loja} te deu {bonusTexto} de presente. Cartela: {selos}/{meta}.',
  },
  lembrete: {
    ativo: true,
    /** Dias entre a cartela completar e cada lembrete. */
    dias: 3,
    /** Quantos lembretes, no máximo, por prêmio. */
    maxEnvios: 2,
    titulo: 'Seu prêmio está esperando',
    texto: 'Seu {premio} está liberado há {dias} dias. Passe na {loja} para retirar!',
  },
  variaveis: {
    loja: '',
    premio: '',
    bonusTexto: '',
    creditadosTexto: '',
    faltamTexto: '',
  },
};

const TIPOS = ['selo', 'quaseLa', 'completo', 'aniversario', 'lembrete'];

/** Config da loja mesclada com o padrão, campo a campo. */
function resolverConfig(loja) {
  const salva = loja?.notificacoes || {};
  const cfg = {};
  for (const tipo of TIPOS) {
    cfg[tipo] = { ...PADRAO[tipo], ...(salva[tipo] || {}) };
  }
  cfg.variaveis = { ...PADRAO.variaveis, ...(salva.variaveis || {}) };
  return cfg;
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

/** Variáveis disponíveis nos textos: {nome}, {loja}, {selos}, {meta}, {faltam}, {premio}... */
function montarVariaveis(loja, dados) {
  const customVars = loja?.notificacoes?.variaveis || {};
  const meta = Number(dados.meta) || 10;
  const selos = Number(dados.selos) || 0;
  const faltam = Math.max(0, meta - selos);
  const creditados = Number(dados.creditados) || 0;
  const bonus = Number(dados.bonus) || 0;
  const nomeCompleto = String(dados.nome || '').trim();
  return {
    nome: nomeCompleto.split(/\s+/)[0] || 'cliente',
    loja: (customVars.loja && customVars.loja.trim()) || loja?.design?.brand?.storeName || loja?.nome || 'loja',
    premio: (customVars.premio && customVars.premio.trim()) || loja?.design?.reward?.label || loja?.layout?.premio || loja?.regras?.premio || 'seu prêmio',
    selos,
    meta,
    faltam,
    faltamTexto: (customVars.faltamTexto && customVars.faltamTexto.trim()) || (faltam === 1 ? 'falta 1 selo' : `faltam ${faltam} selos`),
    creditados,
    creditadosTexto: (customVars.creditadosTexto && customVars.creditadosTexto.trim()) || plural(creditados, 'selo', 'selos'),
    bonus,
    bonusTexto: (customVars.bonusTexto && customVars.bonusTexto.trim()) || (bonus > 0 ? plural(bonus, 'selo', 'selos') : 'um presente especial'),
    dias: Number(dados.dias) || 0,
  };
}

function aplicarTemplate(texto, vars) {
  return String(texto || '').replace(/\{(\w+)\}/g, (m, chave) =>
    Object.prototype.hasOwnProperty.call(vars, chave) ? String(vars[chave]) : m
  );
}

/** Objeto gravado em `cartoes/{id}.aviso`. O `id` muda a cada aviso. */
function novoAviso(tipo, cfgTipo, vars) {
  return {
    id: `${tipo}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    titulo: aplicarTemplate(cfgTipo.titulo, vars).slice(0, 80),
    texto: aplicarTemplate(cfgTipo.texto, vars).slice(0, 240),
    em: Date.now(),
  };
}

/**
 * Aviso de um carimbo. Prioridade: cartela completa > quase lá > novo selo.
 * Se o tipo prioritário estiver desligado, cai no seguinte. Devolve null se
 * nenhum se aplicar.
 */
function avisoDeSelo(loja, { selos, meta, creditados, nome }) {
  const cfg = resolverConfig(loja);
  const vars = montarVariaveis(loja, { selos, meta, creditados, nome });
  if (creditados <= 0) return null;

  if (vars.faltam === 0 && cfg.completo.ativo) return novoAviso('completo', cfg.completo, vars);
  const limite = Math.max(1, Number(cfg.quaseLa.faltam) || 1);
  if (vars.faltam > 0 && vars.faltam <= limite && cfg.quaseLa.ativo) {
    return novoAviso('quaseLa', cfg.quaseLa, vars);
  }
  if (cfg.selo.ativo) return novoAviso('selo', cfg.selo, vars);
  return null;
}

function avisoDeAniversario(loja, { selos, meta, bonus, nome }) {
  const cfg = resolverConfig(loja);
  if (!cfg.aniversario.ativo) return null;
  return novoAviso('aniversario', cfg.aniversario, montarVariaveis(loja, { selos, meta, bonus, nome }));
}

function avisoDeLembrete(loja, { selos, meta, dias, nome }) {
  const cfg = resolverConfig(loja);
  if (!cfg.lembrete.ativo) return null;
  return novoAviso('lembrete', cfg.lembrete, montarVariaveis(loja, { selos, meta, dias, nome }));
}

/**
 * Google Wallet: mensagem com notificação no celular.
 * Tolerante a falhas — o aviso já está gravado no cartão e aparece no passe.
 */
async function enviarAvisoGoogle(api, objectId, aviso) {
  if (!objectId || !aviso) return false;
  try {
    await api('POST', `/loyaltyObject/${objectId}/addMessage`, {
      message: {
        id: aviso.id,
        header: aviso.titulo,
        body: aviso.texto,
        messageType: 'TEXT_AND_NOTIFY',
      },
    });
    return true;
  } catch (err) {
    console.warn(`Google Wallet: falha ao enviar aviso ${aviso.id}:`, err.message);
    return false;
  }
}

module.exports = {
  PADRAO,
  TIPOS,
  resolverConfig,
  montarVariaveis,
  aplicarTemplate,
  avisoDeSelo,
  avisoDeAniversario,
  avisoDeLembrete,
  enviarAvisoGoogle,
};
