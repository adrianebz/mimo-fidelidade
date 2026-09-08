# 03 — Modelo de Dados (Firestore)

Banco: **Cloud Firestore**, modo nativo, região `southamerica-east1` (São Paulo).

Acesso **exclusivamente pelo backend**, com o Admin SDK. Nenhum cliente web ou
mobile fala com o Firestore diretamente — combina com a decisão de não existir
versão de cliente (DP1).

---

## Aviso ao agente de desenvolvimento

Firestore **não tem**: chave estrangeira, constraint de unicidade, `JOIN`,
`UNIQUE`, `CHECK`, nem transação declarativa entre coleções.

Tudo o que antes o banco garantia sozinho agora é responsabilidade do código.
As três seções mais importantes deste documento são **Unicidade**,
**Transações** e **Contadores**. Ignorá-las produz bugs silenciosos — cadastro
duplicado, selo dobrado, saldo divergente — que só aparecem em produção.

---

## Coleções

```
stores/{storeId}
   ├── invites/{token}
   ├── customers/{customerId}
   ├── cards/{cardId}
   │      └── devices/{deviceLibraryId}      (subcoleção, só Apple)
   ├── stamps/{stampId}
   ├── redemptions/{redemptionId}
   ├── designs/{version}
   ├── staff/{staffId}
   ├── counters/{counterId}
   └── uniques/{tipo_valor}                  (índices de unicidade)

idempotency/{key}                            (raiz, TTL)
reissueTokens/{token}                        (raiz, TTL)
passUpdateLog/{logId}                        (raiz, TTL)
```

Tudo sob `stores/{storeId}` porque o modelo já prevê a segunda loja. Com uma
loja só, o `storeId` é constante — mas a estrutura não precisa mudar depois.

---

## Documentos

### `stores/{storeId}`
```ts
{
  name: "Dessert Club",
  slug: "dessert-club",
  timezone: "America/Sao_Paulo",
  stampsRequired: 10,
  rewardLabel: "Cookie grátis",
  activeDesignVersion: 3,
  createdAt: Timestamp
}
```

### `customers/{customerId}`
```ts
{
  firstName: "Maria",
  lastName: "Silva",
  email: "maria@exemplo.com",
  emailLower: "maria@exemplo.com",   // usado na unicidade e na busca
  birthDate: "1992-04-17",           // string ISO, não Timestamp — ver nota
  birthMonth: 4,                     // desnormalizado para campanha futura
  phoneE164: "+5521999998888" | null,
  cardId: "card_8f3a",               // referência direta, evita query
  consentAt: Timestamp,
  createdAt: Timestamp,
  deletedAt: Timestamp | null
}
```

> `birthDate` como string `YYYY-MM-DD`, não `Timestamp`. Data de nascimento não
> tem hora nem fuso; guardar como Timestamp gera o clássico bug de aniversário
> caindo um dia antes para quem nasceu de madrugada.

### `cards/{cardId}`
```ts
{
  customerId: "cus_...",
  serial: "8f3a...",                 // vai no QR e no passe. IMUTÁVEL.
  authToken: "...",                  // Apple web service

  stampsCount: 8,
  cycle: 3,
  lastStampAt: Timestamp,            // janela de idempotência sem query extra

  // desnormalizado do cliente — evita 2 reads no scan do balcão
  customerName: "Maria Silva",
  customerEmailMasked: "ma****@exemplo.com",

  designVersion: 3,
  googleObjectId: "3388....8f3a",
  appleIssuedAt: Timestamp | null,
  googleIssuedAt: Timestamp | null,

  createdAt: Timestamp,
  updatedAt: Timestamp               // dirige o passesUpdatedSince da Apple
}
```

**Duas desnormalizações deliberadas.** `customerName` no cartão faz o scan do
balcão custar 1 read em vez de 2 — e é o dado mais crítico da tela (antifraude).
`lastStampAt` evita uma query ordenada em `stamps` a cada carimbo.

Se o cliente mudar de nome, atualizar os dois documentos na mesma transação.

### `cards/{cardId}/devices/{deviceLibraryId}`
```ts
{ pushToken: "...", createdAt: Timestamp }
```
Subcoleção porque o acesso é sempre "todos os devices deste cartão". Só existe
por causa da Apple.

### `stamps/{stampId}`
Histórico imutável. Nunca atualizar, nunca apagar.
```ts
{
  cardId, staffId, cycle,
  source: "staff_scan" | "manual_adjust" | "signup_bonus" | "migration",
  note: string | null,
  createdAt: Timestamp
}
```

### `redemptions/{redemptionId}`
ID determinístico: **`{cardId}_{cycle}`**. É o que impede resgate duplo no
mesmo ciclo — sem constraint, o ID do documento vira a constraint.
```ts
{ cardId, staffId, cycle, rewardLabel, createdAt }
```

### `invites/{token}`
O `token` é o ID do documento e o conteúdo do QR.
```ts
{
  issuedBy: "staff_...",
  usedAt: Timestamp | null,
  customerId: string | null,
  expiresAt: Timestamp,              // +15 min
  createdAt: Timestamp
}
```

### `designs/{version}`
ID = número da versão como string (`"3"`).
```ts
{
  version: 3,
  config: { colors, logoAssetId, stamp, reward, texts },
  status: "draft" | "published" | "archived",
  publishedAt, publishedBy, createdAt
}
```
Qual está ativo vive em `stores/{storeId}.activeDesignVersion` — um único campo,
lido em toda emissão de passe.

### `staff/{staffId}`
```ts
{ authUid, name, role: "clerk" | "admin", active: boolean, createdAt }
```

---

## Unicidade

**Firestore não tem `UNIQUE`.** O padrão é uma coleção `uniques` onde o *ID do
documento* é o valor que precisa ser único. Criar com `create()` dentro de uma
transação: se já existir, a transação falha.

Três unicidades obrigatórias:

| Regra | Documento |
|-------|-----------|
| E-mail único por loja | `uniques/email_maria@exemplo.com` |
| Um cartão por cliente | `uniques/card_cus_abc123` |
| Um design publicado | `uniques/publishedDesign` |

```ts
const emailKey = db.doc(`stores/${storeId}/uniques/email_${emailLower}`);

await db.runTransaction(async (tx) => {
  const existing = await tx.get(emailKey);
  if (existing.exists) throw new ConflictError("EMAIL_ALREADY_EXISTS");

  tx.create(emailKey, { customerId, createdAt: FieldValue.serverTimestamp() });
  tx.create(customerRef, customerData);
  tx.create(cardRef, cardData);
});
```

> Ler-e-depois-escrever **fora** de transação não protege. Dois cadastros
> simultâneos com o mesmo e-mail passam pela verificação e ambos gravam. Tem que
> ser `create()` transacional.

Ao excluir um cliente (LGPD), apagar também o documento de unicidade — senão o
e-mail fica bloqueado para sempre.

---

## Transações

O Admin SDK usa **bloqueio pessimista** em transações de leitura e escrita: os
documentos lidos dentro da transação ficam travados até o commit. É o
equivalente prático do `SELECT ... FOR UPDATE`.

Limites: **500 documentos por transação ou batch**. Importa na republicação de
design (ver Contadores).

### Carimbo — a operação mais crítica

```ts
await db.runTransaction(async (tx) => {
  // 1. idempotência: create() falha se a chave já existe
  const idemRef = db.doc(`idempotency/${idempotencyKey}`);
  const idem = await tx.get(idemRef);
  if (idem.exists) return idem.data().response;   // replay

  // 2. trava o cartão
  const card = await tx.get(cardRef);
  if (!card.exists) throw new NotFoundError("CARD_NOT_FOUND");
  const c = card.data();

  // 3. regras de negócio
  if (c.stampsCount >= stampsRequired) throw new ConflictError("CARD_FULL");
  if (c.lastStampAt && now - c.lastStampAt.toMillis() < 180_000)
    throw new ConflictError("STAMP_TOO_SOON");

  // 4. escreve tudo junto
  tx.create(stampRef, { cardId, staffId, cycle: c.cycle, source: "staff_scan",
                        createdAt: FieldValue.serverTimestamp() });
  tx.update(cardRef, {
    stampsCount: FieldValue.increment(1),
    lastStampAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  tx.create(idemRef, { response, expiresAt: in24h });
});

// 5. FORA da transação: atualizar os passes (Apple + Google)
```

O passo 5 fica fora de propósito. Falha de rede com a Apple não pode desfazer um
selo já entregue ao cliente.

### Resgate

```ts
const redemptionRef = db.doc(
  `stores/${storeId}/redemptions/${cardId}_${cycle}`);
// tx.create() falha se já existe → resgate duplo impossível
tx.create(redemptionRef, {...});
tx.update(cardRef, { stampsCount: 0, cycle: FieldValue.increment(1),
                     updatedAt: FieldValue.serverTimestamp() });
```

### Consumo de convite

```ts
await db.runTransaction(async (tx) => {
  const inv = await tx.get(inviteRef);
  if (!inv.exists) throw new NotFoundError();
  if (inv.data().usedAt) throw new ConflictError("INVITE_ALREADY_USED");
  if (inv.data().expiresAt.toMillis() < Date.now())
    throw new GoneError("INVITE_EXPIRED");

  // ... unicidade de e-mail + criação de customer e card ...
  tx.update(inviteRef, { usedAt: FieldValue.serverTimestamp(), customerId });
});
```

---

## Contadores

**Firestore não faz `COUNT(*)` barato.** Existe `count()` agregado, mas cobra por
faixa de documentos varridos e não serve para painel carregado o dia todo.

Manter contadores incrementais em `counters/`:

```
counters/totals        { customers, cardsActive, stampsAllTime, redemptionsAllTime }
counters/daily_2026-09-05  { stamps, redemptions, newCustomers }
```

Atualizar com `FieldValue.increment(1)` na mesma transação da operação. O painel
lê 2 ou 3 documentos em vez de varrer milhares.

> **Limite de escrita:** ~1 escrita por segundo sustentada no mesmo documento.
> Com 200 selos/dia não chega perto. Se um dia passar disso, usar contador
> distribuído (10 shards).

### Reconciliação

Como o `stampsCount` é incrementado à mão, ele pode divergir. Job semanal:
para cada cartão, contar `stamps` do ciclo atual e comparar. Alertar em vez de
corrigir automaticamente — divergência costuma indicar bug que precisa ser visto.

---

## Índices compostos

Ficam em `firestore.indexes.json`. Os necessários:

| Coleção | Campos | Para |
|---------|--------|------|
| `cards` | `updatedAt ASC` | `passesUpdatedSince` da Apple |
| `cards` | `designVersion ASC` | fila de reemissão após publicar design |
| `customers` | `deletedAt`, `emailLower` | busca no balcão |
| `customers` | `deletedAt`, `createdAt DESC` | lista do painel |
| `stamps` | `cardId`, `createdAt DESC` | histórico do cliente |
| `stamps` | `staffId`, `createdAt DESC` | auditoria por funcionário |
| `stamps` | `createdAt DESC` | métricas do período |

Buscar cartão pelo QR: usar `serial` **como ID do documento** (`cards/{serial}`).
Vira leitura direta, sem query nem índice. Se preferir ID separado, é preciso
índice em `serial` e a leitura passa a custar uma query.

**Recomendação: `cardId === serial`.** Simplifica o caminho mais quente do
sistema.

---

## TTL

Firestore apaga documentos automaticamente por política de TTL sobre um campo
`Timestamp`. Configurar em:

| Coleção | Campo | Retenção |
|---------|-------|----------|
| `idempotency` | `expiresAt` | 24 h |
| `invites` | `expiresAt` | 15 min (a exclusão vem depois, é assíncrona) |
| `reissueTokens` | `expiresAt` | 30 min |
| `passUpdateLog` | `expiresAt` | 90 dias |

> A exclusão por TTL não é instantânea — pode levar até 24h. **A validação de
> expiração continua sendo no código.** O TTL é limpeza, não regra de negócio.

---

## Regras de segurança

Como só o backend acessa, as regras são simples e restritivas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

O Admin SDK ignora as regras. Isso bloqueia qualquer acesso direto de cliente —
inclusive um que vaze a config do Firebase.

---

## O que mudou em relação ao modelo relacional

| Antes (Postgres) | Agora (Firestore) |
|---|---|
| `UNIQUE (store, email)` | documento em `uniques/` criado em transação |
| `UNIQUE (customer_id)` em cards | documento `uniques/card_{customerId}` |
| `UNIQUE (card, cycle)` em resgates | ID determinístico `{cardId}_{cycle}` |
| índice parcial de design publicado | campo `activeDesignVersion` na loja |
| `SELECT ... FOR UPDATE` | `tx.get()` dentro de `runTransaction` |
| `JOIN customers` no scan | `customerName` desnormalizado no cartão |
| `COUNT(*)` no painel | contadores incrementais |
| `CHECK` de faixa e formato | validação com Zod na borda da API |
| trigger de `updated_at` | escrito à mão em toda atualização de cartão |
| `pg_cron` de limpeza | política de TTL |

**A linha mais perigosa é a última do bloco de constraints.** No Postgres, um
`CHECK` errado no código ainda era barrado pelo banco. No Firestore não há rede
de proteção: se a validação não estiver no código, o dado inválido entra.

Exigir Zod em **toda** entrada de escrita, sem exceção.

---

## Por que Firestore faz sentido aqui

- O projeto já usa Google Cloud para a Wallet API — mesma conta, mesma service
  account, menos infraestrutura
- Cota gratuita cobre folgadamente 200 selos/dia
- Escala sem manutenção de servidor de banco
- Backup gerenciado

## E o que se perde

- Nenhuma garantia de integridade no banco
- Consultas analíticas ruins (o painel depende de contadores)
- Exportação CSV precisa varrer a coleção — usar paginação, não carregar tudo
  em memória
- Migração de esquema é manual: mudou o formato do documento, os antigos
  continuam com o formato velho até serem reescritos
