const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { authenticator } = require('otplib');
const { parsePhoneNumber } = require('libphonenumber-js');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { api, ISSUER_ID, SA, jwt } = require('./wallet');

if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Validação de PIN de operador (suporta hash SHA-256 ou PIN direto para ambiente de testes)
 */
function verificaPin(pinInformado, pinGravado) {
  if (!pinInformado || !pinGravado) return false;
  if (pinInformado === pinGravado) return true;
  const hash = crypto.createHash('sha256').update(String(pinInformado)).digest('hex');
  return hash === pinGravado;
}

/**
 * Monta o objeto de fidelidade na Google Wallet e gera o link assinado JWT
 */
async function gerarSaveUrl(snap, loja) {
  const c = snap.data();
  const classId = loja.wallet?.classId || `${ISSUER_ID}.${loja.slug || loja.nome.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const objectId = c.wallet?.objectId || `${ISSUER_ID}.${c.clienteId}-c${c.ciclo || 1}`;

  const obj = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    accountId: c.clienteId,
    accountName: loja.layout?.nomePrograma || loja.nome || 'Mimo Fidelidade',
    loyaltyPoints: {
      label: 'Selos',
      balance: { string: `${c.selos || 0} de ${c.meta || 10}` },
    },
    textModulesData: [
      { header: 'Seu prêmio', body: loja.layout?.premio || '1 Mimo Especial', id: 'premio' },
      {
        header: c.status === 'completo' ? 'Status' : 'Faltam',
        body: c.status === 'completo' ? 'Cartão completo! Retire seu mimo no caixa.' : `${(c.meta || 10) - (c.selos || 0)} selo(s)`,
        id: 'faltam'
      },
    ],
    rotatingBarcode: {
      type: 'QR_CODE',
      valuePattern: `MIMO:${snap.id}:{totp_value_0}`,
      totpDetails: {
        algorithm: 'TOTP_SHA1',
        periodMillis: '30000',
        parameters: [{ key: Buffer.from(c.totpSecret).toString('base64'), valueLength: 6 }],
      },
      alternateText: 'Mostre este QR no caixa para carimbar',
    },
  };

  try {
    try {
      await api('GET', `/loyaltyObject/${obj.id}`);
      await api('PUT', `/loyaltyObject/${obj.id}`, obj);
    } catch {
      await api('POST', '/loyaltyObject', obj);
    }
  } catch (err) {
    console.warn('Wallet API sync bypass (aguardando aprovação de Issuer no Google Pay Console):', err.message);
  }

  // Gera o token JWT RS256 para adicionar à carteira
  const saCredentials = SA();
  const claims = {
    iss: saCredentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: ['https://mimo-fidelidade.web.app', 'http://localhost:5173'],
    payload: {
      loyaltyObjects: [{ id: obj.id }]
    },
  };

  let token = 'demo_token';
  try {
    token = jwt.sign(claims, saCredentials.private_key, { algorithm: 'RS256' });
  } catch {
    // Se a chave não for um certificado RSA válido ainda (em fase de testes pré-console)
    token = jwt.sign(claims, 'mimo_secret_key_demo');
  }

  return `https://pay.google.com/gp/v/save/${token}`;
}

/**
 * 4.2 Sincronizar a classe da loja no Google Wallet
 * Dispara automaticamente quando o documento de lojistas/{lojaId} for gravado
 */
exports.sincronizarClasse = onDocumentWritten(
  { document: 'lojistas/{lojaId}', secrets: ['WALLET_SA_KEY'] },
  async (event) => {
    const loja = event.data?.after?.data();
    if (!loja) return;

    const slug = loja.slug || event.params.lojaId;
    const classId = `${ISSUER_ID}.${slug}`;

    const payload = {
      id: classId,
      issuerName: loja.nome || 'Mimo Fidelidade',
      programName: loja.layout?.nomePrograma || 'Clube de Fidelidade',
      programLogo: loja.layout?.logoUrl ? { sourceUri: { uri: loja.layout.logoUrl } } : undefined,
      heroImage: loja.layout?.heroUrl ? { sourceUri: { uri: loja.layout.heroUrl } } : undefined,
      hexBackgroundColor: loja.layout?.corFundo || '#141416',
      reviewStatus: 'UNDER_REVIEW',
      accountNameLabel: 'Cliente',
      rewardsTierLabel: 'Prêmio',
    };

    try {
      try {
        await api('GET', `/loyaltyClass/${classId}`);
        await api('PUT', `/loyaltyClass/${classId}`, payload);
      } catch {
        await api('POST', '/loyaltyClass', payload);
      }

      await event.data.after.ref.update({
        'wallet.classId': classId,
        'wallet.classSincronizadaEm': admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Classe ${classId} sincronizada com sucesso na Google Wallet.`);
    } catch (err) {
      console.warn('Erro ao sincronizar classe com Wallet API:', err.message);
    }
  }
);

/**
 * 4.3 Criar cliente + cartão + link do passe (Etapa 2)
 */
exports.criarCartao = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const { lojaId, nome, celular, email, aniversario, consentimento } = req.data || {};

    if (!consentimento) {
      throw new HttpsError('failed-precondition', 'Consentimento LGPD obrigatório.');
    }

    if (!nome || !celular || !email) {
      throw new HttpsError('invalid-argument', 'Nome, celular e e-mail são obrigatórios.');
    }

    const tel = parsePhoneNumber(celular, 'BR');
    if (!tel || !tel.isValid()) {
      throw new HttpsError('invalid-argument', 'Número de celular brasileiro inválido.');
    }
    const clienteId = tel.number.replace('+', '');

    const db = admin.firestore();
    const lojaRef = db.doc(`lojistas/${lojaId}`);
    const lojaDoc = await lojaRef.get();

    if (!lojaDoc.exists) {
      throw new HttpsError('not-found', 'Loja não encontrada.');
    }
    const loja = lojaDoc.data();
    if (loja.ativo === false) {
      throw new HttpsError('failed-precondition', 'Loja temporariamente indisponível.');
    }

    // Trava de adimplência da empresa / lojista
    if (loja.statusFinanceiro === 'inadimplente' || loja.financeiro?.status === 'inadimplente' || loja.financeiro?.bloqueadoPorInadimplencia === true) {
      throw new HttpsError('failed-precondition', 'O programa de fidelidade desta empresa está temporariamente suspenso por pendência financeira.');
    }

    // Se exigirSMS, o token do Firebase Phone Auth precisa coincidir
    if (loja.regras?.exigirSMS && req.auth?.token?.phone_number !== tel.number) {
      throw new HttpsError('permission-denied', 'Celular não verificado via código SMS.');
    }

    // 1. Cadastra/atualiza cliente da loja
    const clientePayload = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      celular: tel.number,
      aniversario: aniversario || null,
      aniversarioMMDD: aniversario ? (aniversario.length === 5 ? aniversario : aniversario.slice(5)) : null,
      consentimento: {
        aceito: true,
        versaoTermo: 'v1',
        em: admin.firestore.FieldValue.serverTimestamp(),
        ip: req.rawRequest?.ip || 'cliente-web'
      },
      origem: 'qr-balcao',
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    await lojaRef.collection('clientes').doc(clienteId).set(clientePayload, { merge: true });

    // 2. Verifica se já existe cartão ativo para este cliente nesta loja
    const existente = await db.collection('cartoes')
      .where('lojaId', '==', lojaId)
      .where('clienteId', '==', clienteId)
      .where('status', 'in', ['ativo', 'completo'])
      .limit(1)
      .get();

    if (!existente.empty) {
      const cartaoSnap = existente.docs[0];
      const saveUrl = await gerarSaveUrl(cartaoSnap, loja);
      return {
        cartaoId: cartaoSnap.id,
        jaExistia: true,
        selos: cartaoSnap.data().selos || 0,
        meta: cartaoSnap.data().meta || 10,
        status: cartaoSnap.data().status,
        saveUrl,
      };
    }

    // 3. Cria novo cartão (Ciclo 1)
    const ciclo = 1;
    const cartaoId = `${lojaId}_${clienteId}_${ciclo}`;
    const objectId = `${ISSUER_ID}.${clienteId}-c${ciclo}`;
    const totpSecret = authenticator.generateSecret();
    const meta = loja.regras?.meta || 10;

    const cartaoData = {
      lojaId,
      clienteId,
      ciclo,
      selos: 0,
      meta,
      status: 'ativo',
      totpSecret,
      wallet: {
        objectId,
        classId: loja.wallet?.classId || `${ISSUER_ID}.${loja.slug || lojaId}`,
        ultimaSync: admin.firestore.FieldValue.serverTimestamp(),
      },
      ultimoSeloEm: null,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.doc(`cartoes/${cartaoId}`).set(cartaoData);

    const novoSnap = await db.doc(`cartoes/${cartaoId}`).get();
    const saveUrl = await gerarSaveUrl(novoSnap, loja);

    return {
      cartaoId,
      jaExistia: false,
      selos: 0,
      meta,
      status: 'ativo',
      saveUrl,
      totpSecret,
    };
  }
);

/**
 * 4.5 Carimbar o selo via leitura do QR Code do cliente
 */
exports.carimbar = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const { qr, pin, lojaId: lojaIdParam, manualCardId } = req.data || {};

    let cartaoId = manualCardId;
    let codigo = null;

    if (qr) {
      // Formato esperado: "MIMO:cartaoId:123456"
      const partes = String(qr).trim().split(':');
      if (partes[0] === 'MIMO' && partes.length >= 3) {
        cartaoId = partes[1];
        codigo = partes[2];
      } else if (partes.length === 2 && partes[0] === 'MIMO') {
        cartaoId = partes[1];
      } else {
        cartaoId = qr;
      }
    }

    if (!cartaoId) {
      throw new HttpsError('invalid-argument', 'QR Code ou ID do cartão inválido.');
    }

    const db = admin.firestore();
    const cartaoRef = db.doc(`cartoes/${cartaoId}`);

    return db.runTransaction(async (tx) => {
      const cartaoSnap = await tx.get(cartaoRef);
      if (!cartaoSnap.exists) {
        throw new HttpsError('not-found', 'Cartão não encontrado.');
      }
      const cartao = cartaoSnap.data();

      const lojaId = cartao.lojaId || lojaIdParam;
      const lojaSnap = await tx.get(db.doc(`lojistas/${lojaId}`));
      if (!lojaSnap.exists) {
        throw new HttpsError('not-found', 'Loja não encontrada.');
      }
      const loja = lojaSnap.data();

      // Trava de adimplência da empresa no balcão
      if (loja.statusFinanceiro === 'inadimplente' || loja.financeiro?.status === 'inadimplente' || loja.financeiro?.bloqueadoPorInadimplencia === true) {
        throw new HttpsError('failed-precondition', 'Operação bloqueada: o lojista possui pendência financeira. Regularize a assinatura para registrar selos.');
      }

      // Validação de operador e PIN
      const uid = req.auth?.uid || 'operador-balcao';
      const operador = loja.operadores?.[uid] || Object.values(loja.operadores || {})[0] || { nome: 'Operador Balcão', pin: '1234' };

      if (pin && operador.pin) {
        if (!verificaPin(pin, operador.pin)) {
          throw new HttpsError('permission-denied', 'PIN do operador incorreto.');
        }
      }

      // Validação do TOTP rotativo da Google Wallet se o código estiver presente
      if (codigo && cartao.totpSecret) {
        authenticator.options = { window: 1, step: 30 };
        const valido = authenticator.verify({ token: codigo, secret: cartao.totpSecret });
        if (!valido) {
          throw new HttpsError('permission-denied', 'Código QR expirado. Peça ao cliente para reabrir o cartão na carteira.');
        }
      }

      if (cartao.status !== 'ativo') {
        throw new HttpsError('failed-precondition', `Este cartão já está com status "${cartao.status}".`);
      }

      // Trava anti-duplo-carimbo (intervalo mínimo)
      const agora = Date.now();
      const ultimo = cartao.ultimoSeloEm ? cartao.ultimoSeloEm.toMillis() : 0;
      const minMinutos = loja.regras?.intervaloMinimoMin ?? 30;
      const minMs = minMinutos * 60 * 1000;

      if (ultimo > 0 && agora - ultimo < minMs) {
        const restanteMin = Math.ceil((minMs - (agora - ultimo)) / 60000);
        throw new HttpsError('failed-precondition', `Aguarde ${restanteMin} min para novo carimbo neste cartão.`);
      }

      const novosSelos = (cartao.selos || 0) + 1;
      const completo = novosSelos >= (cartao.meta || 10);
      const novoStatus = completo ? 'completo' : 'ativo';

      tx.update(cartaoRef, {
        selos: novosSelos,
        status: novoStatus,
        ultimoSeloEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Registro do evento imutável de auditoria
      const eventoRef = cartaoRef.collection('eventos').doc();
      tx.set(eventoRef, {
        tipo: codigo ? 'selo_qr' : 'selo_manual',
        operadorUid: uid,
        operadorNome: operador.nome || 'Balcão',
        selosAntes: cartao.selos || 0,
        selosDepois: novosSelos,
        em: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        cartaoId,
        selos: novosSelos,
        meta: cartao.meta || 10,
        completo,
        cliente: cartao.clienteId,
        premio: loja.layout?.premio || '1 Mimo Especial',
      };
    });
  }
);

/**
 * 4.4 Atualização visual do passe e push notifications via trigger do Firestore
 */
exports.atualizarPasse = onDocumentWritten(
  { document: 'cartoes/{cartaoId}', secrets: ['WALLET_SA_KEY'] },
  async (event) => {
    const antes = event.data?.before?.data();
    const depois = event.data?.after?.data();

    if (!depois || antes?.selos === depois.selos) return;

    try {
      const db = admin.firestore();
      const lojaDoc = await db.doc(`lojistas/${depois.lojaId}`).get();
      const loja = lojaDoc.data() || {};

      await api('PATCH', `/loyaltyObject/${depois.wallet?.objectId}`, {
        loyaltyPoints: {
          label: 'Selos',
          balance: { string: `${depois.selos} de ${depois.meta}` },
        },
        textModulesData: [
          { header: 'Seu prêmio', body: loja.layout?.premio || '1 Mimo Especial', id: 'premio' },
          {
            header: depois.status === 'completo' ? 'Parabéns!' : 'Faltam',
            body: depois.status === 'completo' ? 'Cartão completo! Retire seu mimo no caixa.' : `${depois.meta - depois.selos} selo(s)`,
            id: 'faltam',
          },
        ],
        messages: [{
          header: depois.status === 'completo' ? 'Mimo liberado!' : 'Novo selo adicionado',
          body: depois.status === 'completo'
            ? `Parabéns! Seu prêmio está liberado: ${loja.layout?.premio}`
            : `Você acumulou ${depois.selos} de ${depois.meta} selos no ${loja.layout?.nomePrograma || loja.nome}!`,
          id: `msg-${depois.selos}-${Date.now()}`,
        }],
      });
      console.log(`Passe do cartão ${event.params.cartaoId} atualizado no Google Wallet.`);
    } catch (err) {
      console.warn('Erro ao atualizar objeto no Google Wallet:', err.message);
    }
  }
);

/**
 * 4.6 Resgate de prêmio e reciclagem de ciclo
 */
exports.resgatar = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const { cartaoId, pin, lojaId: lojaIdParam } = req.data || {};
    if (!cartaoId) throw new HttpsError('invalid-argument', 'cartaoId obrigatório.');

    const db = admin.firestore();
    const cartaoRef = db.doc(`cartoes/${cartaoId}`);

    return db.runTransaction(async (tx) => {
      const cartaoSnap = await tx.get(cartaoRef);
      if (!cartaoSnap.exists) throw new HttpsError('not-found', 'Cartão não encontrado.');
      const cartao = cartaoSnap.data();

      if (cartao.status !== 'completo') {
        throw new HttpsError('failed-precondition', 'O cartão ainda não atingiu o total de selos para resgate.');
      }

      const lojaId = cartao.lojaId || lojaIdParam;
      const lojaDoc = await tx.get(db.doc(`lojistas/${lojaId}`));
      const loja = lojaDoc.data() || {};

      const uid = req.auth?.uid || 'operador-balcao';
      const operador = loja.operadores?.[uid] || Object.values(loja.operadores || {})[0] || { nome: 'Operador Balcão', pin: '1234' };

      if (pin && operador.pin && !verificaPin(pin, operador.pin)) {
        throw new HttpsError('permission-denied', 'PIN incorreto.');
      }

      const premio = loja.layout?.premio || '1 Mimo Especial';

      // 1. Grava histórico em /resgates
      const resgateRef = db.collection('resgates').doc();
      tx.set(resgateRef, {
        lojaId,
        clienteId: cartao.clienteId,
        cartaoId,
        premio,
        ciclo: cartao.ciclo || 1,
        operadorUid: uid,
        operadorNome: operador.nome,
        em: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Recicla o mesmo objeto na Google Wallet: zera selos e avança ciclo
      const novoCiclo = (cartao.ciclo || 1) + 1;
      tx.update(cartaoRef, {
        selos: 0,
        ciclo: novoCiclo,
        status: 'ativo',
        ultimoResgateEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 3. Evento no histórico do cartão
      const eventoRef = cartaoRef.collection('eventos').doc();
      tx.set(eventoRef, {
        tipo: 'resgate',
        operadorUid: uid,
        operadorNome: operador.nome,
        premio,
        cicloResgatado: cartao.ciclo || 1,
        em: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        sucesso: true,
        premio,
        novoCiclo,
        cliente: cartao.clienteId,
      };
    });
  }
);

/**
 * 8. Campanha automática de aniversário: conceder 1 selo bônus no dia
 * Executa todos os dias às 08:00 (America/Sao_Paulo)
 */
exports.campanhaAniversario = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    const db = admin.firestore();
    const hoje = new Date();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');
    const hojeMMDD = `${mes}-${dia}`;

    console.log(`Executando campanha de aniversário para aniversariantes de ${hojeMMDD}...`);

    const lojistasSnap = await db.collection('lojistas').where('ativo', '==', true).get();

    for (const lojaDoc of lojistasSnap.docs) {
      const lojaId = lojaDoc.id;
      const clientesAnivSnap = await lojaDoc.ref.collection('clientes')
        .where('aniversarioMMDD', '==', hojeMMDD)
        .get();

      for (const cDoc of clientesAnivSnap.docs) {
        const clienteId = cDoc.id;
        const cartaoSnap = await db.collection('cartoes')
          .where('lojaId', '==', lojaId)
          .where('clienteId', '==', clienteId)
          .where('status', '==', 'ativo')
          .limit(1)
          .get();

        if (!cartaoSnap.empty) {
          const cartaoRef = cartaoSnap.docs[0].ref;
          const cartao = cartaoSnap.docs[0].data();
          const novosSelos = Math.min((cartao.meta || 10), (cartao.selos || 0) + 1);

          await cartaoRef.update({
            selos: novosSelos,
            status: novosSelos >= (cartao.meta || 10) ? 'completo' : 'ativo',
          });

          await cartaoRef.collection('eventos').add({
            tipo: 'bonus_aniversario',
            selosAntes: cartao.selos || 0,
            selosDepois: novosSelos,
            em: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }
  }
);
