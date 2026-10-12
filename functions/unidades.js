/**
 * Unidades (filiais) de uma loja.
 *
 * Um cartão para a rede toda: o cliente acumula e resgata em qualquer unidade.
 * A unidade é registrada em cada cadastro, carimbo e resgate — é o que permite
 * comparar as unidades e o que o gerente de filial enxerga.
 *
 *  - lojistas/{loja}/unidades/{id}: nome, endereço, status, gerente e
 *    contadores (clientes cadastrados ali, carimbos por mês).
 *  - Toda loja tem a "principal" (id fixo), criada sob demanda com o nome da
 *    loja. Filiais além dela são exclusivas do plano Completo.
 *  - `financeiro.unidadesContratadas` (só o admin grava) é o limite: o
 *    Completo inclui 1; cada extra custa PRECOS.unidadeExtra. Unidade criada
 *    pelo lojista além do contratado fica "aguardando" até o admin liberar.
 *  - `unidadesResumo` no documento da loja espelha a contagem para o painel do
 *    admin listar todas as lojas sem abrir cada uma.
 */
const admin = require('firebase-admin');
const { HttpsError } = require('firebase-functions/v2/https');
const planos = require('./planos');

const PRINCIPAL = 'principal';
const STATUS = ['ativa', 'inativa', 'aguardando'];

function ref(db, lojaId, unidadeId) {
  return db.doc(`lojistas/${lojaId}/unidades/${unidadeId}`);
}

function colecao(db, lojaId) {
  return db.collection(`lojistas/${lojaId}/unidades`);
}

function mesAtual() {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .formatToParts(new Date());
  return `${p.find((x) => x.type === 'year').value}-${p.find((x) => x.type === 'month').value}`;
}

function contratadas(loja) {
  return Math.max(1, Number(loja?.financeiro?.unidadesContratadas) || 1);
}

/** Mensalidade do plano com as unidades extras (só o Completo tem extras). */
function mensalidade(plano, unidadesContratadas) {
  const base = planos.PRECOS[plano] || planos.PRECOS.pro;
  if (plano !== 'completo') return base;
  const extras = Math.max(0, (Number(unidadesContratadas) || 1) - planos.PRECOS.unidadesIncluidas);
  return base + extras * planos.PRECOS.unidadeExtra;
}

/** Cria a unidade principal se a loja ainda não tiver nenhuma. */
async function garantirPrincipal(db, lojaId, loja) {
  const principal = ref(db, lojaId, PRINCIPAL);
  const snap = await principal.get();
  if (snap.exists) return { id: PRINCIPAL, ...snap.data() };
  const dados = {
    nome: loja?.nome || 'Matriz',
    endereco: '',
    cidade: '',
    whatsapp: '',
    principal: true,
    status: 'ativa',
    criadaEm: admin.firestore.FieldValue.serverTimestamp(),
  };
  await principal.set(dados, { merge: true });
  return { id: PRINCIPAL, ...dados };
}

/**
 * Uma vez por loja: atribui à principal o que aconteceu ANTES das unidades
 * existirem. Os contadores só começam a contar no deploy das filiais; sem
 * isso, uma loja com 23 clientes mostrava "0 clientes cadastrados".
 *  - clientes sem unidade de cadastro → principal;
 *  - carimbos do mês atual sem unidade registrada → principal.
 * Meses anteriores ficam de fora: o contador é por mês e eles já passaram.
 */
async function aplicarHistoricoNaPrincipal(db, lojaId) {
  const principal = ref(db, lojaId, PRINCIPAL);
  if ((await principal.get()).get('historicoAplicado')) return false;

  const clientesSnap = await db.collection(`lojistas/${lojaId}/clientes`).get();
  const clientes = clientesSnap.docs.filter((d) => !d.get('unidadeCadastro')).length;

  const mes = mesAtual();
  const [ano, mm] = mes.split('-').map(Number);
  // Meia-noite em São Paulo (UTC-3) do dia 1º do mês.
  const inicioDoMes = admin.firestore.Timestamp.fromMillis(Date.UTC(ano, mm - 1, 1, 3));
  const cartoes = (await db.collection('cartoes').where('lojaId', '==', lojaId).get()).docs;
  let carimbos = 0;
  for (let i = 0; i < cartoes.length; i += 15) {
    const listas = await Promise.all(
      cartoes.slice(i, i + 15).map((c) => c.ref.collection('eventos').where('em', '>=', inicioDoMes).get())
    );
    listas.forEach((s) =>
      s.docs.forEach((e) => {
        if (String(e.get('tipo') || '').startsWith('selo_') && !e.get('unidadeId')) carimbos++;
      })
    );
  }

  // Transação: duas aberturas simultâneas da lista não contam o histórico duas vezes.
  return db.runTransaction(async (tx) => {
    const atual = await tx.get(principal);
    if (atual.get('historicoAplicado')) return false;
    tx.set(
      principal,
      {
        historicoAplicado: true,
        contagem: {
          clientes: admin.firestore.FieldValue.increment(clientes),
          carimbos: { [mes]: admin.firestore.FieldValue.increment(carimbos) },
        },
      },
      { merge: true }
    );
    return true;
  });
}

async function listar(db, lojaId, loja) {
  await garantirPrincipal(db, lojaId, loja);
  try {
    await aplicarHistoricoNaPrincipal(db, lojaId);
  } catch (err) {
    // Falhar aqui não pode impedir a lista de abrir; tenta de novo na próxima.
    console.warn(`Unidades: histórico da principal de ${lojaId} não aplicado:`, err.message);
  }
  const snap = await colecao(db, lojaId).get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0) || String(a.nome).localeCompare(String(b.nome)));
}

/** Recalcula o espelho `unidadesResumo` no documento da loja. */
async function atualizarResumo(db, lojaId) {
  const snap = await colecao(db, lojaId).get();
  const resumo = { ativas: 0, inativas: 0, aguardando: 0 };
  snap.docs.forEach((d) => {
    const s = d.get('status');
    if (s === 'ativa') resumo.ativas++;
    else if (s === 'aguardando') resumo.aguardando++;
    else resumo.inativas++;
  });
  await db.doc(`lojistas/${lojaId}`).set({ unidadesResumo: resumo }, { merge: true });
  return resumo;
}

/**
 * Gerente de filial é recurso do Completo. O token dele ainda pode valer por
 * até 1 h depois de a loja trocar de plano — por isso a checagem é feita
 * aqui, contra o plano atual da loja, e não só pela claim.
 */
function exigirGerenteNoPlano(claims, loja) {
  if (claims?.role === 'gerente' && !planos.temRecurso(loja, 'filiais')) {
    throw new HttpsError(
      'permission-denied',
      'O acesso de gerente de filial está disponível apenas no plano Completo. Fale com o responsável pela loja.'
    );
  }
}

/**
 * Unidade em que o atendimento está acontecendo.
 * Gerente: sempre a dele. Dono/admin: a escolhida no painel, ou a principal.
 * Unidade inativa/inexistente cai na principal — o carimbo nunca se perde.
 */
async function resolverAtendimento(db, lojaId, loja, claims, unidadeIdParam) {
  exigirGerenteNoPlano(claims, loja);
  const pedida = claims?.role === 'gerente' ? claims.unidadeId : unidadeIdParam;
  if (pedida && pedida !== PRINCIPAL) {
    const snap = await ref(db, lojaId, String(pedida)).get();
    if (snap.exists && snap.get('status') === 'ativa') return { id: snap.id, nome: snap.get('nome') || '' };
    if (claims?.role === 'gerente') {
      throw new HttpsError('permission-denied', 'Sua unidade está inativa. Fale com o responsável pela loja.');
    }
  }
  const principal = await garantirPrincipal(db, lojaId, loja);
  return { id: PRINCIPAL, nome: principal.nome || '' };
}

/** Contadores da unidade (dentro ou fora de transação). */
function contarCarimbo(gravador, db, lojaId, unidadeId) {
  gravador.set(
    ref(db, lojaId, unidadeId),
    { contagem: { carimbos: { [mesAtual()]: admin.firestore.FieldValue.increment(1) } } },
    { merge: true }
  );
}

function contarCliente(gravador, db, lojaId, unidadeId) {
  gravador.set(
    ref(db, lojaId, unidadeId),
    { contagem: { clientes: admin.firestore.FieldValue.increment(1) } },
    { merge: true }
  );
}

/**
 * Plano sem filiais: desativa as unidades extras (o histórico fica). Não
 * reativa sozinho num upgrade — o dono escolhe quais voltam.
 */
async function aplicarPlano(db, lojaId, loja) {
  if (planos.temRecurso(loja, 'filiais')) return 0;
  const snap = await colecao(db, lojaId).get();

  // Gerentes (inclusive o da principal) perdem o acesso: o papel é do Completo.
  const comGerente = snap.docs.filter((d) => d.get('gerenteUid'));
  for (const d of comGerente) {
    const uid = d.get('gerenteUid');
    await admin.auth().setCustomUserClaims(uid, null).catch(() => {});
    await admin.auth().revokeRefreshTokens(uid).catch(() => {});
  }

  const extras = snap.docs.filter((d) => d.id !== PRINCIPAL && d.get('status') === 'ativa');
  if (!extras.length && !comGerente.length) return 0;

  const apagar = admin.firestore.FieldValue.delete();
  const lote = db.batch();
  extras.forEach((d) =>
    lote.update(d.ref, { status: 'inativa', motivoInativa: 'plano', atualizadaEm: admin.firestore.FieldValue.serverTimestamp() })
  );
  comGerente.forEach((d) => lote.update(d.ref, { gerenteEmail: apagar, gerenteUid: apagar, gerenteDesde: apagar }));
  await lote.commit();
  await atualizarResumo(db, lojaId);
  if (comGerente.length) console.log(`Plano sem filiais: ${comGerente.length} gerente(s) de ${lojaId} sem acesso.`);
  return extras.length;
}

function validarDados({ nome, endereco, cidade, whatsapp }) {
  const n = String(nome || '').trim().replace(/\s+/g, ' ');
  if (n.length < 2 || n.length > 60) throw new HttpsError('invalid-argument', 'Informe o nome da unidade (2 a 60 caracteres).');
  const e = String(endereco || '').trim().slice(0, 120);
  const c = String(cidade || '').trim().slice(0, 60);
  const w = String(whatsapp || '').replace(/\D/g, '').slice(0, 13);
  if (w && w.length < 10) throw new HttpsError('invalid-argument', 'WhatsApp inválido: use DDD + número.');
  return { nome: n, endereco: e, cidade: c, whatsapp: w };
}

/** Id legível e único a partir do nome ("Shopping Boulevard" → "shopping-boulevard"). */
async function novoId(db, lojaId, nome) {
  const base =
    String(nome)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'unidade';
  let id = base === PRINCIPAL ? `${base}-2` : base;
  for (let i = 2; (await ref(db, lojaId, id).get()).exists; i++) id = `${base}-${i}`;
  return id;
}

module.exports = {
  PRINCIPAL,
  STATUS,
  ref,
  colecao,
  mesAtual,
  contratadas,
  mensalidade,
  garantirPrincipal,
  listar,
  atualizarResumo,
  resolverAtendimento,
  exigirGerenteNoPlano,
  contarCarimbo,
  contarCliente,
  aplicarPlano,
  validarDados,
  novoId,
};
