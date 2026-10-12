/**
 * Métricas por cliente, calculadas a partir do histórico de eventos do cartão
 * (cartoes/{id}/eventos): cada carimbo, bônus de aniversário e resgate.
 *
 * Usado pela ficha do cliente (Pro) e pela planilha de exportação (Completo)
 * — a mesma conta nos dois lugares, para os números baterem.
 */
const DIA = 24 * 60 * 60 * 1000;

function ms(valor) {
  if (!valor) return 0;
  if (typeof valor.toMillis === 'function') return valor.toMillis();
  const n = typeof valor === 'number' ? valor : Date.parse(valor);
  return Number.isFinite(n) ? n : 0;
}

function ehCarimbo(e) {
  return String(e.tipo || '').startsWith('selo_');
}

function selosDoEvento(e) {
  if (e.quantidadeCreditada !== undefined) return Number(e.quantidadeCreditada) || 0;
  return Math.max(0, (Number(e.selosDepois) || 0) - (Number(e.selosAntes) || 0));
}

/** Cartões do cliente na loja e todos os eventos deles, do mais antigo ao mais novo. */
async function carregarHistorico(db, lojaId, clienteId) {
  const cartoesSnap = await db.collection('cartoes')
    .where('lojaId', '==', lojaId)
    .where('clienteId', '==', String(clienteId))
    .get();
  const cartoes = cartoesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const listas = await Promise.all(
    cartoesSnap.docs.map((d) => d.ref.collection('eventos').get())
  );
  const eventos = listas
    .flatMap((s) => s.docs.map((d) => ({ id: d.id, ...d.data(), emMs: ms(d.get('em')) })))
    .sort((a, b) => a.emMs - b.emMs);
  return { cartoes, eventos };
}

/**
 * @param cliente  dados de lojistas/{loja}/clientes/{id}
 * @param periodo  { desde?: ms, ate?: ms } — recorta visitas, selos e resgates
 */
function calcularMetricas(cliente, cartoes, eventos, periodo = {}) {
  const desde = Number(periodo.desde) || 0;
  const ate = Number(periodo.ate) || Infinity;
  const noPeriodo = (e) => e.emMs >= desde && e.emMs <= ate;

  const carimbos = eventos.filter(ehCarimbo);
  const carimbosPeriodo = carimbos.filter(noPeriodo);
  const ganhosPeriodo = eventos
    .filter((e) => noPeriodo(e) && (ehCarimbo(e) || e.tipo === 'bonus_aniversario'))
    .reduce((soma, e) => soma + selosDoEvento(e), 0);
  const resgatesPeriodo = eventos.filter((e) => e.tipo === 'resgate' && noPeriodo(e)).length;

  const primeira = carimbos[0]?.emMs || 0;
  const ultima = carimbos[carimbos.length - 1]?.emMs || 0;
  const frequencia =
    carimbos.length >= 2 ? Math.round((ultima - primeira) / DIA / (carimbos.length - 1)) : null;

  const ativo = cartoes.find((c) => ['ativo', 'completo'].includes(c.status)) || cartoes[0] || {};
  const cadastro =
    ms(cliente?.consentimento?.em) || ms(ativo.criadoEm) || ms(cliente?.atualizadoEm) || 0;

  return {
    nome: cliente?.nome || ativo.clienteNome || '',
    celular: cliente?.celular || ativo.clienteCelular || '',
    email: cliente?.email || ativo.clienteEmail || '',
    aniversario: cliente?.aniversario || ativo.clienteAniversario || '',
    cadastradoEm: cadastro || null,
    selosAtuais: Number(ativo.selos) || 0,
    meta: Number(ativo.meta) || 10,
    cicloAtual: Number(ativo.ciclo) || 1,
    status: ativo.status || '',
    visitas: carimbosPeriodo.length,
    selosGanhos: ganhosPeriodo,
    resgates: resgatesPeriodo,
    primeiraVisita: primeira || null,
    ultimaVisita: ultima || null,
    frequenciaMediaDias: frequencia,
    diasSemAparecer: ultima ? Math.floor((Date.now() - ultima) / DIA) : null,
    appleWallet: !!ativo.apple?.instalado,
    consentimentoLgpd: !!cliente?.consentimento?.aceito,
  };
}

/** Linha do tempo para a ficha: os mais recentes primeiro, sem dados internos. */
function linhaDoTempo(eventos, limite = 40) {
  return eventos
    .slice(-limite)
    .reverse()
    .map((e) => ({
      tipo: ehCarimbo(e) ? 'selo' : e.tipo,
      em: e.emMs || null,
      selos: ehCarimbo(e) || e.tipo === 'bonus_aniversario' ? selosDoEvento(e) : undefined,
      saldo: e.selosDepois,
      premio: e.premio,
      ciclo: e.cicloResgatado,
      operador: e.operadorNome,
    }));
}

// ─── CSV ────────────────────────────────────────────────────────────────────

function dataBR(msValor) {
  if (!msValor) return '';
  return new Date(msValor).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function aniversarioBR(raw) {
  const v = String(raw || '');
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = v.match(/^(\d{2})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : '';
}

/** "+5591999999999" → "(91) 99999-9999"; outros formatos só perdem o "+". */
function celularBR(e164) {
  const v = String(e164 || '');
  const m = v.match(/^\+?55(\d{2})(\d{4,5})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : v.replace(/^\+/, '');
}

function celula(valor) {
  const s = valor === null || valor === undefined ? '' : String(valor);
  // Fórmula injetada (=, +, -, @) vira texto: o arquivo é aberto no Excel.
  const seguro = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const COLUNAS = [
  ['Nome', (m) => m.nome],
  ['Celular', (m) => celularBR(m.celular)],
  ['E-mail', (m) => m.email],
  ['Aniversário', (m) => aniversarioBR(m.aniversario)],
  ['Cadastro', (m) => dataBR(m.cadastradoEm)],
  ['Selos atuais', (m) => m.selosAtuais],
  ['Meta', (m) => m.meta],
  ['Ciclo atual', (m) => m.cicloAtual],
  ['Visitas no período', (m) => m.visitas],
  ['Selos ganhos no período', (m) => m.selosGanhos],
  ['Recompensas no período', (m) => m.resgates],
  ['Primeira visita', (m) => dataBR(m.primeiraVisita)],
  ['Última visita', (m) => dataBR(m.ultimaVisita)],
  ['Frequência média (dias)', (m) => m.frequenciaMediaDias ?? ''],
  ['Dias sem aparecer', (m) => m.diasSemAparecer ?? ''],
  ['Apple Wallet', (m) => (m.appleWallet ? 'Sim' : 'Não')],
  ['Consentimento LGPD', (m) => (m.consentimentoLgpd ? 'Sim' : 'Não')],
];

/** CSV no padrão do Excel em português: ";" como separador e BOM UTF-8. */
function paraCSV(metricas) {
  const linhas = [COLUNAS.map(([titulo]) => titulo).join(';')];
  for (const m of metricas) linhas.push(COLUNAS.map(([, valor]) => celula(valor(m))).join(';'));
  return '﻿' + linhas.join('\r\n');
}

module.exports = { carregarHistorico, calcularMetricas, linhaDoTempo, paraCSV, ms };
