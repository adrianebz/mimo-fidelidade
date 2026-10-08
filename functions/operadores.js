/**
 * PINs dos operadores de balcão.
 *
 * Antes os PINs ficavam em `lojistas/{id}.operadores`, documento de leitura
 * PÚBLICA (a página de cadastro do cliente precisa dele). Qualquer visitante
 * lia o PIN — em texto puro ou SHA-256 sem sal, que para 4 dígitos se quebra
 * em milissegundos — e, sem limite de tentativas, dava selos ou resgatava
 * prêmios de qualquer cartão.
 *
 * Agora:
 *  - os PINs vivem em `lojistas/{id}/privado/operadores`, que só o dono da
 *    loja e o admin leem e só o servidor grava;
 *  - o hash é scrypt com sal por PIN;
 *  - 5 PINs errados em 15 minutos bloqueiam o PIN da loja por 15 minutos
 *    (o lojista logado continua operando: a sessão dispensa o PIN).
 *
 * Lojas antigas são migradas na primeira consulta: o mapa sai do documento
 * público e vai para o privado. `migrarTodas` faz isso de uma vez.
 */
const admin = require('firebase-admin');
const crypto = require('crypto');
const { HttpsError } = require('firebase-functions/v2/https');

const MAX_FALHAS = 5;
const JANELA_MS = 15 * 60 * 1000;
const BLOQUEIO_MS = 15 * 60 * 1000;
const SHA256_HEX = /^[0-9a-f]{64}$/;

function refOperadores(db, lojaId) {
  return db.doc(`lojistas/${lojaId}/privado/operadores`);
}

function hashPin(pin) {
  const sal = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pin), sal, 32);
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`;
}

function iguais(a, b) {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** Confere o PIN contra scrypt (atual), SHA-256 ou texto puro (legados). */
function conferePin(pin, gravado) {
  if (!pin || !gravado) return false;
  const g = String(gravado);
  if (g.startsWith('scrypt$')) {
    const [, salHex, hashHex] = g.split('$');
    const h = crypto.scryptSync(String(pin), Buffer.from(salHex, 'hex'), 32);
    return iguais(h.toString('hex'), hashHex);
  }
  if (SHA256_HEX.test(g)) {
    return iguais(crypto.createHash('sha256').update(String(pin)).digest('hex'), g);
  }
  return iguais(String(pin), g);
}

/**
 * Mapa de operadores da loja, migrando do documento público se preciso.
 * PIN legado em texto puro vira scrypt já na migração; SHA-256 só pode ser
 * convertido quando o PIN é digitado (ver verificarPin).
 */
async function carregarOperadores(db, lojaId) {
  const privado = await refOperadores(db, lojaId).get();
  if (privado.exists) return privado.get('lista') || {};

  const lojaRef = db.doc(`lojistas/${lojaId}`);
  const legado = (await lojaRef.get()).get('operadores');
  if (!legado || typeof legado !== 'object') return {};

  const lista = {};
  for (const [id, op] of Object.entries(legado)) {
    if (!op?.pin) continue;
    const pin = String(op.pin);
    lista[id] = {
      nome: op.nome || id,
      papel: op.papel || 'operador',
      pinHash: pin.startsWith('scrypt$') || SHA256_HEX.test(pin) ? pin : hashPin(pin),
    };
  }

  const lote = db.batch();
  lote.set(refOperadores(db, lojaId), { lista, migradoEm: admin.firestore.FieldValue.serverTimestamp() });
  lote.update(lojaRef, { operadores: admin.firestore.FieldValue.delete() });
  await lote.commit();
  console.log(`Operadores da loja ${lojaId} migrados para o documento privado (${Object.keys(lista).length}).`);
  return lista;
}

function encontrar(lista, pin) {
  return Object.entries(lista).find(([, op]) => conferePin(pin, op?.pinHash));
}

/**
 * Valida o PIN de quem opera SEM sessão de lojista. Conta as falhas e
 * bloqueia a loja temporariamente após MAX_FALHAS. Lança HttpsError.
 */
async function verificarPin(db, lojaId, pin) {
  const tentativasRef = db.doc(`lojistas/${lojaId}/privado/tentativasPin`);
  const t = (await tentativasRef.get()).data() || {};
  const agora = Date.now();

  if (t.bloqueadoAte && t.bloqueadoAte > agora) {
    const min = Math.ceil((t.bloqueadoAte - agora) / 60000);
    throw new HttpsError(
      'resource-exhausted',
      `Muitas tentativas de PIN incorretas. Tente de novo em ${min} min ou entre como lojista.`
    );
  }

  const lista = await carregarOperadores(db, lojaId);
  const achado = encontrar(lista, pin);

  if (!achado) {
    const naJanela = t.primeiraFalha && agora - t.primeiraFalha < JANELA_MS;
    const falhas = naJanela ? (t.falhas || 0) + 1 : 1;
    await tentativasRef.set({
      falhas,
      primeiraFalha: naJanela ? t.primeiraFalha : agora,
      bloqueadoAte: falhas >= MAX_FALHAS ? agora + BLOQUEIO_MS : null,
    });
    throw new HttpsError('permission-denied', 'PIN do operador incorreto.');
  }

  const [id, op] = achado;
  if (t.falhas) await tentativasRef.delete();
  // Hash legado acertado: aproveita o PIN em mãos para gravar em scrypt.
  if (!String(op.pinHash).startsWith('scrypt$')) {
    await refOperadores(db, lojaId).update(new admin.firestore.FieldPath('lista', id, 'pinHash'), hashPin(pin));
  }
  return { uid: id, operador: { nome: op.nome, papel: op.papel } };
}

/** Lojista logado que também informou PIN: só identifica quem atendeu. */
async function identificarOperador(db, lojaId, pin) {
  if (!pin) return null;
  const achado = encontrar(await carregarOperadores(db, lojaId), pin);
  return achado ? { uid: achado[0], operador: { nome: achado[1].nome, papel: achado[1].papel } } : null;
}

/** Migra todas as lojas que ainda têm PINs no documento público. */
async function migrarTodas(db) {
  const snap = await db.collection('lojistas').get();
  let migradas = 0;
  for (const d of snap.docs) {
    if (!d.get('operadores')) continue;
    if ((await refOperadores(db, d.id).get()).exists) {
      // Já migrada: o que sobrou no público é resto exposto — só remove.
      await d.ref.update({ operadores: admin.firestore.FieldValue.delete() });
    } else {
      await carregarOperadores(db, d.id);
    }
    migradas++;
  }
  return migradas;
}

module.exports = { hashPin, conferePin, carregarOperadores, verificarPin, identificarOperador, migrarTodas };
