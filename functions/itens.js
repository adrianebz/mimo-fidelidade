/**
 * Itens Fixos (plano Completo): o que foi vendido em cada carimbo.
 *
 * O operador marca os itens da compra e lê o QR UMA vez. O servidor confere
 * os itens no cadastro e calcula os selos (quantidade × selos do item) — o
 * celular só informa o que foi vendido, nunca quantos selos dar.
 *
 *  - lojistas/{loja}/itens/{id}: nome, categoria, preço (opcional), selos por
 *    unidade vendida (0 = registra a venda sem dar selo), ativo.
 *  - Contadores no próprio item: vendas por mês e por unidade (filiais) —
 *    é o que alimenta o "Mais Vendidos" sem varrer o histórico.
 *  - Modo da loja em `regras.modalidade`: 'geral' (como sempre foi) ou 'itens'.
 */
const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const planos = require('./planos');

const MAX_QTD_POR_ITEM = 99;
const MAX_ITENS_POR_COMPRA = 30;

function colecao(db, lojaId) {
  return db.collection(`lojistas/${lojaId}/itens`);
}

/** A loja está operando por itens? (fora do Completo, sempre "geral"). */
function modoItens(loja) {
  return loja?.regras?.modalidade === 'itens' && planos.temRecurso(loja, 'itensFixos');
}

function validarDados({ nome, categoria, preco, selos }) {
  const n = String(nome || '').trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 60) throw new HttpsError('invalid-argument', 'Informe o nome do item (2 a 60 caracteres).');
  const s = Math.floor(Number(selos));
  if (!Number.isFinite(s) || s < 0 || s > 10) throw new HttpsError('invalid-argument', 'Selos por item: de 0 a 10.');
  const p = preco === '' || preco === null || preco === undefined ? null : Number(String(preco).replace(',', '.'));
  if (p !== null && (!Number.isFinite(p) || p < 0 || p > 100000)) throw new HttpsError('invalid-argument', 'Preço inválido.');
  return {
    nome: n,
    categoria: String(categoria || '').trim().slice(0, 40) || 'Geral',
    preco: p === null ? null : Math.round(p * 100) / 100,
    selos: s,
  };
}

/**
 * Confere a compra informada pelo balcão contra o cadastro.
 * @param pedido [{ id, qtd }]
 * @returns { itens: [{ id, nome, qtd, selos }], selos } — selos = soma de qtd × selos do item
 */
async function carregarVenda(db, lojaId, pedido) {
  if (!Array.isArray(pedido) || pedido.length === 0) {
    throw new HttpsError('invalid-argument', 'Marque os itens desta compra antes de ler o QR do cliente.');
  }
  if (pedido.length > MAX_ITENS_POR_COMPRA) throw new HttpsError('invalid-argument', 'Itens demais numa compra só.');

  // Mesmo item marcado duas vezes: soma.
  const porId = new Map();
  for (const p of pedido) {
    const id = String(p?.id || '');
    const qtd = Math.floor(Number(p?.qtd));
    if (!id || !Number.isFinite(qtd) || qtd < 1 || qtd > MAX_QTD_POR_ITEM) {
      throw new HttpsError('invalid-argument', 'Quantidade inválida em um dos itens.');
    }
    porId.set(id, (porId.get(id) || 0) + qtd);
  }

  const refs = [...porId.keys()].map((id) => colecao(db, lojaId).doc(id));
  const snaps = await db.getAll(...refs);
  const itens = snaps.map((s) => {
    if (!s.exists) throw new HttpsError('not-found', 'Um dos itens marcados não existe mais. Atualize a lista.');
    if (s.get('ativo') === false) throw new HttpsError('failed-precondition', `"${s.get('nome')}" está pausado e não pode ser vendido.`);
    return { id: s.id, nome: s.get('nome') || '', qtd: porId.get(s.id), selos: Number(s.get('selos')) || 0 };
  });
  return { itens, selos: itens.reduce((soma, i) => soma + i.qtd * i.selos, 0) };
}

/** Contadores de venda (mês e unidade) — dentro ou fora de transação. */
function contarVenda(gravador, db, lojaId, unidadeId, mes, itens) {
  const inc = (n) => admin.firestore.FieldValue.increment(n);
  for (const i of itens) {
    gravador.set(
      colecao(db, lojaId).doc(i.id),
      { vendas: { [mes]: inc(i.qtd) }, vendasPorUnidade: { [unidadeId]: { [mes]: inc(i.qtd) } } },
      { merge: true }
    );
  }
}

module.exports = { colecao, modoItens, validarDados, carregarVenda, contarVenda, MAX_QTD_POR_ITEM };
