# Mimo Fidelidade — Etapa 2

**Escopo:** cadastro de clientes, emissão do cartão na Google Wallet e acúmulo de selos por escaneamento do lojista.

**Decisões travadas:**
- Só Google Wallet nesta etapa (Apple Wallet fica para a etapa 3)
- O lojista escaneia o QR do cliente para carimbar
- Cadastro coleta: nome, celular, e-mail e data de aniversário

**Stack:** Firebase Hosting (já existe) + Firestore + Cloud Functions 2ª geração (Node 20) + Google Wallet API.

---

## 0. Pré-requisitos de conta

| Item | Onde | Observação |
|---|---|---|
| Plano Blaze | Console Firebase | Obrigatório: Functions precisam de rede externa para chamar a Wallet API |
| Issuer ID | [Google Pay & Wallet Console](https://pay.google.com/business/console) | Peça acesso de emissor; a aprovação para produção leva alguns dias. Em modo demo você já testa |
| Wallet API habilitada | Google Cloud Console | "Google Wallet API" no mesmo projeto do Firebase |
| Service Account | IAM | Papel: nenhum no GCP. Você precisa **autorizar o e-mail da service account dentro do Wallet Console**, em Usuários |
| Chave privada | Secret Manager | Nunca no repositório. Guarde como `WALLET_SA_KEY` |

> Enquanto o emissor não é aprovado, os passes funcionam normalmente mas só nas contas Google que você adicionar como testadoras.

---

## 1. Modelo de dados (Firestore)

### `lojistas/{lojaId}`
```js
{
  nome: "Padaria da Ana",
  slug: "padaria-da-ana",          // usado na URL pública de cadastro
  ativo: true,
  layout: {
    corFundo: "#1B4332",
    corTexto: "#FFFFFF",
    logoUrl: "https://.../logo.png",     // 660x660 recomendado
    heroUrl: "https://.../capa.png",     // 1032x336
    nomePrograma: "Clube da Ana",
    premio: "1 café grátis"
  },
  regras: {
    meta: 10,                       // selos para completar
    intervaloMinimoMin: 30,         // trava anti-duplo-carimbo
    maxSelosDiaPorCliente: 2,
    validadeDias: 180               // null = não expira
  },
  wallet: {
    classId: "3388000000012345678.padaria-da-ana",
    classSincronizadaEm: Timestamp
  },
  operadores: {
    "uid_do_dono": { nome: "Ana", pin: "hash", papel: "dono" },
    "uid_balcao":  { nome: "Balcão 1", pin: "hash", papel: "operador" }
  },
  criadoEm: Timestamp
}
```

### `lojistas/{lojaId}/clientes/{clienteId}`
`clienteId` = celular normalizado em E.164 sem o `+` (ex.: `5511987654321`). Isso mata duplicidade de graça.

```js
{
  nome: "João Silva",
  celular: "+5511987654321",
  email: "joao@email.com",
  aniversario: "1990-03-14",        // string ISO; ano opcional
  consentimento: {
    aceito: true,
    versaoTermo: "v1",
    em: Timestamp,
    ip: "187.x.x.x"
  },
  origem: "qr-balcao",
  criadoEm: Timestamp
}
```

### `cartoes/{cartaoId}`
`cartaoId` = `{lojaId}_{clienteId}_{ciclo}` — o ciclo permite o cliente recomeçar depois de resgatar.

```js
{
  lojaId, clienteId, ciclo: 1,
  selos: 3,
  meta: 10,
  status: "ativo",                  // ativo | completo | resgatado | expirado
  totpSecret: "BASE32...",          // segredo do QR rotativo (só o servidor lê)
  wallet: {
    objectId: "3388000000012345678.5511987654321-c1",
    ultimaSync: Timestamp
  },
  ultimoSeloEm: Timestamp,
  expiraEm: Timestamp,
  criadoEm: Timestamp
}
```

### `cartoes/{cartaoId}/eventos/{eventoId}`
Log imutável. É o que resolve discussão de balcão.
```js
{ tipo: "selo", operadorUid, operadorNome, selosAntes: 2, selosDepois: 3, em: Timestamp }
```

### `resgates/{resgateId}`
```js
{ lojaId, clienteId, cartaoId, premio: "1 café grátis", operadorUid, em: Timestamp }
```

### Índices compostos necessários
- `cartoes`: `lojaId` ASC + `status` ASC + `ultimoSeloEm` DESC (listagem no painel)
- `cartoes`: `lojaId` ASC + `clienteId` ASC + `ciclo` DESC

---

## 2. Regras de segurança

Princípio: **cliente e lojista nunca escrevem em `cartoes`**. Toda mutação passa por Function.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function autenticado() { return request.auth != null; }
    function ehOperador(lojaId) {
      return autenticado() &&
        get(/databases/$(database)/documents/lojistas/$(lojaId)).data.operadores[request.auth.uid] != null;
    }

    match /lojistas/{lojaId} {
      allow read: if true;                        // layout público p/ página de cadastro
      allow write: if ehOperador(lojaId);

      match /clientes/{clienteId} {
        allow read: if ehOperador(lojaId);
        allow write: if false;                    // só Functions
      }
    }

    match /cartoes/{cartaoId} {
      // cliente lê o próprio cartão; operador lê os da loja dele
      allow read: if autenticado() && (
        resource.data.clienteId == request.auth.token.phone_number.replace('+','') ||
        ehOperador(resource.data.lojaId)
      );
      allow write: if false;                      // só Functions

      match /eventos/{eventoId} {
        allow read: if ehOperador(get(/databases/$(database)/documents/cartoes/$(cartaoId)).data.lojaId);
        allow write: if false;
      }
    }

    match /resgates/{id} {
      allow read: if ehOperador(resource.data.lojaId);
      allow write: if false;
    }
  }
}
```

---

## 3. Fluxo de cadastro do cliente

```
QR fixo no balcão / link no Instagram
        ↓
mimo-fidelidade.web.app/c/{slug}
        ↓
Formulário: nome · celular · e-mail · aniversário · [✓] aceito os termos
        ↓
Firebase Phone Auth (SMS de 6 dígitos)     ← recomendado
        ↓
Function  criarCartao()
        ↓
Tela "Pronto!" + botão Adicionar à Google Wallet
```

**Sobre a verificação:** você listou os campos mas não travou o método. Minha recomendação é **SMS no celular**. Motivos: o celular é a chave primária do cliente, o SMS impede alguém cadastrar 40 números falsos para farmar selos, e o Firebase dá 10 mil verificações/mês antes de cobrar. Se quiser reduzir atrito no lançamento, deixe `regras.exigirSMS: false` no lojista e ligue depois — o código abaixo já suporta os dois modos.

**Aniversário:** guarde como `MM-DD` num campo separado (`aniversarioMMDD`) para conseguir consultar "quem faz aniversário hoje" sem varrer a coleção. Serve para a campanha de selo-bônus de aniversário, que é o gancho comercial mais forte desse tipo de app.

---

## 4. Cloud Functions

### 4.1 Setup

```bash
firebase init functions   # Node 20, TypeScript ou JS
cd functions
npm i googleapis jsonwebtoken otplib libphonenumber-js
firebase functions:secrets:set WALLET_SA_KEY   # cole o JSON inteiro da service account
```

`functions/wallet.js` — cliente da Wallet API:

```js
const { GoogleAuth } = require('google-auth-library');
const jwt = require('jsonwebtoken');

const ISSUER_ID = process.env.WALLET_ISSUER_ID;
const SA = () => JSON.parse(process.env.WALLET_SA_KEY);
const BASE = 'https://walletobjects.googleapis.com/walletobjects/v1';

async function client() {
  const auth = new GoogleAuth({
    credentials: SA(),
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });
  return auth.getClient();
}

async function api(method, path, body) {
  const c = await client();
  const res = await c.request({ url: `${BASE}${path}`, method, data: body });
  return res.data;
}
module.exports = { api, ISSUER_ID, SA, jwt };
```

### 4.2 Sincronizar a classe da loja

Roda quando o lojista salva o layout. Uma classe por loja.

```js
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { api, ISSUER_ID } = require('./wallet');

exports.sincronizarClasse = onDocumentWritten(
  { document: 'lojistas/{lojaId}', secrets: ['WALLET_SA_KEY'] },
  async (event) => {
    const loja = event.data.after.data();
    if (!loja) return;

    const classId = `${ISSUER_ID}.${loja.slug}`;
    const payload = {
      id: classId,
      issuerName: loja.nome,
      programName: loja.layout.nomePrograma,
      programLogo: { sourceUri: { uri: loja.layout.logoUrl } },
      heroImage: loja.layout.heroUrl ? { sourceUri: { uri: loja.layout.heroUrl } } : undefined,
      hexBackgroundColor: loja.layout.corFundo,
      reviewStatus: 'UNDER_REVIEW',
      // rótulo do contador que aparece no cartão
      accountNameLabel: 'Cliente',
      rewardsTierLabel: 'Prêmio',
    };

    try { await api('GET', `/loyaltyClass/${classId}`); await api('PUT', `/loyaltyClass/${classId}`, payload); }
    catch { await api('POST', '/loyaltyClass', payload); }

    await event.data.after.ref.update({
      'wallet.classId': classId,
      'wallet.classSincronizadaEm': new Date(),
    });
  }
);
```

### 4.3 Criar cliente + cartão + link do passe

```js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { authenticator } = require('otplib');
const { parsePhoneNumber } = require('libphonenumber-js');
const admin = require('firebase-admin');
const { api, ISSUER_ID, SA, jwt } = require('./wallet');

exports.criarCartao = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    const { lojaId, nome, celular, email, aniversario, consentimento } = req.data;
    if (!consentimento) throw new HttpsError('failed-precondition', 'Consentimento obrigatório');

    const tel = parsePhoneNumber(celular, 'BR');
    if (!tel?.isValid()) throw new HttpsError('invalid-argument', 'Celular inválido');
    const clienteId = tel.number.replace('+', '');

    const db = admin.firestore();
    const lojaRef = db.doc(`lojistas/${lojaId}`);
    const loja = (await lojaRef.get()).data();
    if (!loja?.ativo) throw new HttpsError('not-found', 'Loja indisponível');

    // se exigirSMS, o token do Phone Auth precisa bater com o celular informado
    if (loja.regras.exigirSMS && req.auth?.token?.phone_number !== tel.number) {
      throw new HttpsError('permission-denied', 'Celular não verificado');
    }

    await lojaRef.collection('clientes').doc(clienteId).set({
      nome, email,
      celular: tel.number,
      aniversario: aniversario || null,
      aniversarioMMDD: aniversario ? aniversario.slice(5) : null,
      consentimento: { aceito: true, versaoTermo: 'v1', em: new Date() },
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // reaproveita cartão ativo se já existir
    const existente = await db.collection('cartoes')
      .where('lojaId', '==', lojaId).where('clienteId', '==', clienteId)
      .where('status', 'in', ['ativo', 'completo']).limit(1).get();
    if (!existente.empty) return { saveUrl: await gerarSaveUrl(existente.docs[0], loja) };

    const ciclo = 1;
    const cartaoId = `${lojaId}_${clienteId}_${ciclo}`;
    const objectId = `${ISSUER_ID}.${clienteId}-c${ciclo}`;

    await db.doc(`cartoes/${cartaoId}`).set({
      lojaId, clienteId, ciclo,
      selos: 0, meta: loja.regras.meta, status: 'ativo',
      totpSecret: authenticator.generateSecret(),
      wallet: { objectId },
      criadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    const snap = await db.doc(`cartoes/${cartaoId}`).get();
    return { cartaoId, saveUrl: await gerarSaveUrl(snap, loja) };
  }
);
```

### 4.4 Montar o objeto e o link "Adicionar à Google Wallet"

O QR rotativo usa **TOTP nativo da Wallet**: o Google gera o código no celular do cliente, offline, trocando a cada 30s. O servidor valida com o mesmo segredo. Não dá para printar e reusar.

```js
async function gerarSaveUrl(snap, loja) {
  const c = snap.data();
  const obj = {
    id: c.wallet.objectId,
    classId: loja.wallet.classId,
    state: 'ACTIVE',
    accountId: c.clienteId,
    accountName: loja.layout.nomePrograma,
    loyaltyPoints: {
      label: 'Selos',
      balance: { string: `${c.selos} de ${c.meta}` },
    },
    textModulesData: [
      { header: 'Seu prêmio', body: loja.layout.premio, id: 'premio' },
      { header: 'Faltam', body: `${c.meta - c.selos} selo(s)`, id: 'faltam' },
    ],
    rotatingBarcode: {
      type: 'QR_CODE',
      valuePattern: `MIMO:${snap.id}:{totp_value_0}`,
      totpDetails: {
        algorithm: 'TOTP_SHA1',
        periodMillis: '30000',
        parameters: [{ key: Buffer.from(c.totpSecret).toString('base64'), valueLength: 6 }],
      },
      alternateText: 'Mostre este código no caixa',
    },
  };

  try { await api('GET', `/loyaltyObject/${obj.id}`); await api('PUT', `/loyaltyObject/${obj.id}`, obj); }
  catch { await api('POST', '/loyaltyObject', obj); }

  const claims = {
    iss: SA().client_email,
    aud: 'google',
    typ: 'savetowallet',
    origins: ['https://mimo-fidelidade.web.app'],
    payload: { loyaltyObjects: [{ id: obj.id }] },
  };
  const token = jwt.sign(claims, SA().private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}
```

No front, o botão oficial:
```html
<a href="{saveUrl}">
  <img src="https://developers.google.com/static/wallet/images/add-to-google-wallet-badges/pt_br_add_to_google_wallet_add-wallet-badge.png"
       alt="Adicionar à Google Wallet" height="48">
</a>
```

### 4.5 Carimbar o selo

```js
const { authenticator } = require('otplib');

exports.carimbar = onCall(
  { secrets: ['WALLET_SA_KEY'], region: 'southamerica-east1' },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Faça login');
    const { qr, pin } = req.data;                  // qr = "MIMO:cartaoId:123456"

    const [prefixo, cartaoId, codigo] = String(qr).split(':');
    if (prefixo !== 'MIMO' || !cartaoId || !codigo) throw new HttpsError('invalid-argument', 'QR inválido');

    const db = admin.firestore();
    const cartaoRef = db.doc(`cartoes/${cartaoId}`);

    return db.runTransaction(async (tx) => {
      const cartao = (await tx.get(cartaoRef)).data();
      if (!cartao) throw new HttpsError('not-found', 'Cartão não encontrado');

      const loja = (await tx.get(db.doc(`lojistas/${cartao.lojaId}`))).data();
      const op = loja.operadores?.[req.auth.uid];
      if (!op) throw new HttpsError('permission-denied', 'Você não opera esta loja');
      if (!verificaPin(pin, op.pin)) throw new HttpsError('permission-denied', 'PIN incorreto');

      // TOTP com janela de ±1 período, tolera relógio dessincronizado
      authenticator.options = { window: 1, step: 30 };
      if (!authenticator.verify({ token: codigo, secret: cartao.totpSecret })) {
        throw new HttpsError('permission-denied', 'Código expirado. Peça para o cliente abrir o cartão de novo.');
      }

      if (cartao.status !== 'ativo') throw new HttpsError('failed-precondition', `Cartão ${cartao.status}`);

      const agora = Date.now();
      const ultimo = cartao.ultimoSeloEm?.toMillis() ?? 0;
      const minMs = (loja.regras.intervaloMinimoMin ?? 30) * 60000;
      if (agora - ultimo < minMs) {
        throw new HttpsError('failed-precondition', 'Este cartão já recebeu um selo há pouco.');
      }

      const selos = cartao.selos + 1;
      const status = selos >= cartao.meta ? 'completo' : 'ativo';

      tx.update(cartaoRef, { selos, status, ultimoSeloEm: new Date() });
      tx.set(cartaoRef.collection('eventos').doc(), {
        tipo: 'selo', operadorUid: req.auth.uid, operadorNome: op.nome,
        selosAntes: cartao.selos, selosDepois: selos, em: new Date(),
      });

      return { selos, meta: cartao.meta, completo: status === 'completo', cliente: cartao.clienteId };
    });
  }
);
```

A atualização visual do passe é feita por um trigger separado — assim o carimbo responde rápido no balcão mesmo se a API do Google estiver lenta:

```js
exports.atualizarPasse = onDocumentWritten(
  { document: 'cartoes/{cartaoId}', secrets: ['WALLET_SA_KEY'] },
  async (event) => {
    const antes = event.data.before.data(), depois = event.data.after.data();
    if (!depois || antes?.selos === depois.selos) return;

    const loja = (await admin.firestore().doc(`lojistas/${depois.lojaId}`).get()).data();
    await api('PATCH', `/loyaltyObject/${depois.wallet.objectId}`, {
      loyaltyPoints: { label: 'Selos', balance: { string: `${depois.selos} de ${depois.meta}` } },
      textModulesData: [
        { header: 'Seu prêmio', body: loja.layout.premio, id: 'premio' },
        { header: depois.status === 'completo' ? 'Parabéns!' : 'Faltam',
          body: depois.status === 'completo' ? 'Cartão completo, retire seu prêmio' : `${depois.meta - depois.selos} selo(s)`,
          id: 'faltam' },
      ],
      // notificação push no celular do cliente
      messages: [{
        header: depois.status === 'completo' ? 'Cartão completo!' : 'Selo adicionado',
        body: depois.status === 'completo'
          ? `Seu prêmio está liberado: ${loja.layout.premio}`
          : `Você tem ${depois.selos} de ${depois.meta} selos.`,
        id: `msg-${depois.selos}`,
      }],
    });
  }
);
```

> A `messages` dispara notificação no celular. Use com parcimônia — uma por selo é ok, mais que isso o cliente remove o passe.

### 4.6 Resgatar

```js
exports.resgatar = onCall({ secrets: ['WALLET_SA_KEY'] }, async (req) => {
  // valida operador e PIN igual ao carimbar
  // status: completo -> resgatado
  // grava em /resgates
  // emite cartão do ciclo n+1 e devolve novo saveUrl
});
```

Ponto de UX importante: o passe antigo vira `state: 'COMPLETED'` na Wallet e o cliente adiciona o novo. Alternativa mais simples — e que eu prefiro — é **reciclar o mesmo objeto**: zera `selos`, incrementa `ciclo`, mantém o `objectId`. O cliente nunca precisa adicionar nada de novo.

---

## 5. Tela do lojista — scanner

```js
import { Html5Qrcode } from 'html5-qrcode';
import { getFunctions, httpsCallable } from 'firebase/functions';

const carimbar = httpsCallable(getFunctions(app, 'southamerica-east1'), 'carimbar');
const scanner = new Html5Qrcode('leitor');

await scanner.start(
  { facingMode: 'environment' },
  { fps: 10, qrbox: 250 },
  async (texto) => {
    await scanner.pause();
    try {
      const { data } = await carimbar({ qr: texto, pin: pinDigitado });
      navigator.vibrate?.(200);
      mostrarSucesso(`${data.selos}/${data.meta}`, data.completo);
    } catch (e) {
      mostrarErro(e.message);
    }
    setTimeout(() => scanner.resume(), 2000);
  }
);
```

Detalhes que fazem diferença no balcão:
- **HTTPS obrigatório** para a câmera — o Hosting já entrega isso
- PIN digitado uma vez por turno e guardado em memória, não a cada carimbo
- Feedback sonoro + vibração: o operador não olha a tela
- Tela cheia, botão grande, contador enorme depois do carimbo
- Modo "cliente sem celular na mão": busca por celular no painel e carimbo manual, que grava `tipo: 'selo_manual'` no log

---

## 6. Ordem de implementação

| # | Entrega | Critério de pronto |
|---|---|---|
| 1 | Blaze + Issuer ID + service account no Secret Manager | `sincronizarClasse` cria uma classe de teste |
| 2 | Página `/c/{slug}` com os 4 campos + termo | Documento em `clientes` gravado |
| 3 | Phone Auth por SMS | Token com `phone_number` chega na Function |
| 4 | `criarCartao` + botão Adicionar à Google Wallet | Passe aparece no seu celular |
| 5 | Scanner + `carimbar` + PIN | Selo sobe e o passe atualiza sozinho |
| 6 | Anti-fraude: intervalo mínimo, teto diário, log de eventos | Segundo carimbo em 5 min é recusado |
| 7 | Resgate + reciclagem de ciclo | Cartão zera sem o cliente readicionar |
| 8 | Campanha de aniversário (selo bônus automático) | Function agendada roda 08h e concede |

---

## 7. Custos estimados (500 clientes ativos, ~3 mil carimbos/mês)

| Item | Estimativa |
|---|---|
| Firestore | dentro da cota gratuita |
| Functions (Blaze) | ~R$ 0 a 5 / mês |
| Phone Auth | 10 mil verificações/mês grátis; acima disso ~US$ 0,01 |
| Google Wallet API | gratuita, sem cobrança por passe |
| Hosting | cota gratuita |

O custo real só sobe se o SMS estourar — por isso vale limitar reenvio de código e bloquear por IP.

---

## 8. Riscos conhecidos

1. **Aprovação do emissor Google** pode demorar. Comece agora, em paralelo ao desenvolvimento.
2. **Cliente com iPhone** consegue usar Google Wallet, mas a experiência é pior que a Apple Wallet nativa. Se sua base for muito iOS, antecipe a etapa 3.
3. **Relógio dessincronizado** no celular do cliente quebra o TOTP. A janela `±1` cobre 90s; se der problema em campo, aumente para 2 e adicione fallback de código numérico manual.
4. **LGPD**: e-mail e aniversário são dados pessoais. Termo de uso com finalidade explícita, e uma rota de exclusão de conta (`/meus-dados`) que apague cliente + cartões + expire o passe.
