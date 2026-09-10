const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { Readable } = require('stream');
const { authenticator } = require('otplib');
const { api, ISSUER_ID, SA, jwt } = require('./wallet');
const walletIcons = require('./wallet-icons');

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

const FN_BASE = () =>
  `https://us-central1-${process.env.GCLOUD_PROJECT || 'mimo-2d6eb'}.cloudfunctions.net`;

/**
 * Monta a definição da loyaltyClass (identidade visual da loja na carteira).
 *
 * Usada em dois lugares: pelo trigger sincronizarClasse (que cria/atualiza a
 * classe via API) e dentro do próprio JWT de "Salvar na Wallet" — incluí-la no
 * JWT é o que garante que o link funcione mesmo se a chamada de API tiver
 * falhado, porque aí o Google cria a classe no momento em que o cliente salva.
 */
function montarLoyaltyClass(loja, slug, versao, classId) {
  const design = loja.design || null;
  const meta = design?.stamps?.total || loja.regras?.meta || 10;
  const bgColor = design?.colors?.background || loja.layout?.corFundo || '#141416';
  const nomePrograma = design?.brand?.tagline || loja.layout?.nomePrograma || 'Programa de Fidelidade Digital';
  const nomeLoja = design?.brand?.storeName || loja.nome || 'Minha Loja';

  return {
    id: classId,
    issuerName: nomePrograma,
    programName: nomeLoja,
    localizedIssuerName: { defaultValue: { language: 'pt-BR', value: nomePrograma } },
    localizedProgramName: { defaultValue: { language: 'pt-BR', value: nomeLoja } },
    programLogo: {
      sourceUri: { uri: `${FN_BASE()}/getLogo?lojaId=${slug}&v=${versao}` },
      contentDescription: {
        defaultValue: { language: 'pt-BR', value: `Logo ${nomeLoja}` },
      },
    },
    heroImage: {
      sourceUri: { uri: `${FN_BASE()}/generateBanner?lojaId=${slug}&selos=0&meta=${meta}&v=${versao}` },
      contentDescription: {
        defaultValue: { language: 'pt-BR', value: `Cartela de selos ${nomeLoja}` },
      },
    },
    hexBackgroundColor: bgColor,
    accountNameLabel: 'CLIENTE VIP',
    accountIdLabel: 'CÓDIGO DO CARTÃO',
    rewardsTierLabel: 'STATUS',
    countryCode: 'BR',
    reviewStatus: 'UNDER_REVIEW',
    allowMultipleUsersPerObject: true,
    multipleDevicesAndHoldersAllowedStatus: 'multipleHolders',
  };
}

/**
 * Monta o objeto de fidelidade na Google Wallet e gera o link assinado JWT
 * Totalmente personalizado com dados do cliente (nome, email, aniversário, QR, selos) e do lojista (loja, prêmio, regras, banner)
 */
async function gerarSaveUrl(snap, loja, clienteParam) {
  const c = snap.data() || {};
  let cliente = clienteParam;

  if (!cliente && (!c.clienteNome || !c.clienteEmail)) {
    try {
      const db = admin.firestore();
      const cliDoc = await db.doc(`lojistas/${c.lojaId}/clientes/${c.clienteId}`).get();
      if (cliDoc.exists) {
        cliente = cliDoc.data();
      }
    } catch (e) {
      console.warn('Busca de cliente no Firestore:', e.message);
    }
  }

  const clienteNome = c.clienteNome || cliente?.nome || 'Cliente VIP';
  const clienteEmail = c.clienteEmail || cliente?.email || '';
  const clienteAniv = c.clienteAniversario || cliente?.aniversario || '';
  const clienteCelular = c.clienteCelular || cliente?.celular || c.clienteId || '';

  const versao = loja.layout?.versao || loja.wallet?.versao || 'v3';
  const slugClean = (loja.slug || loja.nome?.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'loja');
  const classId = loja.wallet?.classId || `${ISSUER_ID}.${slugClean}_${versao}`;
  const objectId = c.wallet?.objectId || `${ISSUER_ID}.${slugClean}_${c.clienteId}_c${c.ciclo || 1}`;
  const meta = c.meta || loja.regras?.meta || 10;
  const selos = c.selos || 0;
  const faltam = Math.max(0, meta - selos);
  const premio = loja.layout?.premio || loja.regras?.premio || '1 Mimo Especial';
  const validadeDias = loja.layout?.validadeDias || loja.regras?.validadeDias || 30;
  const instrucaoResgate = loja.layout?.instrucaoResgate || 'Here you will see your of stamps';
  const passCode = `MIMO-PASS-${snap.id.slice(-4).toUpperCase()}`;

  const textModulesData = [
    {
      id: 'cliente_vip',
      header: 'CLIENTE VIP',
      body: clienteNome,
    },
    {
      id: 'premio_mimo',
      header: 'PRÊMIO DO MIMO',
      body: premio,
    },
    {
      id: 'progresso_ciclo',
      header: 'PROGRESSO DO CICLO',
      body: c.status === 'completo'
        ? `Cartão completo! (${selos}/${meta} selos). Retire seu mimo no caixa.`
        : `${selos} de ${meta} selos acumulados (Faltam ${faltam} selos)`,
    },
    {
      id: 'regras_resgate',
      header: 'INSTRUÇÕES NO BALCÃO',
      body: `${instrucaoResgate} Validade de ${validadeDias} dias após completar os ${meta} selos.`,
    },
  ];

  const obj = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    accountId: c.clienteId,
    accountName: clienteNome,
    loyaltyPoints: {
      localizedLabel: {
        defaultValue: {
          language: 'pt-BR',
          value: 'Cartão Mimo'
        }
      },
      balance: { string: `${selos} / ${meta} SELOS` },
    },
    heroImage: {
      sourceUri: {
        uri: `https://us-central1-${process.env.GCLOUD_PROJECT || 'mimo-2d6eb'}.cloudfunctions.net/generateBanner?lojaId=${slugClean}&selos=${selos}&meta=${meta}&v=${versao}`
      },
      contentDescription: {
        defaultValue: {
          language: 'pt-BR',
          value: `Progresso do Ciclo: ${selos} de ${meta} selos`
        }
      }
    },
    textModulesData,
    infoModuleData: {
      labelValueRows: [
        {
          columns: [
            { label: 'CLIENTE VIP', value: clienteNome },
            { label: 'CÓDIGO DO CARTÃO', value: c.clienteId || clienteCelular }
          ]
        },
        {
          columns: [
            { label: 'STATUS', value: c.status === 'completo' ? 'Completo' : 'Ativo' },
            { label: 'PRÊMIO', value: premio }
          ]
        }
      ]
    },
    barcode: {
      type: 'QR_CODE',
      value: `MIMO:${snap.id}:${c.totpSecret ? authenticator.generate(c.totpSecret) : '8821'}`,
      alternateText: passCode,
    },
    linksModuleData: {
      uris: [
        {
          kind: 'walletobjects#uri',
          uri: 'https://mimo-fidelidade.web.app',
          description: 'Acessar Portal do Clube MIMO'
        },
        {
          kind: 'walletobjects#uri',
          uri: `https://mimo-fidelidade.web.app/c/${loja.slug || snap.id.split('_')[0]}`,
          description: 'Ver Minha Cartela & Regulamento'
        }
      ]
    }
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

  // Gera o token JWT RS256 para adicionar à carteira.
  //
  // A definição da CLASSE vai junto com o objeto no payload de propósito: a
  // versão da classe muda a cada publicação no Estúdio e, se a chamada de API
  // que cria essa nova classe falhar, o objeto apontaria para uma classe
  // inexistente e o botão "Adicionar à Carteira" quebraria com 404. Mandando a
  // classe no JWT, o próprio Google a cria na hora em que o cliente salva.
  const saCredentials = SA();
  const loyaltyClass = montarLoyaltyClass(loja, slugClean, versao, classId);
  const claims = {
    iss: saCredentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: ['https://mimo-fidelidade.web.app', 'http://localhost:5173'],
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [obj]
    },
  };

  let token = 'demo_token';
  try {
    token = jwt.sign(claims, saCredentials.private_key, { algorithm: 'RS256' });
  } catch {
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
    const lojaAntes = event.data?.before?.data();
    if (!loja) return;

    // Guarda contra auto-disparo infinito: esta function grava 'wallet.classId' e
    // 'wallet.classSincronizadaEm' no próprio documento que a disparou. Sem esta
    // checagem, cada gravação reativa a function indefinidamente (e reprocessa o
    // PATCH de todos os cartões do lojista a cada ciclo).
    const versaoAntes = lojaAntes?.layout?.versao || lojaAntes?.wallet?.versao;
    const versaoDepois = loja.layout?.versao || loja.wallet?.versao;
    const layoutMudou = JSON.stringify(lojaAntes?.layout || {}) !== JSON.stringify(loja.layout || {});
    const jaSincronizada = !!lojaAntes && versaoAntes === versaoDepois && !layoutMudou;
    if (jaSincronizada) return;

    const slug = (loja.slug || event.params.lojaId || 'loja').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const versao = loja.layout?.versao || loja.wallet?.versao || 'v3';
    const classId = loja.wallet?.classId || `${ISSUER_ID}.${slug}_${versao}`;

    const payload = montarLoyaltyClass(loja, slug, versao, classId);

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

      // Propagar o novo design para TODOS os cartões existentes do lojista
      const db = admin.firestore();
      const cartoesSnap = await db.collection('cartoes').where('lojaId', '==', loja.slug || event.params.lojaId).get();
      
      const patchPromises = cartoesSnap.docs.map(async (cartaoDoc) => {
        const c = cartaoDoc.data();
        if (!c.wallet?.objectId) return;
        const metaAtual = c.meta || loja.regras?.meta || 10;
        
        const objPatch = {
          heroImage: {
            sourceUri: {
              uri: `https://us-central1-${process.env.GCLOUD_PROJECT || 'mimo-2d6eb'}.cloudfunctions.net/generateBanner?lojaId=${slug}&selos=${c.selos || 0}&v=${Date.now()}`
            },
            contentDescription: {
              defaultValue: {
                language: 'pt-BR',
                value: `Progresso do Ciclo: ${c.selos || 0} de ${metaAtual} selos`
              }
            }
          }
        };
        try {
          await api('PATCH', `/loyaltyObject/${c.wallet.objectId}`, objPatch);
        } catch (e) {
          console.warn(`Erro ao fazer PATCH do objeto retroativo ${c.wallet.objectId}:`, e.message);
        }
      });
      
      await Promise.all(patchPromises);
      console.log(`Todos os cartões do lojista ${slug} atualizados com o novo design.`);

    } catch (err) {
      console.warn('Erro ao sincronizar classe com Wallet API:', err.message);
    }
  }
);

/**
 * Provisiona (ou atualiza) a conta de acesso de um lojista no Firebase Auth.
 *
 * O login em si NÃO passa mais por Cloud Function: o cliente usa
 * signInWithEmailAndPassword direto no Firebase Auth. Esta função existe só
 * para o admin criar/editar o acesso de uma loja — criando o usuário e
 * gravando as custom claims (role=lojista, lojaId) que o firestore.rules usa
 * para restringir cada lojista aos dados da própria loja.
 *
 * Optamos por usuários nativos do Auth em vez de custom token porque
 * createCustomToken exige dar à conta de serviço a permissão
 * iam.serviceAccounts.signBlob — dependência de IAM que essa abordagem evita.
 */
exports.provisionarLojista = onCall(
  { region: 'southamerica-east1' },
  async (req) => {
    // Só um admin autenticado pode criar/alterar acessos de lojista.
    if (req.auth?.token?.role !== 'admin') {
      throw new HttpsError('permission-denied', 'Apenas o administrador pode gerenciar acessos de lojista.');
    }

    const { email, senha, lojaId } = req.data || {};
    if (!email || !lojaId) {
      throw new HttpsError('invalid-argument', 'E-mail e lojaId são obrigatórios.');
    }
    if (senha && String(senha).length < 6) {
      throw new HttpsError('invalid-argument', 'A senha precisa ter ao menos 6 caracteres.');
    }

    const emailLimpo = String(email).toLowerCase().trim();
    const slug = String(lojaId).toLowerCase().trim();
    const claims = { role: 'lojista', lojaId: slug };

    let user;
    try {
      user = await admin.auth().getUserByEmail(emailLimpo);
      await admin.auth().updateUser(user.uid, {
        ...(senha ? { password: String(senha) } : {}),
        emailVerified: true,
      });
    } catch (err) {
      if (err.code !== 'auth/user-not-found') throw err;
      if (!senha) {
        throw new HttpsError('invalid-argument', 'Informe uma senha para criar o acesso deste lojista.');
      }
      user = await admin.auth().createUser({
        email: emailLimpo,
        password: String(senha),
        emailVerified: true,
      });
    }

    await admin.auth().setCustomUserClaims(user.uid, claims);

    return { sucesso: true, uid: user.uid, lojaId: slug };
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

    const { parsePhoneNumber } = require('libphonenumber-js');
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
      const saveUrl = await gerarSaveUrl(cartaoSnap, loja, clientePayload);
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
    const versaoLoja = loja.layout?.versao || loja.wallet?.versao || 'v3';
    const slugLojaClean = (loja.slug || lojaId).toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    // Mesmo formato usado em gerarSaveUrl/sincronizarClasse — objectId/classId precisam
    // bater exatamente, senão o objeto aponta para uma classe que não existe na Wallet.
    const objectId = `${ISSUER_ID}.${slugLojaClean}_${clienteId}_c${ciclo}`;
    const classId = loja.wallet?.classId || `${ISSUER_ID}.${slugLojaClean}_${versaoLoja}`;
    const totpSecret = authenticator.generateSecret();
    const meta = loja.regras?.meta || 10;

    const cartaoData = {
      lojaId,
      clienteId,
      clienteNome: nome.trim(),
      clienteEmail: email.trim().toLowerCase(),
      clienteAniversario: aniversario || null,
      clienteCelular: tel.number,
      ciclo,
      selos: 0,
      meta,
      status: 'ativo',
      totpSecret,
      wallet: {
        objectId,
        classId,
        ultimaSync: admin.firestore.FieldValue.serverTimestamp(),
      },
      ultimoSeloEm: null,
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.doc(`cartoes/${cartaoId}`).set(cartaoData);

    const novoSnap = await db.doc(`cartoes/${cartaoId}`).get();
    const saveUrl = await gerarSaveUrl(novoSnap, loja, clientePayload);

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

      // Validação de operador e PIN — o PIN é OBRIGATÓRIO e identifica o operador
      // (não confiamos mais em req.auth?.uid nem no "primeiro operador da loja",
      // que permitiam carimbar sem nenhuma credencial).
      if (!pin) {
        throw new HttpsError('invalid-argument', 'PIN do operador é obrigatório para registrar o selo.');
      }
      const operadoresMap = loja.operadores || {};
      const operadorEntry = Object.entries(operadoresMap).find(([, op]) => verificaPin(pin, op?.pin));
      if (!operadorEntry) {
        throw new HttpsError('permission-denied', 'PIN do operador incorreto.');
      }
      const [uid, operador] = operadorEntry;

      // Validação do TOTP rotativo, quando o código vem da leitura do QR da Wallet.
      // NÃO bloqueia o carimbo: a Google Wallet não suporta atualizar a imagem do
      // barcode em tempo real sem Smart Tap/NFC, então um código "desatualizado" é
      // esperado — a barreira de segurança real é o PIN do operador acima.
      if (codigo && cartao.totpSecret) {
        authenticator.options = { window: 2, step: 30 };
        const valido = authenticator.verify({ token: codigo, secret: cartao.totpSecret });
        if (!valido) {
          console.warn(`TOTP desatualizado para o cartão ${cartaoId} (aceito mesmo assim; PIN já validou o operador).`);
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

      // Espelha o progresso no doc do cliente (usado pelo CRM do lojista)
      if (cartao.clienteId) {
        tx.set(
          db.doc(`lojistas/${lojaId}/clientes/${cartao.clienteId}`),
          {
            stamps: novosSelos,
            status: novoStatus,
            lastVisit: new Date().toISOString(),
          },
          { merge: true }
        );
      }

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

      const clienteNome = depois.clienteNome || 'Cliente VIP';
      const meta = depois.meta || 10;
      const selos = depois.selos || 0;
      const faltam = Math.max(0, meta - selos);
      const premio = loja.layout?.premio || loja.regras?.premio || '1 Mimo Especial';
      const validadeDias = loja.layout?.validadeDias || loja.regras?.validadeDias || 30;
      const instrucaoResgate = loja.layout?.instrucaoResgate || 'Apresente o QR Code no balcão a cada compra para creditar o selo.';

      const textModulesData = [
        {
          id: 'regras_resgate',
          header: 'INSTRUÇÕES NO BALCÃO',
          body: `${instrucaoResgate} Validade de ${validadeDias} dias após completar os 10 selos.`,
        }
      ];

      await api('PATCH', `/loyaltyObject/${depois.wallet?.objectId}`, {
        loyaltyPoints: {
          localizedLabel: {
            defaultValue: {
              language: 'pt-BR',
              value: 'Cartão Mimo'
            }
          },
          balance: { string: `${selos} / ${meta} SELOS` },
        },
        heroImage: {
          sourceUri: {
            uri: `https://us-central1-${process.env.GCLOUD_PROJECT || 'mimo-2d6eb'}.cloudfunctions.net/generateBanner?lojaId=${loja.slug || depois.lojaId}&selos=${selos}&meta=${meta}&v=${Date.now()}`
          },
          contentDescription: {
            defaultValue: { language: 'pt-BR', value: `Progresso: ${selos} de ${meta} selos` }
          }
        },
        textModulesData,
        infoModuleData: {
          labelValueRows: [
            {
              columns: [
                { label: 'CLIENTE VIP', value: clienteNome },
                { label: 'CÓDIGO DO CARTÃO', value: depois.clienteId || depois.clienteCelular || 'MIMO-VIP' }
              ]
            },
            {
              columns: [
                { label: 'STATUS', value: depois.status === 'completo' ? 'Completo' : 'Ativo' },
                { label: 'PRÊMIO', value: premio }
              ]
            }
          ]
        },
        messages: [{
          header: depois.status === 'completo' ? 'Mimo liberado!' : 'Novo selo adicionado',
          body: depois.status === 'completo'
            ? `Parabéns! Seu prêmio está liberado: ${premio}`
            : `Você acumulou ${selos} de ${meta} selos no ${loja.layout?.nomePrograma || loja.nome}!`,
          id: `msg-${selos}-${Date.now()}`,
        }],
      });
      console.log(`Passe do cartão ${event.params.cartaoId} atualizado no Google Wallet com dados completos.`);
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

      if (!pin) {
        throw new HttpsError('invalid-argument', 'PIN do operador é obrigatório para resgatar o prêmio.');
      }
      const operadoresMap = loja.operadores || {};
      const operadorEntry = Object.entries(operadoresMap).find(([, op]) => verificaPin(pin, op?.pin));
      if (!operadorEntry) {
        throw new HttpsError('permission-denied', 'PIN incorreto.');
      }
      const [uid, operador] = operadorEntry;

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

      // Espelha o progresso no doc do cliente (usado pelo CRM do lojista)
      if (cartao.clienteId) {
        tx.set(
          db.doc(`lojistas/${lojaId}/clientes/${cartao.clienteId}`),
          {
            stamps: 0,
            status: 'ativo',
            lastVisit: new Date().toISOString(),
          },
          { merge: true }
        );
      }

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

// Auxiliar para converter Base64 em Stream para o PureImage
function bufferToStream(buffer) {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return stream;
}

// Endpoint Dinâmico 1: Retorna o Logotipo da Loja a partir do Base64 salvo no Firestore
exports.getLogo = onRequest({ cors: true, memory: '512MiB' }, async (req, res) => {
  const lojaId = req.query.lojaId;
  if (!lojaId) return res.status(400).send('lojaId required');
  try {
    const db = admin.firestore();
    const docSnap = await db.doc(`lojistas/${lojaId}`).get();
    if (!docSnap.exists) return res.status(404).send('Not found');
    const layout = docSnap.data().layout || {};
    if (layout.logoBase64) {
      const b64Data = layout.logoBase64.split(',')[1] || layout.logoBase64;
      const buffer = Buffer.from(b64Data, 'base64');
      res.setHeader('Content-Type', layout.logoBase64.includes('jpeg') ? 'image/jpeg' : 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache no Wallet
      return res.send(buffer);
    }
  } catch (err) {
    console.error(err);
  }
  // Fallback genérico se falhar
  res.redirect('https://mimo-fidelidade.web.app/logos/loja.jpg');
});

async function loadBase64Image(dataUrl) {
  if (!dataUrl || !dataUrl.includes('base64,')) return null;
  try {
    const PImage = require('pureimage');
    const isPng = dataUrl.includes('image/png');
    const isJpeg = dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg');
    if (!isPng && !isJpeg) return null;
    
    const b64Data = dataUrl.split(',')[1];
    const buffer = Buffer.from(b64Data, 'base64');
    const stream = bufferToStream(buffer);
    
    if (isPng) {
      return await PImage.decodePNGFromStream(stream);
    } else {
      return await PImage.decodeJPEGFromStream(stream);
    }
  } catch (err) {
    console.warn('Erro ao carregar imagem base64:', err.message);
    return null;
  }
}

// Endpoint Dinâmico 2: Gera o Banner (Cartela de Selos) na hora usando PureImage
// Totalmente personalizável por loja e por cliente: cor de fundo, cor de destaque,
// ícone do selo (ou imagem customizada), ícone/imagem do prêmio do último selo e a
// meta e o progresso REAIS daquele cartão (via query params ?selos= e ?meta=).
exports.generateBanner = onRequest({ cors: true, memory: '512MiB' }, async (req, res) => {
  const PImage = require('pureimage');
  const lojaId = req.query.lojaId;
  const selos = Math.max(0, parseInt(req.query.selos || '0', 10));

  if (!lojaId) return res.status(400).send('lojaId required');

  try {
    const db = admin.firestore();
    const docSnap = await db.doc(`lojistas/${lojaId}`).get();
    if (!docSnap.exists) return res.status(404).send('Not found');
    const lojaData = docSnap.data() || {};
    const layout = lojaData.layout || {};
    const design = lojaData.design || null;

    // O JSON do Estúdio (`design`) é a fonte de verdade; `layout` é o espelho
    // legado, mantido para lojas que ainda não passaram pelo Estúdio.
    const bgColor = design?.colors?.background || layout.corFundo || '#141416';
    const accentColor = design?.colors?.accent || layout.accentColor || '#FFC82C';
    const stampInk = design?.colors?.stampInk || layout.stampInk || bgColor;
    const stampIconKey = String(design?.stamps?.iconKey || layout.stampIcon || 'cookie').toLowerCase();
    const stampShape = String(design?.stamps?.shape || layout.stampShape || 'circle').toLowerCase();
    const stampFill = String(design?.stamps?.fill || layout.stampFill || 'icon').toLowerCase();
    const showNumbersOnEmpty =
      design?.stamps?.showNumbersOnEmpty ?? layout.showNumbersOnEmpty ?? false;
    const rewardColor = design?.reward?.color || layout.rewardColor || accentColor;
    const rewardIconKey = String(design?.reward?.iconKey || layout.rewardIcon || 'gift').toLowerCase();

    const meta = Math.max(
      1,
      Math.min(
        30,
        parseInt(req.query.meta || String(design?.stamps?.total || lojaData.regras?.meta || 10), 10) || 10
      )
    );

    const img = PImage.make(1032, 336);
    const ctx = img.getContext('2d');

    // Fundo principal na cor da loja (o mesmo hexBackgroundColor da loyaltyClass)
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 1032, 336);

    // Painel interno na cor de destaque, como a cartela do cartão de referência.
    // Só preenchimento: roundRect + stroke no pureimage fecha o traço errado e
    // deixa uma diagonal atravessando o painel.
    const margin = 20;
    if (typeof ctx.roundRect === 'function') {
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(margin, margin, 1032 - margin * 2, 336 - margin * 2, 28);
      ctx.fill();
    } else {
      ctx.fillStyle = accentColor;
      ctx.fillRect(margin, margin, 1032 - margin * 2, 336 - margin * 2);
    }

    // Grade adapta-se à meta de selos configurada pelo lojista (não é fixa em 10)
    const colsConfig = Number(design?.stamps?.columns || layout.stampColumns || 5);
    const cols = Math.min(Math.max(3, colsConfig), meta);
    const rows = Math.ceil(meta / cols);
    // Raio limitado pelo espaço disponível, para caber qualquer combinação de
    // meta × colunas sem os selos vazarem para fora do painel.
    const padding = margin + 16;
    const maxByWidth = (1032 - padding * 2) / (cols * 2.35);
    const maxByHeight = (336 - padding * 2) / (rows * 2.35);
    const radius = Math.max(18, Math.min(52, maxByWidth, maxByHeight));

    const innerLeft = padding + radius;
    const innerRight = 1032 - padding - radius;
    const innerTop = padding + radius;
    const innerBottom = 336 - padding - radius;

    const spacingX = cols > 1 ? (innerRight - innerLeft) / (cols - 1) : 0;
    const spacingY = rows > 1 ? (innerBottom - innerTop) / (rows - 1) : 0;
    const originX = cols > 1 ? innerLeft : 1032 / 2;
    const originY = rows > 1 ? innerTop : 336 / 2;

    let stampBitmap = null;
    let rewardBitmap = null;

    const b64Stamp =
      design?.stamps?.imageDataUrl || layout.stampImageBase64 || layout.stampImage;
    if (b64Stamp && b64Stamp.startsWith('data:image')) {
      stampBitmap = await loadBase64Image(b64Stamp);
    }
    const b64Reward =
      design?.reward?.imageDataUrl || layout.rewardStampImageBase64 || layout.rewardStampImage;
    if (b64Reward && b64Reward.startsWith('data:image')) {
      rewardBitmap = await loadBase64Image(b64Reward);
    }

    // O conteúdo do selo é desenhado sobre a cor de destaque, então a tinta
    // precisa contrastar com ela (e não com o fundo do cartão).
    const inkColor = stampInk || walletIcons.contrastIconColor(accentColor);

    for (let i = 0; i < meta; i++) {
      const rowIdx = Math.floor(i / cols);
      const colIdx = i % cols;
      const cx = originX + colIdx * spacingX;
      const cy = originY + rowIdx * spacingY;

      const position = i + 1;
      const isFilled = i < selos;
      const isLast = i === meta - 1;

      if (isLast) {
        // Selo do prêmio: imagem própria do lojista, senão o ícone escolhido.
        walletIcons.drawMedallionBase(ctx, cx, cy, radius, rewardColor, !isFilled, stampShape);
        const prevAlpha = ctx.globalAlpha;
        if (!isFilled) ctx.globalAlpha = 0.4;

        if (rewardBitmap) {
          ctx.save();
          walletIcons.shapePath(ctx, stampShape, cx, cy, radius - 8);
          ctx.clip();
          ctx.drawImage(rewardBitmap, cx - (radius - 8), cy - (radius - 8), (radius - 8) * 2, (radius - 8) * 2);
          ctx.restore();
        } else if (rewardIconKey === 'gift') {
          walletIcons.drawGiftIcon(ctx, cx, cy, radius, inkColor);
        } else {
          walletIcons.drawStampGlyph(ctx, rewardIconKey, cx, cy, radius * 0.62, inkColor);
        }
        ctx.globalAlpha = prevAlpha;

        walletIcons.drawStarBadge(ctx, cx + radius * 0.72, cy - radius * 0.72, 19, rewardColor, !isFilled);
      } else if (isFilled) {
        // Selo conquistado: fundo na cor do cartão (contraste com o painel) e,
        // dentro dele, o número, o ícone ou a imagem — conforme o Estúdio.
        walletIcons.drawMedallionBase(ctx, cx, cy, radius, bgColor, false, stampShape);

        if (stampFill === 'image' && stampBitmap) {
          ctx.save();
          walletIcons.shapePath(ctx, stampShape, cx, cy, radius - 10);
          ctx.clip();
          ctx.drawImage(stampBitmap, cx - (radius - 10), cy - (radius - 10), (radius - 10) * 2, (radius - 10) * 2);
          ctx.restore();
        } else if (stampFill === 'number') {
          walletIcons.drawNumber(ctx, position, cx, cy, radius * 0.66, accentColor);
        } else {
          walletIcons.drawStampGlyph(ctx, stampIconKey, cx, cy, radius * 0.62, accentColor);
        }
      } else {
        walletIcons.drawEmptySlot(ctx, cx, cy, radius, inkColor, stampShape, accentColor);
        if (showNumbersOnEmpty) {
          walletIcons.drawNumber(ctx, position, cx, cy, radius * 0.58, walletIcons.withAlpha(inkColor, 0.55));
        }
      }
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Imutável: selos/meta/versão fazem parte da própria URL

    await PImage.encodePNGToStream(img, res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal error');
  }
});
