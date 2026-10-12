const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const { api, ISSUER_ID, SA, jwt } = require('./wallet');
const apple = require('./apple-wallet');
const { renderStampBanner } = require('./banner');
const { montarCamposDoPasse, paraTextModules, paraLabelValueRows, resolverCampos } = require('./pass-fields');
const notificacoes = require('./notificacoes');
const operadores = require('./operadores');
const planos = require('./planos');
const metricas = require('./metricas');
const unidades = require('./unidades');
const itens = require('./itens');

if (!admin.apps || !admin.apps.length) {
  admin.initializeApp();
}

/**
 * Quem está operando o balcão: o dono logado (sessão basta) ou um operador
 * pelo PIN, validado com limite de tentativas (ver operadores.js).
 *
 * Roda FORA da transação de propósito: um HttpsError lançado lá dentro
 * desfaria também o registro da tentativa errada, e o limite não valeria.
 */
async function autorizarBalcao(req, db, lojaId, pin, acao) {
  const claims = req.auth?.token || {};
  const dono = claims.role === 'admin' || (claims.role === 'lojista' && claims.lojaId === lojaId);
  if (dono) {
    const ident = await operadores.identificarOperador(db, lojaId, pin);
    return ident || { uid: req.auth.uid, operador: { nome: 'Lojista' } };
  }
  // Gerente de filial logado: opera o balcão da própria loja (a unidade
  // ativa é conferida em unidades.resolverAtendimento).
  if (claims.role === 'gerente' && claims.lojaId === lojaId) {
    return { uid: req.auth.uid, operador: { nome: claims.email ? `Gerente (${claims.email})` : 'Gerente' } };
  }
  if (!pin) {
    throw new HttpsError('permission-denied', `Entre como lojista ou informe o PIN do operador para ${acao}.`);
  }
  return operadores.verificarPin(db, lojaId, String(pin));
}

const FN_BASE = () =>
  `https://us-central1-${process.env.GCLOUD_PROJECT || 'mimo-2d6eb'}.cloudfunctions.net`;

/**
 * Domínios autorizados a acionar o link "Adicionar à Carteira" do Google.
 *
 * O `.web.app` e o domínio próprio servem o MESMO site de Hosting, então os
 * dois precisam constar: um cliente pode abrir a página de cadastro por
 * qualquer um dos dois e o Google valida a origem da requisição.
 */
const ORIGENS_PERMITIDAS = [
  'https://boomii-fidelidade.web.app',
  'https://www.boomii.com.br',
  'https://boomii.com.br',
  // Domínio da marca antiga: convites QR já impressos e links já distribuídos
  // apontam para cá, e a página de cadastro continua servida nesse endereço.
  // Remover só depois que esses convites saírem de circulação.
  'https://mimo-fidelidade.web.app',
  'http://localhost:5173',
];

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
  const camposDaClasse = resolverCampos(loja);
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
    // Rótulos do cabeçalho da carteira: também seguem o Estúdio, para o passe
    // não misturar os nomes do lojista com termos fixos nossos.
    accountNameLabel: camposDaClasse.cliente.label,
    accountIdLabel: 'CÓDIGO DO CARTÃO',
    rewardsTierLabel: camposDaClasse.status.label,
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
  const premio = loja.layout?.premio || loja.regras?.premio || '1 Recompensa Especial';
  const validadeDias = loja.layout?.validadeDias || loja.regras?.validadeDias || 30;
  const instrucaoResgate = loja.layout?.instrucaoResgate || 'Here you will see your of stamps';
  const passCode = `BOOMII-PASS-${snap.id.slice(-4).toUpperCase()}`;

  // Os campos vêm do que o lojista configurou no Estúdio (`design.fields`):
  // quais aparecem, em que ordem e com que rótulo. Antes eram fixos aqui, o que
  // fazia o passe real divergir da prévia.
  const campos = montarCamposDoPasse(loja, {
    nome: clienteNome,
    selos,
    meta,
    recompensa: premio,
    tagline: loja.design?.brand?.tagline || loja.layout?.nomePrograma || '',
    unidade: c.unidade,
    status: c.status === 'completo' ? 'Completo' : 'Ativo',
    ciclo: c.ciclo || 1,
    validadeDias,
  });

  const textModulesData = [
    ...paraTextModules(campos),
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
          value: 'Cartão Boomii'
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
    // Mesma lista de campos dos textModules, em duas colunas por linha.
    infoModuleData: {
      labelValueRows: paraLabelValueRows(campos),
    },
    barcode: {
      type: 'QR_CODE',
      value: `BOOMII:${snap.id}:${c.totpSecret ? authenticator.generate(c.totpSecret) : '8821'}`,
      alternateText: passCode,
    },
    linksModuleData: {
      uris: [
        {
          kind: 'walletobjects#uri',
          uri: 'https://boomii-fidelidade.web.app',
          description: 'Acessar Portal do Clube BOOMII'
        },
        {
          kind: 'walletobjects#uri',
          uri: `https://boomii-fidelidade.web.app/c/${loja.slug || snap.id.split('_')[0]}`,
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
    // O Google recusa o link "Adicionar à Carteira" se ele for acionado de um
    // domínio fora desta lista. Precisa conter TODO endereço de onde a página
    // de cadastro do cliente pode ser aberta — o .web.app e o domínio próprio
    // servem o mesmo site, então os dois entram aqui.
    origins: ORIGENS_PERMITIDAS,
    payload: {
      loyaltyClasses: [loyaltyClass],
      loyaltyObjects: [obj]
    },
  };

  let token = 'demo_token';
  try {
    token = jwt.sign(claims, saCredentials.private_key, { algorithm: 'RS256' });
  } catch {
    token = jwt.sign(claims, 'boomii_secret_key_demo');
  }

  return `https://pay.google.com/gp/v/save/${token}`;
}

/**
 * Ajusta o visual do cartão ao plano da loja.
 *
 * Essencial usa o modelo básico (ver planos.designBasico). O visual premium
 * não é perdido: vai para `designPlanoSuperior` e volta sozinho quando a loja
 * sobe de plano. Num downgrade, `financeiro.carenciaVisualAte` (gravado pelo
 * admin) segura o visual por 30 dias, para os clientes não verem o cartão
 * mudar de repente.
 *
 * Devolve true se gravou algo — a própria gravação dispara de novo o trigger
 * da loja, que então sincroniza o cartão com o visual já ajustado.
 */
async function aplicarVisualDoPlano(ref, loja) {
  const apagar = admin.firestore.FieldValue.delete();

  if (planos.temRecurso(loja, 'estudioCompleto')) {
    const backup = loja.designPlanoSuperior;
    if (!backup) return false;
    const atual = loja.design || {};
    // Volta o acabamento premium, sem desfazer o que foi editado no básico
    // (nome, logo, cores, quantidade de selos, texto do prêmio).
    const restaurado = {
      ...atual,
      stamps: { ...(backup.stamps || {}), total: atual.stamps?.total ?? backup.stamps?.total },
      reward: {
        ...(atual.reward || {}),
        iconKey: backup.reward?.iconKey,
        imageDataUrl: backup.reward?.imageDataUrl ?? null,
        color: backup.reward?.color,
      },
      fields: backup.fields || atual.fields,
      qr: backup.qr || atual.qr,
    };
    const upd = { design: restaurado, designPlanoSuperior: apagar };
    for (const [k, v] of Object.entries(loja.layoutPlanoSuperior || {})) upd[`layout.${k}`] = v;
    if (loja.layoutPlanoSuperior) upd.layoutPlanoSuperior = apagar;
    await ref.update(upd);
    console.log(`Visual premium restaurado para ${ref.id} (plano ${planos.planoDaLoja(loja)}).`);
    return true;
  }

  if (planos.visualDentroDoPlano(loja)) return false;
  if ((Number(loja.financeiro?.carenciaVisualAte) || 0) > Date.now()) return false;

  const upd = {};
  if (loja.design) {
    upd.design = planos.designBasico(loja.design);
    if (!loja.designPlanoSuperior) upd.designPlanoSuperior = loja.design;
  }
  const layoutGuardado = {};
  for (const k of planos.LAYOUT_PREMIUM) {
    if (loja.layout?.[k]) {
      layoutGuardado[k] = loja.layout[k];
      upd[`layout.${k}`] = apagar;
    }
  }
  if (Object.keys(layoutGuardado).length && !loja.layoutPlanoSuperior) upd.layoutPlanoSuperior = layoutGuardado;
  await ref.update(upd);
  console.log(`Visual de ${ref.id} ajustado ao plano Essencial (premium guardado).`);
  return true;
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

    // Visual fora do plano (ou premium para restaurar): ajusta e sai — a
    // gravação dispara este trigger de novo, que sincroniza o visual certo.
    if (await aplicarVisualDoPlano(event.data.after.ref, loja)) return;

    // Saiu do Completo: filiais extras ficam inativas (histórico mantido).
    try {
      const desativadas = await unidades.aplicarPlano(admin.firestore(), event.params.lojaId, loja);
      if (desativadas) console.log(`Plano sem filiais: ${desativadas} unidade(s) de ${event.params.lojaId} desativadas.`);
    } catch (err) {
      console.warn('Unidades: falha ao aplicar o plano', err.message);
    }

    // Guarda contra auto-disparo infinito: esta function grava 'wallet.classId' e
    // 'wallet.classSincronizadaEm' no próprio documento que a disparou. Sem esta
    // checagem, cada gravação reativa a function indefinidamente (e reprocessa o
    // PATCH de todos os cartões do lojista a cada ciclo).
    const versaoAntes = lojaAntes?.layout?.versao || lojaAntes?.wallet?.versao || lojaAntes?.design?.version;
    const versaoDepois = loja.layout?.versao || loja.wallet?.versao || loja.design?.version;
    const layoutMudou = JSON.stringify(lojaAntes?.layout || {}) !== JSON.stringify(loja.layout || {});
    const designMudou = JSON.stringify(lojaAntes?.design || {}) !== JSON.stringify(loja.design || {});
    const regrasMudou = JSON.stringify(lojaAntes?.regras || {}) !== JSON.stringify(loja.regras || {});
    const jaSincronizada = !!lojaAntes && versaoAntes === versaoDepois && !layoutMudou && !designMudou && !regrasMudou;
    if (jaSincronizada) return;

    const slug = (loja.slug || event.params.lojaId || 'loja').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const versao = loja.layout?.versao || loja.wallet?.versao || loja.design?.version || 'v3';
    const classId = loja.wallet?.classId || `${ISSUER_ID}.${slug}_${versao}`;

    const payload = montarLoyaltyClass(loja, slug, versao, classId);

    // Apple Wallet: o visual do passe é gerado na hora do download, então basta
    // avisar os iPhones que há versão nova — eles rebaixam o .pkpass sozinhos.
    try {
      const db = admin.firestore();
      const slugOuId = loja.slug || event.params.lojaId;
      const snaps = await Promise.all([
        db.collection('cartoes').where('lojaId', '==', slugOuId).get(),
        db.collection('cartoes').where('lojaId', '==', event.params.lojaId).get(),
      ]);
      const cardIds = new Set();
      snaps.forEach((s) => s.docs.forEach((d) => cardIds.add(d.id)));
      if (cardIds.size > 0) {
        await apple.notificarDispositivosApple([...cardIds]);
        console.log(`Apple Wallet: notificados ${cardIds.size} cartões sobre alteração no design da loja.`);
      }
    } catch (err) {
      console.warn('Apple Wallet: falha ao notificar novo design:', err.message);
    }

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
      const slugOuId = loja.slug || event.params.lojaId;
      const snaps = await Promise.all([
        db.collection('cartoes').where('lojaId', '==', slugOuId).get(),
        db.collection('cartoes').where('lojaId', '==', event.params.lojaId).get(),
      ]);
      const cardMap = new Map();
      snaps.forEach((s) => s.docs.forEach((d) => cardMap.set(d.id, d.data())));

      const patchPromises = Array.from(cardMap.entries()).map(async ([cartaoId, c]) => {
        if (!c.wallet?.objectId) return;
        const metaAtual = c.meta || loja.design?.stamps?.total || loja.regras?.meta || 10;
        const selosAtual = c.selos || 0;

        const objPatch = {
          heroImage: {
            sourceUri: {
              uri: `https://us-central1-${process.env.GCLOUD_PROJECT || 'mimo-2d6eb'}.cloudfunctions.net/generateBanner?lojaId=${slug}&selos=${selosAtual}&meta=${metaAtual}&v=${Date.now()}`
            },
            contentDescription: {
              defaultValue: {
                language: 'pt-BR',
                value: `Progresso do Ciclo: ${selosAtual} de ${metaAtual} selos`
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

    // Celular já cadastrado nesta loja: quem pede precisa provar que é o dono.
    //
    // Antes, qualquer pessoa que soubesse o celular de um cliente sobrescrevia
    // nome e e-mail dele e recebia de volta o link do cartão já existente —
    // com os selos e o prêmio daquele cliente, prontos para retirar no balcão.
    // Agora vale o SMS verificado (quando a loja exige) ou o e-mail do
    // primeiro cadastro, e os dados gravados não são mais sobrescritos por
    // aqui: correção de cadastro é com o lojista, pelo painel.
    const clienteRef = lojaRef.collection('clientes').doc(clienteId);
    const clienteSnap = await clienteRef.get();
    if (clienteSnap.exists) {
      const smsConfere = req.auth?.token?.phone_number === tel.number;
      const emailConfere = String(clienteSnap.get('email') || '').toLowerCase() === clientePayload.email;
      if (!smsConfere && !emailConfere) {
        throw new HttpsError(
          'already-exists',
          'Este celular já tem um cartão nesta loja. Para recuperá-lo, use o mesmo e-mail do primeiro cadastro ou peça ajuda no balcão.'
        );
      }
    } else {
      // O cadastro é da REDE (um link só): o cliente é da marca, não de uma
      // unidade. O que é por unidade é onde cada selo foi dado (carimbar).
      await clienteRef.set(clientePayload);
    }
    const dadosCliente = clienteSnap.exists ? clienteSnap.data() : clientePayload;

    // 2. Verifica se já existe cartão ativo para este cliente nesta loja
    const existente = await db.collection('cartoes')
      .where('lojaId', '==', lojaId)
      .where('clienteId', '==', clienteId)
      .where('status', 'in', ['ativo', 'completo'])
      .limit(1)
      .get();

    if (!existente.empty) {
      const cartaoSnap = existente.docs[0];
      const saveUrl = await gerarSaveUrl(cartaoSnap, loja, dadosCliente);
      // Cartões emitidos antes da Apple Wallet ganham o token na primeira consulta.
      const appleToken = await apple.garantirAuthToken(cartaoSnap.ref, cartaoSnap.data());
      return {
        cartaoId: cartaoSnap.id,
        jaExistia: true,
        selos: cartaoSnap.data().selos || 0,
        meta: cartaoSnap.data().meta || 10,
        status: cartaoSnap.data().status,
        saveUrl,
        applePassUrl: apple.urlDownloadPasse(cartaoSnap.id, appleToken),
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
      // Do cadastro gravado: num cliente já existente, o pedido não sobrescreve.
      clienteNome: dadosCliente.nome,
      clienteEmail: dadosCliente.email,
      clienteAniversario: dadosCliente.aniversario || null,
      clienteCelular: tel.number,
      // Onde o cliente se cadastrou (aparece no campo "Unidade" do passe).
      // Cartão da rede: o campo "Unidade" do passe mostra a marca.
      unidade: loja.nome || '',
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
      // Token exigido pela Apple em "Authorization: ApplePass <token>" nas
      // chamadas de registro/atualização feitas pelo iPhone.
      apple: { authToken: apple.novoAuthToken() },
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.doc(`cartoes/${cartaoId}`).set(cartaoData);

    const novoSnap = await db.doc(`cartoes/${cartaoId}`).get();
    const saveUrl = await gerarSaveUrl(novoSnap, loja, dadosCliente);

    return {
      cartaoId,
      jaExistia: false,
      selos: 0,
      meta,
      status: 'ativo',
      saveUrl,
      applePassUrl: apple.urlDownloadPasse(cartaoId, cartaoData.apple.authToken),
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
    const { qr, pin, lojaId: lojaIdParam, manualCardId, quantidade, unidadeId } = req.data || {};

    let cartaoId = manualCardId;
    let codigo = null;

    if (qr) {
      // Formato esperado: "BOOMII:cartaoId:123456".
      // O prefixo legado "MIMO:" continua aceito: os cartões emitidos antes da
      // troca de marca já estão nas carteiras dos clientes e não podem ser reemitidos.
      const partes = String(qr).trim().split(':');
      const prefixoValido = partes[0] === 'BOOMII' || partes[0] === 'MIMO';
      if (prefixoValido && partes.length >= 3) {
        cartaoId = partes[1];
        codigo = partes[2];
      } else if (partes.length === 2 && prefixoValido) {
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

    // A loja do cartão não muda; lida antes para autorizar fora da transação.
    const previa = await cartaoRef.get();
    if (!previa.exists) {
      throw new HttpsError('not-found', 'Cartão não encontrado.');
    }
    const { uid, operador } = await autorizarBalcao(
      req, db, previa.get('lojaId') || lojaIdParam, pin, 'registrar o selo'
    );
    // Unidade onde o carimbo acontece (gerente: a dele; dono: a escolhida).
    const lojaIdPrevia = previa.get('lojaId') || lojaIdParam;
    const lojaPrevia = (await db.doc(`lojistas/${lojaIdPrevia}`).get()).data() || {};
    const unidade = await unidades.resolverAtendimento(db, lojaIdPrevia, lojaPrevia, req.auth?.token, unidadeId);

    // Itens Fixos (Completo): a compra vem como lista de itens; os selos são
    // calculados aqui, a partir do cadastro — nunca vêm prontos do balcão.
    const porItens = itens.modoItens(lojaPrevia);
    const venda = porItens ? await itens.carregarVenda(db, lojaIdPrevia, req.data?.itens) : null;
    const mes = unidades.mesAtual();

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

      // Autorização (sessão do dono OU PIN de operador) já feita antes da
      // transação, em autorizarBalcao.

      // Validação do TOTP rotativo, quando o código vem da leitura do QR da Wallet.
      // NÃO bloqueia o carimbo: a Google Wallet não suporta atualizar a imagem do
      // barcode em tempo real sem Smart Tap/NFC, então um código "desatualizado" é
      // esperado — quem autoriza a operação é a sessão/PIN validados acima.
      if (codigo && cartao.totpSecret) {
        authenticator.options = { window: 2, step: 30 };
        const valido = authenticator.verify({ token: codigo, secret: cartao.totpSecret });
        if (!valido) {
          console.warn(`TOTP desatualizado para o cartão ${cartaoId} (aceito mesmo assim).`);
        }
      }

      if (cartao.status !== 'ativo') {
        throw new HttpsError('failed-precondition', `Este cartão já está com status "${cartao.status}".`);
      }

      // Compra só de itens que não dão selo (ex.: água): registra a venda
      // para o Mais Vendidos, sem mexer na cartela nem na trava de intervalo.
      if (venda && venda.selos === 0) {
        tx.set(cartaoRef.collection('eventos').doc(), {
          tipo: 'venda',
          operadorUid: uid,
          operadorNome: operador.nome || 'Balcão',
          itens: venda.itens,
          lojaId,
          unidadeId: unidade.id,
          unidadeNome: unidade.nome,
          em: admin.firestore.FieldValue.serverTimestamp(),
        });
        itens.contarVenda(tx, db, lojaId, unidade.id, mes, venda.itens);
        return {
          cartaoId,
          selos: cartao.selos || 0,
          meta: cartao.meta || 10,
          completo: false,
          creditados: 0,
          excedente: 0,
          selosPendentes: cartao.selosPendentes || 0,
          cliente: cartao.clienteId,
          premio: loja.layout?.premio || '1 Recompensa Especial',
        };
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

      // Quantos selos esta operação credita (uma compra pode valer vários).
      // O teto vem da configuração da loja e protege contra erro de digitação
      // do operador — sem ele, um "50" sem querer zeraria a cartela do cliente.
      const meta = cartao.meta || 10;
      // Vários selos numa leitura é recurso do Pro; no Essencial, 1 por leitura.
      const maxPorLeitura = planos.temRecurso(loja, 'variosSelosPorLeitura')
        ? Math.max(1, Number(loja.design?.stamps?.maxPerScan ?? loja.regras?.maxSelosPorLeitura ?? 10))
        : 1;
      // Por itens: a soma calculada no servidor. Vendas gerais: a quantidade do balcão.
      const pedido = venda
        ? venda.selos
        : Math.floor(Number(quantidade ?? loja.design?.stamps?.perScan ?? 1));

      if (!Number.isFinite(pedido) || pedido < 1) {
        throw new HttpsError('invalid-argument', 'Quantidade de selos inválida.');
      }
      if (pedido > maxPorLeitura) {
        throw new HttpsError(
          planos.temRecurso(loja, 'variosSelosPorLeitura') ? 'invalid-argument' : 'permission-denied',
          planos.temRecurso(loja, 'variosSelosPorLeitura')
            ? `Máximo de ${maxPorLeitura} selos por operação nesta loja.`
            : 'No plano Essencial, cada leitura credita 1 selo. Vários selos por compra estão disponíveis a partir do plano Pro.'
        );
      }

      const selosAntes = cartao.selos || 0;
      const espacoNaCartela = Math.max(0, meta - selosAntes);
      const creditados = Math.min(pedido, espacoNaCartela);
      // O que não coube não é perdido: fica reservado para o próximo ciclo,
      // aplicado automaticamente quando o prêmio for resgatado.
      const excedente = pedido - creditados;

      const novosSelos = selosAntes + creditados;
      const completo = novosSelos >= meta;
      const novoStatus = completo ? 'completo' : 'ativo';
      const pendentesTotal = (cartao.selosPendentes || 0) + excedente;

      // Notificação na carteira, gravada na mesma transação do selo: o trigger
      // atualizarPasse entrega para Apple e Google. Texto conforme o painel.
      const aviso = notificacoes.avisoDeSelo(loja, {
        selos: novosSelos,
        meta,
        creditados,
        nome: cartao.clienteNome,
      });

      tx.update(cartaoRef, {
        selos: novosSelos,
        status: novoStatus,
        selosPendentes: pendentesTotal,
        ultimoSeloEm: admin.firestore.FieldValue.serverTimestamp(),
        ...(aviso ? { aviso } : {}),
        // Base de cálculo do lembrete de prêmio não resgatado.
        ...(completo && cartao.status !== 'completo'
          ? { completoEm: admin.firestore.FieldValue.serverTimestamp(), lembretesEnviados: 0 }
          : {}),
      });

      // Espelha o progresso no doc do cliente (usado pelo CRM do lojista)
      if (cartao.clienteId) {
        tx.set(
          db.doc(`lojistas/${lojaId}/clientes/${cartao.clienteId}`),
          {
            stamps: novosSelos,
            status: novoStatus,
            lastVisit: new Date().toISOString(),
            // Onde o selo foi dado: é o que mostra na lista quando a compra
            // aconteceu numa unidade diferente da principal.
            ultimaUnidadeId: unidade.id,
            ultimaUnidadeNome: unidade.nome,
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
        quantidadeSolicitada: pedido,
        quantidadeCreditada: creditados,
        excedenteReservado: excedente,
        selosAntes,
        selosDepois: novosSelos,
        lojaId,
        unidadeId: unidade.id,
        unidadeNome: unidade.nome,
        ...(venda ? { itens: venda.itens } : {}),
        em: admin.firestore.FieldValue.serverTimestamp(),
      });
      unidades.contarCarimbo(tx, db, lojaId, unidade.id);
      if (venda) itens.contarVenda(tx, db, lojaId, unidade.id, mes, venda.itens);

      return {
        cartaoId,
        selos: novosSelos,
        meta,
        completo,
        creditados,
        excedente,
        selosPendentes: pendentesTotal,
        cliente: cartao.clienteId,
        premio: loja.layout?.premio || '1 Recompensa Especial',
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

    if (!depois) return;

    // Apple Wallet: push vazio via APNs; o iPhone então baixa o .pkpass atualizado
    // em /appleWallet/v1/passes/... Isolado em try próprio para que uma falha
    // da Apple nunca impeça a atualização da Google Wallet (e vice-versa).
    const mudouParaApple =
      antes?.selos !== depois.selos || antes?.status !== depois.status || antes?.ciclo !== depois.ciclo;
    // Aviso novo (selo, aniversário, lembrete) gravado em cartoes/{id}.aviso.
    const avisoMudou = !!depois.aviso?.id && antes?.aviso?.id !== depois.aviso.id;
    if (antes && (mudouParaApple || avisoMudou)) {
      try {
        await apple.notificarDispositivosApple([event.params.cartaoId]);
      } catch (err) {
        console.warn('Apple Wallet: falha no push:', err.message);
      }
    }

    const objectId = depois.wallet?.objectId;
    if (!objectId) return;

    // Google: atualiza o passe primeiro e só depois notifica, para o cliente
    // abrir a notificação e já ver o saldo novo.
    if (antes?.selos !== depois.selos) {
      await atualizarObjetoGoogle(event.params.cartaoId, depois, objectId);
    }
    if (avisoMudou) {
      await notificacoes.enviarAvisoGoogle(api, objectId, depois.aviso);
    }
  }
);

/** PATCH do objeto da Google Wallet com saldo, cartela e campos atuais. */
async function atualizarObjetoGoogle(cartaoId, depois, objectId) {
    try {
      const db = admin.firestore();
      const lojaDoc = await db.doc(`lojistas/${depois.lojaId}`).get();
      const loja = lojaDoc.data() || {};

      const clienteNome = depois.clienteNome || 'Cliente VIP';
      const meta = depois.meta || 10;
      const selos = depois.selos || 0;
      const faltam = Math.max(0, meta - selos);
      const premio = loja.layout?.premio || loja.regras?.premio || '1 Recompensa Especial';
      const validadeDias = loja.layout?.validadeDias || loja.regras?.validadeDias || 30;
      const instrucaoResgate = loja.layout?.instrucaoResgate || 'Apresente o QR Code no balcão a cada compra para creditar o selo.';

      // Este gatilho roda a cada selo e faz PATCH no objeto da carteira. Se os
      // campos fossem fixos aqui, o primeiro carimbo desfaria a personalização
      // aplicada na criação do passe — era o que acontecia.
      const campos = montarCamposDoPasse(loja, {
        nome: clienteNome,
        selos,
        meta,
        recompensa: premio,
        tagline: loja.design?.brand?.tagline || loja.layout?.nomePrograma || '',
        unidade: depois.unidade,
        status: depois.status === 'completo' ? 'Completo' : 'Ativo',
        ciclo: depois.ciclo || 1,
        validadeDias,
      });

      const textModulesData = [
        ...paraTextModules(campos),
        {
          id: 'regras_resgate',
          header: 'INSTRUÇÕES NO BALCÃO',
          body: `${instrucaoResgate} Validade de ${validadeDias} dias após completar os ${meta} selos.`,
        }
      ];

      await api('PATCH', `/loyaltyObject/${objectId}`, {
        loyaltyPoints: {
          localizedLabel: {
            defaultValue: {
              language: 'pt-BR',
              value: 'Cartão Boomii'
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
          labelValueRows: paraLabelValueRows(campos),
        },
        // Sem `messages` aqui: a mensagem com notificação vai por addMessage
        // (notificacoes.js), conforme o que o lojista configurou.
      });
      console.log(`Passe do cartão ${cartaoId} atualizado no Google Wallet com dados completos.`);
    } catch (err) {
      console.warn('Erro ao atualizar objeto no Google Wallet:', err.message);
    }
}

/**
 * 4.6 Resgate de prêmio e reciclagem de ciclo
 */
exports.resgatar = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const { cartaoId, pin, lojaId: lojaIdParam, unidadeId } = req.data || {};
    if (!cartaoId) throw new HttpsError('invalid-argument', 'cartaoId obrigatório.');

    const db = admin.firestore();
    const cartaoRef = db.doc(`cartoes/${cartaoId}`);

    const previa = await cartaoRef.get();
    if (!previa.exists) throw new HttpsError('not-found', 'Cartão não encontrado.');
    const { uid, operador } = await autorizarBalcao(
      req, db, previa.get('lojaId') || lojaIdParam, pin, 'resgatar o prêmio'
    );
    const lojaIdPrevia = previa.get('lojaId') || lojaIdParam;
    const lojaPrevia = (await db.doc(`lojistas/${lojaIdPrevia}`).get()).data() || {};
    const unidade = await unidades.resolverAtendimento(db, lojaIdPrevia, lojaPrevia, req.auth?.token, unidadeId);

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

      // Autorização (sessão do dono OU PIN) já feita antes da transação.

      const premio = loja.layout?.premio || '1 Recompensa Especial';

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
        unidadeId: unidade.id,
        unidadeNome: unidade.nome,
        em: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 2. Recicla o mesmo objeto na Google Wallet: avança o ciclo e já aplica
      // os selos que sobraram de uma compra maior que a cartela (ex.: cliente
      // com 8/10 comprou 5 de uma vez — os 3 excedentes entram no novo ciclo).
      const novoCiclo = (cartao.ciclo || 1) + 1;
      const metaCartao = cartao.meta || 10;
      const pendentes = cartao.selosPendentes || 0;
      const selosIniciais = Math.min(pendentes, metaCartao);
      const pendentesRestantes = Math.max(0, pendentes - selosIniciais);

      tx.update(cartaoRef, {
        selos: selosIniciais,
        ciclo: novoCiclo,
        status: selosIniciais >= metaCartao ? 'completo' : 'ativo',
        selosPendentes: pendentesRestantes,
        ultimoResgateEm: admin.firestore.FieldValue.serverTimestamp(),
        // Zera a contagem do lembrete para o próximo prêmio.
        completoEm: admin.firestore.FieldValue.delete(),
        lembretesEnviados: 0,
      });

      // Espelha o progresso no doc do cliente (usado pelo CRM do lojista)
      if (cartao.clienteId) {
        tx.set(
          db.doc(`lojistas/${lojaId}/clientes/${cartao.clienteId}`),
          {
            stamps: selosIniciais,
            status: selosIniciais >= metaCartao ? 'completo' : 'ativo',
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
        selosTransportados: selosIniciais,
        lojaId,
        unidadeId: unidade.id,
        unidadeNome: unidade.nome,
        em: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        sucesso: true,
        premio,
        novoCiclo,
        selosTransportados: selosIniciais,
        cliente: cartao.clienteId,
      };
    });
  }
);

/**
 * 8. Campanha automática de aniversário: selo(s) bônus + notificação na carteira.
 * Executa todos os dias às 08:00 (America/Sao_Paulo). Quantidade de selos e
 * texto vêm de lojistas/{id}.notificacoes.aniversario (ver notificacoes.js).
 */
exports.campanhaAniversario = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    const db = admin.firestore();
    // Data de hoje no fuso de São Paulo (o servidor roda em UTC).
    const partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const pegar = (t) => partes.find((p) => p.type === t).value;
    const ano = Number(pegar('year'));
    const hojeMMDD = `${pegar('month')}-${pegar('day')}`;

    console.log(`Executando campanha de aniversário para aniversariantes de ${hojeMMDD}...`);

    const lojistasSnap = await db.collection('lojistas').where('ativo', '==', true).get();

    for (const lojaDoc of lojistasSnap.docs) {
      const lojaId = lojaDoc.id;
      const loja = lojaDoc.data() || {};
      const cfg = notificacoes.resolverConfig(loja).aniversario;
      if (!cfg.ativo) continue;
      const bonusCfg = Math.max(0, Math.min(5, Number(cfg.bonus) || 0));

      const clientesAnivSnap = await lojaDoc.ref.collection('clientes')
        .where('aniversarioMMDD', '==', hojeMMDD)
        .get();

      for (const cDoc of clientesAnivSnap.docs) {
        const cartoesSnap = await db.collection('cartoes')
          .where('lojaId', '==', lojaId)
          .where('clienteId', '==', cDoc.id)
          .get();
        const cartaoDoc = cartoesSnap.docs.find((d) => ['ativo', 'completo'].includes(d.get('status')));
        if (!cartaoDoc) continue;

        const cartao = cartaoDoc.data();
        // Idempotente: se a função rodar duas vezes no dia, não dá bônus em dobro.
        if (cartao.aniversarioAno === ano) continue;

        const meta = cartao.meta || 10;
        const selosAntes = cartao.selos || 0;
        // Cartela já completa: só a mensagem (o bônus não caberia).
        const bonus = cartao.status === 'ativo' ? Math.min(bonusCfg, meta - selosAntes) : 0;
        const novosSelos = selosAntes + bonus;
        const completou = novosSelos >= meta && cartao.status !== 'completo';

        const aviso = notificacoes.avisoDeAniversario(loja, {
          selos: novosSelos,
          meta,
          bonus,
          nome: cartao.clienteNome || cDoc.get('nome'),
        });

        await cartaoDoc.ref.update({
          selos: novosSelos,
          status: novosSelos >= meta ? 'completo' : 'ativo',
          aniversarioAno: ano,
          ...(aviso ? { aviso } : {}),
          ...(completou
            ? { completoEm: admin.firestore.FieldValue.serverTimestamp(), lembretesEnviados: 0 }
            : {}),
        });

        // Espelha o progresso no doc do cliente (usado pelo CRM do lojista),
        // como carimbar e resgatar já fazem.
        if (bonus > 0) {
          await cDoc.ref.set(
            { stamps: novosSelos, status: novosSelos >= meta ? 'completo' : 'ativo' },
            { merge: true }
          );
        }

        await cartaoDoc.ref.collection('eventos').add({
          tipo: 'bonus_aniversario',
          selosAntes,
          selosDepois: novosSelos,
          em: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  }
);

/**
 * 9. Lembrete de prêmio não resgatado.
 * Todos os dias às 10:00 (America/Sao_Paulo): para cada cartela completa,
 * avisa a cada `dias` dias desde que completou, até `maxEnvios` vezes.
 */
exports.lembretePremio = onSchedule(
  { schedule: '0 10 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    const db = admin.firestore();
    const DIA = 24 * 60 * 60 * 1000;
    const agora = Date.now();
    const lojas = new Map();
    let enviados = 0;

    const completos = await db.collection('cartoes').where('status', '==', 'completo').get();

    for (const doc of completos.docs) {
      const cartao = doc.data();
      if (!lojas.has(cartao.lojaId)) {
        const s = await db.doc(`lojistas/${cartao.lojaId}`).get();
        lojas.set(cartao.lojaId, s.exists ? s.data() : null);
      }
      const loja = lojas.get(cartao.lojaId);
      if (!loja || loja.ativo === false) continue;

      const cfg = notificacoes.resolverConfig(loja).lembrete;
      if (!cfg.ativo) continue;
      const intervalo = Math.max(1, Number(cfg.dias) || 3);
      const maxEnvios = Math.max(1, Number(cfg.maxEnvios) || 1);
      const jaEnviados = cartao.lembretesEnviados || 0;
      if (jaEnviados >= maxEnvios) continue;

      // Cartões completados antes desta versão não têm completoEm.
      const base = cartao.completoEm?.toMillis?.() || cartao.ultimoSeloEm?.toMillis?.();
      if (!base) continue;
      const dias = Math.floor((agora - base) / DIA);
      if (dias < intervalo * (jaEnviados + 1)) continue;

      const aviso = notificacoes.avisoDeLembrete(loja, {
        selos: cartao.selos,
        meta: cartao.meta,
        dias,
        nome: cartao.clienteNome,
      });
      if (!aviso) continue;

      await doc.ref.update({
        aviso,
        lembretesEnviados: jaEnviados + 1,
        ultimoLembreteEm: admin.firestore.FieldValue.serverTimestamp(),
      });
      enviados++;
    }
    console.log(`Lembrete de prêmio: ${enviados} aviso(s) gerado(s) de ${completos.size} cartela(s) completa(s).`);
  }
);

/**
 * Normaliza a data de aniversário aceita na edição.
 *
 * Aceita "AAAA-MM-DD" ou "MM-DD" (o cadastro grava nos dois formatos, conforme
 * o cliente tenha informado o ano). Devolve `undefined` se for inválida e
 * `{ aniversario: null, mmdd: null }` se vier vazia — limpar é permitido.
 */
function normalizarAniversario(valor) {
  const v = String(valor || '').trim();
  if (!v) return { aniversario: null, mmdd: null };
  let ano = null;
  let mes;
  let dia;
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    ano = Number(m[1]); mes = Number(m[2]); dia = Number(m[3]);
  } else if ((m = v.match(/^(\d{2})-(\d{2})$/))) {
    mes = Number(m[1]); dia = Number(m[2]);
  } else {
    return undefined;
  }
  // Ano bissexto como referência para aceitar 29/02 quando o ano é omitido.
  const ref = new Date(Date.UTC(ano || 2000, mes - 1, dia));
  if (ref.getUTCMonth() !== mes - 1 || ref.getUTCDate() !== dia) return undefined;
  if (ano && (ano < 1900 || ref.getTime() > Date.now())) return undefined;
  const mmdd = `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  return { aniversario: ano ? `${ano}-${mmdd}` : mmdd, mmdd };
}

/**
 * Edição dos dados de um cliente pelo painel do lojista.
 *
 * O celular não é editável: ele é o ID do cliente e compõe o ID do cartão e o
 * ID do objeto na Google Wallet — trocá-lo exigiria migrar tudo isso.
 *
 * Nome, e-mail e aniversário ficam copiados em cada cartão (`clienteNome`...),
 * e o nome aparece no passe. Por isso a edição atualiza o cliente, todos os
 * cartões dele nesta loja e, por fim, as carteiras: a Google por API e os
 * iPhones por push, para baixarem o passe com o nome novo.
 */
/**
 * Loja sobre a qual o pedido pode agir. Lojista mexe só na própria loja (o
 * lojaId vem do token, não do pedido); admin pode agir em qualquer uma.
 */
function lojaDoPedido(claims, lojaIdParam, acao, permiteGerente = false) {
  let lojaId;
  if (claims.role === 'admin') {
    lojaId = lojaIdParam;
  } else if (claims.role === 'lojista' || (permiteGerente && claims.role === 'gerente')) {
    // Gerente de filial: só operações de balcão (carimbo, resgate, ficha,
    // reenvio) — nunca gestão (editar/excluir, planilha, unidades, visual).
    lojaId = claims.lojaId;
    if (lojaIdParam && lojaIdParam !== lojaId) {
      throw new HttpsError('permission-denied', `Você só pode ${acao} clientes da sua loja.`);
    }
  } else {
    throw new HttpsError('unauthenticated', `Entre como lojista para ${acao} clientes.`);
  }
  return lojaId;
}

exports.editarCliente = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const claims = req.auth?.token || {};
    const { lojaId: lojaIdParam, clienteId, nome, email, aniversario } = req.data || {};

    const lojaId = lojaDoPedido(claims, lojaIdParam, 'editar');
    if (!lojaId || !clienteId) {
      throw new HttpsError('invalid-argument', 'Loja e cliente são obrigatórios.');
    }

    const nomeLimpo = String(nome || '').trim().replace(/\s+/g, ' ');
    if (nomeLimpo.length < 2 || nomeLimpo.length > 80) {
      throw new HttpsError('invalid-argument', 'Informe o nome do cliente (de 2 a 80 caracteres).');
    }
    const emailLimpo = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailLimpo)) {
      throw new HttpsError('invalid-argument', 'E-mail inválido.');
    }
    const aniv = normalizarAniversario(aniversario);
    if (aniv === undefined) {
      throw new HttpsError('invalid-argument', 'Data de aniversário inválida.');
    }

    const db = admin.firestore();
    const lojaSnap = await db.doc(`lojistas/${lojaId}`).get();
    if (!lojaSnap.exists) throw new HttpsError('not-found', 'Loja não encontrada.');
    const loja = lojaSnap.data() || {};

    const clienteRef = db.doc(`lojistas/${lojaId}/clientes/${clienteId}`);
    const clienteSnap = await clienteRef.get();
    if (!clienteSnap.exists) throw new HttpsError('not-found', 'Cliente não encontrado nesta loja.');
    const antes = clienteSnap.data() || {};

    const cartoesSnap = await db.collection('cartoes')
      .where('lojaId', '==', lojaId)
      .where('clienteId', '==', clienteId)
      .get();

    // Cliente e cópias nos cartões no mesmo lote: ou tudo muda, ou nada muda.
    const lote = db.batch();
    lote.update(clienteRef, {
      nome: nomeLimpo,
      email: emailLimpo,
      aniversario: aniv.aniversario,
      aniversarioMMDD: aniv.mmdd,
      atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      editadoPor: req.auth.uid,
    });
    cartoesSnap.docs.forEach((d) => {
      lote.update(d.ref, {
        clienteNome: nomeLimpo,
        clienteEmail: emailLimpo,
        clienteAniversario: aniv.aniversario,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    lote.set(db.collection('auditoria').doc(), {
      tipo: 'cliente_editado',
      lojaId,
      clienteId,
      por: req.auth.uid,
      papel: claims.role,
      antes: { nome: antes.nome || null, email: antes.email || null, aniversario: antes.aniversario || null },
      depois: { nome: nomeLimpo, email: emailLimpo, aniversario: aniv.aniversario },
      em: admin.firestore.FieldValue.serverTimestamp(),
    });
    await lote.commit();

    // Carteiras: tolerante a falha. Os dados já foram gravados; se a Google ou
    // a Apple não responderem agora, o passe se corrige no próximo carimbo.
    const vigentes = cartoesSnap.docs.filter((d) => ['ativo', 'completo'].includes(d.get('status')));
    let carteirasAtualizadas = true;
    for (const d of vigentes) {
      try {
        await gerarSaveUrl(await d.ref.get(), loja, null);
      } catch (err) {
        carteirasAtualizadas = false;
        console.warn('editarCliente: falha ao atualizar a Google Wallet', d.id, err.message);
      }
    }
    try {
      await apple.notificarDispositivosApple(vigentes.map((d) => d.id));
    } catch (err) {
      carteirasAtualizadas = false;
      console.warn('editarCliente: falha no push da Apple', err.message);
    }

    return {
      sucesso: true,
      cliente: {
        nome: nomeLimpo,
        email: emailLimpo,
        aniversario: aniv.aniversario,
        aniversarioMMDD: aniv.mmdd,
      },
      carteirasAtualizadas,
    };
  }
);

/**
 * Exclui um cliente da loja.
 *
 * O cadastro some e os cartões perdem os dados pessoais, mas ficam como
 * "excluido" em vez de apagados: o iPhone ainda precisa baixar o passe uma
 * última vez para vê-lo como inválido, e o documento é o que responde a esse
 * download. O cartão na Google Wallet passa a INACTIVE (a API não apaga
 * objetos). Se o cliente se cadastrar de novo, criarCartao recria o cartão
 * do zero no mesmo ID.
 */
exports.excluirCliente = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const claims = req.auth?.token || {};
    const { lojaId: lojaIdParam, clienteId } = req.data || {};

    const lojaId = lojaDoPedido(claims, lojaIdParam, 'excluir');
    if (!lojaId || !clienteId) {
      throw new HttpsError('invalid-argument', 'Loja e cliente são obrigatórios.');
    }

    const db = admin.firestore();
    const clienteRef = db.doc(`lojistas/${lojaId}/clientes/${clienteId}`);
    const clienteSnap = await clienteRef.get();
    if (!clienteSnap.exists) throw new HttpsError('not-found', 'Cliente não encontrado nesta loja.');

    const cartoesSnap = await db.collection('cartoes')
      .where('lojaId', '==', lojaId)
      .where('clienteId', '==', clienteId)
      .get();

    const agora = admin.firestore.FieldValue.serverTimestamp();
    const apagar = admin.firestore.FieldValue.delete();
    const lote = db.batch();
    lote.delete(clienteRef);
    cartoesSnap.docs.forEach((d) => {
      // A mudança de status dispara atualizarPasse, que avisa o iPhone.
      lote.update(d.ref, {
        status: 'excluido',
        statusAnterior: d.get('status') || null,
        clienteNome: apagar,
        clienteEmail: apagar,
        clienteAniversario: apagar,
        clienteCelular: apagar,
        totpSecret: apagar,
        aviso: apagar,
        excluidoEm: agora,
        atualizadoEm: agora,
      });
    });
    // Sem dados pessoais na auditoria: a exclusão precisa valer de verdade.
    lote.set(db.collection('auditoria').doc(), {
      tipo: 'cliente_excluido',
      lojaId,
      clienteId,
      cartoes: cartoesSnap.size,
      por: req.auth.uid,
      papel: claims.role,
      em: agora,
    });
    await lote.commit();

    let carteirasAtualizadas = true;
    for (const d of cartoesSnap.docs) {
      const objectId = d.get('wallet')?.objectId;
      if (!objectId || d.get('status') === 'excluido') continue;
      try {
        await api('PATCH', `/loyaltyObject/${objectId}`, { state: 'INACTIVE' });
      } catch (err) {
        // 404: o cliente nunca salvou o passe na Google Wallet.
        if (err.response?.status !== 404) {
          carteirasAtualizadas = false;
          console.warn('excluirCliente: falha ao desativar na Google Wallet', d.id, err.message);
        }
      }
    }

    return { sucesso: true, carteirasAtualizadas };
  }
);

/**
 * Ficha do cliente (plano Pro+): métricas e linha do tempo de visitas,
 * selos e resgates, a partir do histórico de eventos do cartão.
 */
exports.fichaCliente = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const { lojaId: lojaIdParam, clienteId } = req.data || {};
  const lojaId = lojaDoPedido(claims, lojaIdParam, 'ver');
  if (!lojaId || !clienteId) throw new HttpsError('invalid-argument', 'Loja e cliente são obrigatórios.');

  const db = admin.firestore();
  const loja = (await db.doc(`lojistas/${lojaId}`).get()).data() || {};
  planos.exigirRecurso(loja, 'fichaCliente', 'A ficha do cliente');
  unidades.exigirGerenteNoPlano(claims, loja);

  const clienteSnap = await db.doc(`lojistas/${lojaId}/clientes/${clienteId}`).get();
  if (!clienteSnap.exists) throw new HttpsError('not-found', 'Cliente não encontrado nesta loja.');

  const { cartoes, eventos } = await metricas.carregarHistorico(db, lojaId, clienteId);
  return {
    metricas: metricas.calcularMetricas(clienteSnap.data(), cartoes, eventos),
    linhaDoTempo: metricas.linhaDoTempo(eventos),
  };
});

/**
 * Planilha com as métricas de todos os clientes (plano Completo).
 *
 * Contém dados pessoais: só o dono da loja (ou admin) baixa, e cada download
 * fica registrado na auditoria com quem baixou, quando e o período.
 */
exports.exportarClientes = onCall(
  { region: 'southamerica-east1', timeoutSeconds: 300, memory: '512MiB' },
  async (req) => {
    const claims = req.auth?.token || {};
    const { lojaId: lojaIdParam, desde, ate } = req.data || {};
    const lojaId = lojaDoPedido(claims, lojaIdParam, 'exportar');
    if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');

    const db = admin.firestore();
    const lojaSnap = await db.doc(`lojistas/${lojaId}`).get();
    if (!lojaSnap.exists) throw new HttpsError('not-found', 'Loja não encontrada.');
    planos.exigirRecurso(lojaSnap.data(), 'exportarClientes', 'A planilha de clientes');

    const periodo = {
      desde: Number(desde) || 0,
      ate: Number(ate) || 0 || undefined,
    };

    const clientesSnap = await db.collection(`lojistas/${lojaId}/clientes`).get();
    const linhas = [];
    // Em lotes, para não abrir centenas de consultas ao mesmo tempo.
    for (let i = 0; i < clientesSnap.docs.length; i += 15) {
      const lote = clientesSnap.docs.slice(i, i + 15);
      const calculados = await Promise.all(
        lote.map(async (d) => {
          const { cartoes, eventos } = await metricas.carregarHistorico(db, lojaId, d.id);
          return metricas.calcularMetricas(d.data(), cartoes, eventos, periodo);
        })
      );
      linhas.push(...calculados);
    }
    linhas.sort((a, b) => (b.ultimaVisita || 0) - (a.ultimaVisita || 0));

    await db.collection('auditoria').add({
      tipo: 'clientes_exportados',
      lojaId,
      total: linhas.length,
      periodo: { desde: periodo.desde || null, ate: periodo.ate || null },
      por: req.auth.uid,
      papel: claims.role,
      em: admin.firestore.FieldValue.serverTimestamp(),
    });

    const hoje = new Date().toISOString().slice(0, 10);
    return {
      csv: metricas.paraCSV(linhas),
      total: linhas.length,
      nomeArquivo: `clientes-${lojaId}-${hoje}.csv`,
    };
  }
);

// ─── Unidades (filiais) e gerentes ───────────────────────────────────────────
//
// Cadastro de filiais: exclusivo do Completo (o admin pode sempre). Limite =
// financeiro.unidadesContratadas (Completo inclui 1, + R$ 79/mês por extra).
// Unidade criada pelo lojista além do contratado fica "aguardando" até o admin
// liberar — é o admin quem controla a cobrança.

async function carregarLoja(db, lojaId) {
  const snap = await db.doc(`lojistas/${lojaId}`).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Loja não encontrada.');
  return snap.data() || {};
}

async function contarAtivas(db, lojaId, excetoId) {
  const snap = await unidades.colecao(db, lojaId).where('status', '==', 'ativa').get();
  return snap.docs.filter((d) => d.id !== excetoId).length;
}

/** Admin ampliou o limite: grava as unidades contratadas e a nova mensalidade. */
async function ampliarContratadas(db, lojaId, loja, novoTotal) {
  const plano = planos.planoDaLoja(loja);
  await db.doc(`lojistas/${lojaId}`).set(
    { financeiro: { unidadesContratadas: novoTotal, valorMensal: unidades.mensalidade(plano, novoTotal) } },
    { merge: true }
  );
}

exports.listarUnidades = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'ver as unidades de', true);
  if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  unidades.exigirGerenteNoPlano(claims, loja);
  const lista = await unidades.listar(db, lojaId, loja);
  const mes = unidades.mesAtual();
  const plano = planos.planoDaLoja(loja);
  const contratadas = unidades.contratadas(loja);
  // Gerente vê só a própria unidade.
  const visiveis = claims.role === 'gerente' ? lista.filter((u) => u.id === claims.unidadeId) : lista;
  return {
    plano,
    contratadas,
    mensalidade: unidades.mensalidade(plano, contratadas),
    unidades: visiveis.map((u) => ({
      id: u.id,
      nome: u.nome || '',
      endereco: u.endereco || '',
      cidade: u.cidade || '',
      whatsapp: u.whatsapp || '',
      principal: !!u.principal,
      status: u.status || 'ativa',
      motivoInativa: u.motivoInativa || null,
      gerenteEmail: u.gerenteEmail || null,
      // Cadastro é da rede; por unidade só faz sentido o movimento (selos dados ali).
      carimbosMes: Number(u.contagem?.carimbos?.[mes]) || 0,
      carimbosMesAnterior: Number(u.contagem?.carimbos?.[mesAnterior(mes)]) || 0,
    })),
  };
});

/** "2026-10" → "2026-09"; "2026-01" → "2025-12". */
function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * Busca de cliente para o gerente de filial ("terminal de balcão").
 *
 * O gerente não lê a base de clientes da loja (as regras do banco não deixam):
 * ele só precisa achar o cliente para dar ou resgatar selos. Por isso esta
 * busca devolve o mínimo — primeiro nome com a inicial do sobrenome, celular
 * mascarado e os selos —, nunca e-mail, aniversário ou celular completo.
 */
exports.buscarClientesBalcao = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'atender clientes de', true);
  if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  unidades.exigirGerenteNoPlano(claims, loja);

  const termo = String(req.data?.termo || '').trim().toLowerCase();
  const digitos = termo.replace(/\D/g, '');
  if (termo.length < 2 && digitos.length < 3) return { clientes: [] };

  const snap = await db.collection(`lojistas/${lojaId}/clientes`).get();
  const achados = snap.docs
    .filter((d) => {
      const nome = String(d.get('nome') || '').toLowerCase();
      const cel = String(d.get('celular') || '').replace(/\D/g, '');
      return (termo.length >= 2 && nome.includes(termo)) || (digitos.length >= 3 && cel.includes(digitos));
    })
    .slice(0, 8)
    .map((d) => {
      const partes = String(d.get('nome') || 'Cliente').trim().split(/\s+/);
      const nome = partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1][0]}.` : partes[0];
      const cel = String(d.get('celular') || '').replace(/\D/g, '');
      return {
        id: d.id,
        nome,
        celularMascarado: cel.length >= 4 ? `(••) •••••-${cel.slice(-4)}` : '',
        selos: Number(d.get('stamps') ?? d.get('selos')) || 0,
        meta: Number(d.get('meta')) || Number(loja.design?.stamps?.total) || Number(loja.regras?.meta) || 10,
      };
    });
  return { clientes: achados };
});

exports.salvarUnidade = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'gerenciar as unidades de');
  if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');
  const ehAdmin = claims.role === 'admin';
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  const dados = unidades.validarDados(req.data || {});
  const unidadeId = req.data?.unidadeId ? String(req.data.unidadeId) : null;

  // Edição (a principal pode ser renomeada em qualquer plano).
  if (unidadeId) {
    if (!ehAdmin && unidadeId !== unidades.PRINCIPAL) planos.exigirRecurso(loja, 'filiais', 'O cadastro de filiais');
    const r = unidades.ref(db, lojaId, unidadeId);
    if (!(await r.get()).exists) throw new HttpsError('not-found', 'Unidade não encontrada.');
    await r.update({ ...dados, atualizadaEm: admin.firestore.FieldValue.serverTimestamp() });
    return { sucesso: true, id: unidadeId };
  }

  // Criação
  if (!ehAdmin) planos.exigirRecurso(loja, 'filiais', 'O cadastro de filiais');
  await unidades.garantirPrincipal(db, lojaId, loja);
  const ativas = await contarAtivas(db, lojaId);
  const contratadas = unidades.contratadas(loja);
  const status = 'ativa';
  if (ativas >= contratadas) {
    // Só o admin amplia o contrato. O lojista não cria além do liberado —
    // antes a unidade ficava "aguardando"; agora o limite é respeitado.
    if (!ehAdmin) {
      throw new HttpsError(
        'resource-exhausted',
        `Seu plano tem ${contratadas} ${contratadas === 1 ? 'unidade contratada' : 'unidades contratadas'} e todas estão em uso. ` +
          `Para abrir mais uma (+ R$ ${planos.PRECOS.unidadeExtra}/mês), fale com a equipe Boomii.`
      );
    }
    await ampliarContratadas(db, lojaId, loja, ativas + 1);
  }
  const id = await unidades.novoId(db, lojaId, dados.nome);
  await unidades.ref(db, lojaId, id).set({
    ...dados,
    principal: false,
    status,
    criadaEm: admin.firestore.FieldValue.serverTimestamp(),
    criadaPor: req.auth.uid,
  });
  await unidades.atualizarResumo(db, lojaId);
  return { sucesso: true, id, status };
});

exports.alterarStatusUnidade = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'gerenciar as unidades de');
  const unidadeId = String(req.data?.unidadeId || '');
  const ativar = !!req.data?.ativa;
  if (!lojaId || !unidadeId) throw new HttpsError('invalid-argument', 'Loja e unidade são obrigatórias.');
  if (unidadeId === unidades.PRINCIPAL && !ativar) {
    throw new HttpsError('failed-precondition', 'A unidade principal não pode ser desativada.');
  }
  const ehAdmin = claims.role === 'admin';
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  if (!ehAdmin) planos.exigirRecurso(loja, 'filiais', 'O cadastro de filiais');
  const r = unidades.ref(db, lojaId, unidadeId);
  if (!(await r.get()).exists) throw new HttpsError('not-found', 'Unidade não encontrada.');

  if (ativar) {
    const ativas = await contarAtivas(db, lojaId, unidadeId);
    const contratadas = unidades.contratadas(loja);
    if (ativas >= contratadas) {
      if (!ehAdmin) {
        throw new HttpsError(
          'resource-exhausted',
          `Seu plano tem ${contratadas} ${contratadas === 1 ? 'unidade contratada' : 'unidades contratadas'}. ` +
            `Peça à Boomii a liberação de mais uma (+ R$ ${planos.PRECOS.unidadeExtra}/mês).`
        );
      }
      await ampliarContratadas(db, lojaId, loja, ativas + 1);
    }
  }
  await r.update({
    status: ativar ? 'ativa' : 'inativa',
    motivoInativa: ativar ? admin.firestore.FieldValue.delete() : 'manual',
    atualizadaEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  await unidades.atualizarResumo(db, lojaId);
  return { sucesso: true };
});

/**
 * Exclui uma unidade (filial). A principal não sai.
 *
 * O histórico não se perde: cada selo guarda o NOME da unidade onde foi dado,
 * então a ficha e a lista do cliente continuam mostrando "em Cidade Nova". O
 * gerente da unidade perde o acesso na hora. O contrato (unidades contratadas)
 * não muda sozinho — reduzir a cobrança é decisão do admin.
 */
exports.excluirUnidade = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'excluir as unidades de');
  const unidadeId = String(req.data?.unidadeId || '');
  if (!lojaId || !unidadeId) throw new HttpsError('invalid-argument', 'Loja e unidade são obrigatórias.');
  if (unidadeId === unidades.PRINCIPAL) {
    throw new HttpsError('failed-precondition', 'A unidade principal não pode ser excluída.');
  }
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  if (claims.role !== 'admin') planos.exigirRecurso(loja, 'filiais', 'O cadastro de filiais');

  const r = unidades.ref(db, lojaId, unidadeId);
  const snap = await r.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Unidade não encontrada.');

  const gerenteUid = snap.get('gerenteUid');
  if (gerenteUid) {
    await admin.auth().setCustomUserClaims(gerenteUid, null).catch(() => {});
    await admin.auth().revokeRefreshTokens(gerenteUid).catch(() => {});
  }
  await r.delete();
  await unidades.atualizarResumo(db, lojaId);
  await db.collection('auditoria').add({
    tipo: 'unidade_excluida',
    lojaId,
    unidadeId,
    unidadeNome: snap.get('nome') || '',
    tinhaGerente: !!gerenteUid,
    por: req.auth.uid,
    papel: claims.role,
    em: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { sucesso: true };
});

/** Admin libera uma unidade que o lojista criou além do contratado. */
exports.aprovarUnidade = onCall({ region: 'southamerica-east1' }, async (req) => {
  if (req.auth?.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Só o administrador da Boomii libera unidades extras.');
  }
  const { lojaId, unidadeId } = req.data || {};
  if (!lojaId || !unidadeId) throw new HttpsError('invalid-argument', 'Loja e unidade são obrigatórias.');
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  const r = unidades.ref(db, lojaId, String(unidadeId));
  const snap = await r.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Unidade não encontrada.');

  const ativas = await contarAtivas(db, lojaId, snap.id);
  const novoTotal = Math.max(unidades.contratadas(loja), ativas + 1);
  await ampliarContratadas(db, lojaId, loja, novoTotal);
  await r.update({ status: 'ativa', aprovadaEm: admin.firestore.FieldValue.serverTimestamp(), aprovadaPor: req.auth.uid });
  await unidades.atualizarResumo(db, lojaId);
  await db.collection('auditoria').add({
    tipo: 'unidade_aprovada',
    lojaId,
    unidadeId: snap.id,
    unidadesContratadas: novoTotal,
    por: req.auth.uid,
    em: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { sucesso: true, unidadesContratadas: novoTotal };
});

/**
 * Convida o gerente de uma unidade: cria (ou reaproveita) a conta e grava as
 * claims role=gerente + lojaId + unidadeId. A senha ele mesmo cria pelo link
 * de redefinição — o painel dispara o e-mail e também mostra o link para
 * mandar pelo WhatsApp.
 */
exports.convidarGerente = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'convidar gerentes para');
  const unidadeId = String(req.data?.unidadeId || '');
  const email = String(req.data?.email || '').trim().toLowerCase();
  if (!lojaId || !unidadeId) throw new HttpsError('invalid-argument', 'Loja e unidade são obrigatórias.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new HttpsError('invalid-argument', 'E-mail inválido.');

  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  if (claims.role !== 'admin') planos.exigirRecurso(loja, 'filiais', 'O gerente de filial');
  const r = unidades.ref(db, lojaId, unidadeId);
  const unidadeSnap = await r.get();
  if (!unidadeSnap.exists) throw new HttpsError('not-found', 'Unidade não encontrada.');
  if (unidadeSnap.get('status') !== 'ativa') throw new HttpsError('failed-precondition', 'Ative a unidade antes de convidar o gerente.');

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    const atuais = user.customClaims || {};
    if (atuais.role === 'admin' || atuais.role === 'lojista') {
      throw new HttpsError('already-exists', 'Este e-mail já é usado por um lojista ou administrador. Use outro.');
    }
    if (atuais.role === 'gerente' && atuais.lojaId !== lojaId) {
      throw new HttpsError('already-exists', 'Este e-mail já é gerente em outra loja.');
    }
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    if (err.code !== 'auth/user-not-found') throw err;
    user = await admin.auth().createUser({ email, password: crypto.randomBytes(24).toString('base64url') });
  }

  // Um gerente por unidade: o anterior perde o acesso.
  const anterior = unidadeSnap.get('gerenteUid');
  if (anterior && anterior !== user.uid) {
    await admin.auth().setCustomUserClaims(anterior, null).catch(() => {});
    await admin.auth().revokeRefreshTokens(anterior).catch(() => {});
  }
  await admin.auth().setCustomUserClaims(user.uid, { role: 'gerente', lojaId, unidadeId });
  await r.update({ gerenteEmail: email, gerenteUid: user.uid, gerenteDesde: admin.firestore.FieldValue.serverTimestamp() });

  let link = null;
  try {
    link = await admin.auth().generatePasswordResetLink(email);
  } catch (err) {
    console.warn('convidarGerente: link de senha não gerado', err.message);
  }
  await db.collection('auditoria').add({
    tipo: 'gerente_convidado',
    lojaId,
    unidadeId,
    gerenteUid: user.uid,
    por: req.auth.uid,
    em: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { sucesso: true, link };
});

exports.removerGerente = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'gerenciar os gerentes de');
  const unidadeId = String(req.data?.unidadeId || '');
  if (!lojaId || !unidadeId) throw new HttpsError('invalid-argument', 'Loja e unidade são obrigatórias.');
  const db = admin.firestore();
  const r = unidades.ref(db, lojaId, unidadeId);
  const snap = await r.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Unidade não encontrada.');
  const uid = snap.get('gerenteUid');
  if (uid) {
    await admin.auth().setCustomUserClaims(uid, null).catch(() => {});
    await admin.auth().revokeRefreshTokens(uid).catch(() => {});
  }
  const apagar = admin.firestore.FieldValue.delete();
  await r.update({ gerenteEmail: apagar, gerenteUid: apagar, gerenteDesde: apagar });
  return { sucesso: true };
});

// ─── Itens Fixos e Mais Vendidos (plano Completo) ────────────────────────────

/**
 * Itens da loja com as vendas de um mês (padrão: o atual). Serve o cadastro,
 * a lista de itens do leitor e o ranking "Mais Vendidos".
 */
exports.listarItens = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'ver os itens de', true);
  if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  unidades.exigirGerenteNoPlano(claims, loja);

  const mes = /^\d{4}-\d{2}$/.test(String(req.data?.mes || '')) ? req.data.mes : unidades.mesAtual();
  const permitido = planos.temRecurso(loja, 'itensFixos');
  if (!permitido) return { permitido, modalidade: 'geral', mes, itens: [] };

  const snap = await itens.colecao(db, lojaId).get();
  const lista = snap.docs
    .map((d) => {
      const v = d.data() || {};
      const porUnidade = {};
      for (const [u, meses] of Object.entries(v.vendasPorUnidade || {})) porUnidade[u] = Number(meses?.[mes]) || 0;
      return {
        id: d.id,
        nome: v.nome || '',
        categoria: v.categoria || 'Geral',
        preco: v.preco ?? null,
        selos: Number(v.selos) || 0,
        ativo: v.ativo !== false,
        vendasMes: Number(v.vendas?.[mes]) || 0,
        vendasTotal: Object.values(v.vendas || {}).reduce((s, n) => s + (Number(n) || 0), 0),
        vendasMesPorUnidade: porUnidade,
      };
    })
    .sort((a, b) => b.vendasMes - a.vendasMes || a.nome.localeCompare(b.nome));
  return { permitido, modalidade: itens.modoItens(loja) ? 'itens' : 'geral', mes, itens: lista };
});

exports.salvarItem = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'cadastrar itens de');
  if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  planos.exigirRecurso(loja, 'itensFixos', 'Os Itens Fixos');

  const dados = itens.validarDados(req.data || {});
  const ativo = req.data?.ativo !== false;
  const itemId = req.data?.itemId ? String(req.data.itemId) : null;
  if (itemId) {
    const r = itens.colecao(db, lojaId).doc(itemId);
    if (!(await r.get()).exists) throw new HttpsError('not-found', 'Item não encontrado.');
    await r.update({ ...dados, ativo, atualizadoEm: admin.firestore.FieldValue.serverTimestamp() });
    return { sucesso: true, id: itemId };
  }
  const r = await itens.colecao(db, lojaId).add({
    ...dados,
    ativo,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { sucesso: true, id: r.id };
});

/** Exclui só item que nunca vendeu — com vendas, pause (o histórico fica). */
exports.excluirItem = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'excluir itens de');
  const itemId = String(req.data?.itemId || '');
  if (!lojaId || !itemId) throw new HttpsError('invalid-argument', 'Loja e item são obrigatórios.');
  const db = admin.firestore();
  const r = itens.colecao(db, lojaId).doc(itemId);
  const snap = await r.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Item não encontrado.');
  const vendas = Object.values(snap.get('vendas') || {}).reduce((s, n) => s + (Number(n) || 0), 0);
  if (vendas > 0) {
    throw new HttpsError('failed-precondition', 'Este item já tem vendas registradas. Pause-o em vez de excluir, para manter o histórico.');
  }
  await r.delete();
  return { sucesso: true };
});

/** Vendas Gerais (qualquer compra = selos do seletor) ou Itens Fixos. */
exports.definirModalidade = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const lojaId = lojaDoPedido(claims, req.data?.lojaId, 'configurar');
  const modalidade = req.data?.modalidade === 'itens' ? 'itens' : 'geral';
  if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');
  const db = admin.firestore();
  const loja = await carregarLoja(db, lojaId);
  if (modalidade === 'itens') {
    planos.exigirRecurso(loja, 'itensFixos', 'Os Itens Fixos');
    const ativos = await itens.colecao(db, lojaId).where('ativo', '==', true).limit(1).get();
    if (ativos.empty) {
      throw new HttpsError('failed-precondition', 'Cadastre ao menos um item ativo antes de ativar os Itens Fixos.');
    }
  }
  await db.doc(`lojistas/${lojaId}`).set({ regras: { modalidade } }, { merge: true });
  return { sucesso: true, modalidade };
});

/**
 * Reenvio do cartão para um cliente que trocou de aparelho.
 *
 * Antes a saída era emitir um cartão novo, e o cliente perdia o histórico.
 * O lojista gera aqui um link de uso exclusivo daquele cliente; o link abre
 * a página /r/{token}, que oferece "Adicionar à Apple/Google Wallet" do MESMO
 * cartão — mesmos selos, mesmo ciclo.
 *
 * Segurança: só o dono da loja (ou admin) gera; o token é aleatório (192
 * bits), vale REENVIO_DIAS dias e a página só revela o primeiro nome. Não
 * reabre a falha do cadastro: quem não tem o link não chega ao cartão.
 */
const REENVIO_DIAS = 7;

exports.gerarLinkReenvio = onCall({ region: 'southamerica-east1' }, async (req) => {
  const claims = req.auth?.token || {};
  const { lojaId: lojaIdParam, clienteId } = req.data || {};
  const lojaId = lojaDoPedido(claims, lojaIdParam, 'reenviar o cartão de');
  if (!lojaId || !clienteId) {
    throw new HttpsError('invalid-argument', 'Loja e cliente são obrigatórios.');
  }

  const db = admin.firestore();
  if (claims.role === 'gerente') unidades.exigirGerenteNoPlano(claims, await carregarLoja(db, lojaId));
  const cartoesSnap = await db.collection('cartoes')
    .where('lojaId', '==', lojaId)
    .where('clienteId', '==', String(clienteId))
    .get();
  const cartao = cartoesSnap.docs.find((d) => ['ativo', 'completo'].includes(d.get('status')));
  if (!cartao) {
    throw new HttpsError('failed-precondition', 'Este cliente não tem um cartão ativo para reenviar.');
  }

  const token = crypto.randomBytes(24).toString('base64url');
  const expiraEm = Date.now() + REENVIO_DIAS * 24 * 60 * 60 * 1000;
  await db.doc(`reenvios/${token}`).set({
    cartaoId: cartao.id,
    lojaId,
    clienteId: String(clienteId),
    expiraEm,
    criadoPor: req.auth.uid,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    usos: 0,
  });
  await db.collection('auditoria').add({
    tipo: 'cartao_reenviado',
    lojaId,
    clienteId: String(clienteId),
    cartaoId: cartao.id,
    por: req.auth.uid,
    papel: claims.role,
    em: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { token, expiraEm, dias: REENVIO_DIAS };
});

/** Página pública /r/{token}: devolve os links das carteiras do cartão. */
exports.abrirLinkReenvio = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const token = String(req.data?.token || '');
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) {
      throw new HttpsError('not-found', 'Link inválido.');
    }
    const db = admin.firestore();
    const reenvioRef = db.doc(`reenvios/${token}`);
    const reenvio = await reenvioRef.get();
    if (!reenvio.exists) throw new HttpsError('not-found', 'Link inválido.');
    if (reenvio.get('expiraEm') < Date.now()) {
      throw new HttpsError('deadline-exceeded', 'Este link expirou. Peça um novo na loja.');
    }

    const cartaoRef = db.doc(`cartoes/${reenvio.get('cartaoId')}`);
    const cartaoSnap = await cartaoRef.get();
    const cartao = cartaoSnap.data();
    if (!cartaoSnap.exists || !['ativo', 'completo'].includes(cartao?.status)) {
      throw new HttpsError('failed-precondition', 'Este cartão não está mais ativo. Fale com a loja.');
    }
    const loja = (await db.doc(`lojistas/${cartao.lojaId}`).get()).data() || {};

    const saveUrl = await gerarSaveUrl(cartaoSnap, loja, null);
    const appleToken = await apple.garantirAuthToken(cartaoRef, cartao);
    await reenvioRef.update({
      usos: admin.firestore.FieldValue.increment(1),
      ultimoUsoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      lojaNome: loja.nome || 'Loja',
      corDestaque: loja.design?.colors?.accent || loja.layout?.accentColor || null,
      primeiroNome: String(cartao.clienteNome || '').trim().split(/\s+/)[0] || '',
      selos: cartao.selos || 0,
      meta: cartao.meta || 10,
      saveUrl,
      applePassUrl: apple.urlDownloadPasse(cartaoSnap.id, appleToken),
      expiraEm: reenvio.get('expiraEm'),
    };
  }
);

/**
 * Tira de uma vez os PINs de operador que ainda estão no documento público
 * das lojas (só admin). Sem isso eles saem loja a loja, no primeiro uso.
 */
exports.migrarPinsOperadores = onCall({ region: 'southamerica-east1' }, async (req) => {
  if (req.auth?.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Apenas o administrador pode migrar os PINs.');
  }
  const migradas = await operadores.migrarTodas(admin.firestore());
  return { sucesso: true, migradas };
});

/**
 * A mesma limpeza, sozinha, a cada hora: roda pela primeira vez logo após o
 * deploy e depois só pega o que um admin eventualmente gravar no lugar antigo.
 * Lê apenas os documentos das lojas — custo desprezível.
 */
/**
 * Fim da carência de visual após um downgrade: sem isso, o visual premium só
 * seria ajustado na próxima vez que alguém gravasse a loja.
 */
exports.aplicarPlanosAgendado = onSchedule(
  { schedule: '0 3 * * *', timeZone: 'America/Sao_Paulo' },
  async () => {
    const snap = await admin.firestore().collection('lojistas').get();
    let ajustadas = 0;
    for (const d of snap.docs) {
      if (await aplicarVisualDoPlano(d.ref, d.data() || {})) ajustadas++;
    }
    if (ajustadas) console.log(`Planos: visual ajustado em ${ajustadas} loja(s).`);
  }
);

exports.limparPinsPublicos = onSchedule(
  { schedule: 'every 60 minutes', timeZone: 'America/Sao_Paulo' },
  async () => {
    const migradas = await operadores.migrarTodas(admin.firestore());
    if (migradas) console.log(`PINs públicos removidos de ${migradas} loja(s).`);
  }
);

/**
 * 10. Disparo manual de notificação para a carteira de um cliente (botões do painel).
 */
exports.dispararNotificacaoManual = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const { lojaId: lojaIdParam, clienteId, tipo } = req.data || {};
    if (!clienteId || !tipo) {
      throw new HttpsError('invalid-argument', 'clienteId e tipo obrigatórios.');
    }
    // Antes aceitava o lojaId do pedido sem exigir login: qualquer pessoa
    // disparava avisos para clientes de qualquer loja.
    const claims = req.auth?.token || {};
    const db = admin.firestore();
    const lojaId = lojaDoPedido(claims, lojaIdParam, 'notificar');
    if (!lojaId) throw new HttpsError('invalid-argument', 'Loja não identificada.');

    const lojaSnap = await db.doc(`lojistas/${lojaId}`).get();
    if (!lojaSnap.exists) throw new HttpsError('not-found', 'Loja não encontrada.');
    const loja = lojaSnap.data() || {};
    planos.exigirRecurso(loja, 'envioManual', 'O envio manual de avisos');

    // Busca o cartão ativo ou completo do cliente
    const cartoesSnap = await db.collection('cartoes')
      .where('lojaId', '==', lojaId)
      .where('clienteId', '==', clienteId)
      .get();

    const cartaoDoc = cartoesSnap.docs.find((d) => ['ativo', 'completo'].includes(d.get('status')));
    if (!cartaoDoc) {
      throw new HttpsError('not-found', 'Nenhum cartão ativo ou completo encontrado para este cliente.');
    }

    const cartao = cartaoDoc.data();
    let aviso = null;
    if (tipo === 'aniversario') {
      aviso = notificacoes.avisoDeAniversario(loja, {
        selos: cartao.selos || 0,
        meta: cartao.meta || 10,
        bonus: 0,
        nome: cartao.clienteNome,
      });
    } else if (tipo === 'recompensa') {
      const agora = Date.now();
      const base = cartao.completoEm?.toMillis?.() || cartao.ultimoSeloEm?.toMillis?.() || agora;
      const dias = Math.max(0, Math.floor((agora - base) / (24 * 60 * 60 * 1000)));
      aviso = notificacoes.avisoDeLembrete(loja, {
        selos: cartao.selos || 0,
        meta: cartao.meta || 10,
        dias,
        nome: cartao.clienteNome,
      });
    }

    if (!aviso) {
      throw new HttpsError('failed-precondition', 'Não foi possível gerar a notificação (canal desativado nas configurações da loja).');
    }

    await cartaoDoc.ref.update({ aviso });

    return { sucesso: true, aviso };
  }
);


// Endpoint Dinâmico 1: Retorna o Logotipo da Loja
//
// Ordem de precedência: o logo enviado no Estúdio (design.brand.logoDataUrl),
// depois o campo legado layout.logoBase64 e, por fim, uma URL externa já
// cadastrada. Antes esta função só olhava o campo legado — por isso o logo
// enviado pelo lojista no Estúdio nunca aparecia no cartão da carteira.
exports.getLogo = onRequest({ cors: true, memory: '512MiB' }, async (req, res) => {
  const lojaId = req.query.lojaId;
  if (!lojaId) return res.status(400).send('lojaId required');
  try {
    const db = admin.firestore();
    const docSnap = await db.doc(`lojistas/${lojaId}`).get();
    if (!docSnap.exists) return res.status(404).send('Not found');

    const data = docSnap.data() || {};
    const layout = data.layout || {};
    const design = data.design || null;

    const base64 = design?.brand?.logoDataUrl || layout.logoBase64;
    if (base64 && String(base64).includes('base64,')) {
      const b64Data = String(base64).split(',')[1];
      const buffer = Buffer.from(b64Data, 'base64');
      const isSvg = String(base64).includes('image/svg');
      const isJpeg = String(base64).includes('jpeg') || String(base64).includes('jpg');
      res.setHeader('Content-Type', isSvg ? 'image/svg+xml' : isJpeg ? 'image/jpeg' : 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache no Wallet
      // O arquivo vem do lojista: SVG pode carregar <script>. Aberto direto no
      // navegador, a CSP em sandbox impede que ele execute; como <img> nada muda.
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
      return res.send(buffer);
    }

    // Sem upload: usa a URL externa cadastrada, se houver
    const urlExterna = design?.brand?.logoUrl || layout.logoUrl;
    if (urlExterna && String(urlExterna).startsWith('http') && !String(urlExterna).includes('boomii-logo.jpg')) {
      return res.redirect(urlExterna);
    }
  } catch (err) {
    console.error(err);
  }
  // Fallback genérico se falhar
  res.redirect('https://boomii-fidelidade.web.app/logos/loja.jpg');
});

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

    // Desenho compartilhado com o strip.png da Apple Wallet (ver banner.js).
    const img = await renderStampBanner(docSnap.data() || {}, selos, req.query.meta, 1032, 336);

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Imutável: selos/meta/versão fazem parte da própria URL

    await PImage.encodePNGToStream(img, res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal error');
  }
});

/**
 * Prévia do passe Apple para o Estúdio de Marca.
 *
 * Devolve a faixa (cartela) e o logo renderizados pelo MESMO código que monta o
 * .pkpass real, a partir do design ainda não publicado. É o que garante que o
 * lojista veja na prévia exatamente os pixels que vão para o iPhone — antes a
 * prévia era desenhada no navegador e divergia do cartão real.
 */
exports.previaPasseApple = onCall(
  { region: 'southamerica-east1', memory: '512MiB' },
  async (req) => {
    // Renderização pesada: só para quem edita um cartão, não para a internet.
    const papel = req.auth?.token?.role;
    if (papel !== 'admin' && papel !== 'lojista') {
      throw new HttpsError('unauthenticated', 'Entre como lojista para ver a prévia.');
    }
    const design = req.data?.design;
    if (!design || typeof design !== 'object') {
      throw new HttpsError('invalid-argument', 'Design ausente.');
    }
    const selos = Math.max(0, Math.min(30, parseInt(req.data?.selos, 10) || 0));

    const { renderFaixaApple, renderLogoApple, pngDataUrl } = require('./passe-apple-imagens');
    const loja = { design };
    const iconePadrao = await apple.carregarIconePadrao();
    const [faixa, logo] = await Promise.all([
      renderFaixaApple(loja, selos, design?.stamps?.total, 2),
      renderLogoApple(loja, 2, iconePadrao),
    ]);
    return { faixa: await pngDataUrl(faixa), logo: await pngDataUrl(logo) };
  }
);

/**
 * Apple Wallet (iOS): download do .pkpass e Web Service de registro/atualização
 * chamado pelo próprio iPhone. URL base = webServiceURL do pass.json.
 * Ver apple-wallet.js para o protocolo completo.
 */
exports.appleWallet = onRequest(
  { memory: '512MiB', timeoutSeconds: 60, cors: true },
  apple.handler
);
