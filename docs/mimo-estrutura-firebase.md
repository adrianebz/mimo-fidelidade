# Mimo Fidelidade — Estruturação da base no Firebase

Documento de referência da camada de dados: projetos, coleções, relacionamentos, índices, regras, Storage, agregações e operação.

Complementa a especificação da Etapa 2. Aqui está o desenho completo do banco, incluindo o que já existe na área do lojista.

---

## 1. Projetos e ambientes

Use **dois projetos Firebase separados**. Nunca teste com dados de produção.

| Projeto | ID sugerido | Uso |
|---|---|---|
| Desenvolvimento | `mimo-fidelidade-dev` | Emulador local + testes; Issuer da Wallet em modo demo |
| Produção | `mimo-fidelidade` | Já existe (o `.web.app` atual) |

**Região:** defina Firestore e Functions em `southamerica-east1` (São Paulo). A região do Firestore **não pode ser alterada depois de criada** — se o banco atual foi criado em `us-central1`, decida agora se vale recriar. Com base pequena, vale: a latência cai de ~180ms para ~15ms, o que é sensível no balcão.

```bash
firebase use --add    # associa aliases dev/prod
firebase emulators:start --only firestore,auth,functions,storage
```

Ambiente local com dados de mentira:
```bash
firebase emulators:export ./seed          # salva estado
firebase emulators:start --import ./seed  # restaura sempre
```

---

## 2. Modelo geral

O app é **multi-tenant**: várias lojas no mesmo banco, isoladas por `lojaId`. Todo documento carrega o `lojaId` ou está dentro de `lojistas/{lojaId}`.

```
/usuarios/{uid}                        · conta de quem faz login (dono ou operador)
/lojistas/{lojaId}                     · a loja: perfil, layout, regras, plano
   ├── /clientes/{clienteId}           · base de clientes daquela loja
   ├── /itens/{itemId}                 · catálogo: produtos e prêmios
   ├── /campanhas/{campanhaId}         · aniversário, selo em dobro, etc.
   ├── /convites/{conviteId}           · convite de operador ainda não aceito
   └── /agregados/{doc}                · contadores pré-calculados do painel
/cartoes/{cartaoId}                    · TOPO: cartão de um cliente numa loja
   └── /eventos/{eventoId}             · log imutável de cada selo
/resgates/{resgateId}                  · TOPO: prêmios entregues
/auditoria/{logId}                     · ações sensíveis (exclusão, mudança de regra)
```

### Por que `cartoes` e `resgates` ficam no topo?

Poderiam ser subcoleção de `lojistas`, mas ficam no topo por três motivos:

1. **O cliente consulta os cartões dele em várias lojas.** Uma query `where('clienteId','==',x)` resolve; com subcoleção precisaria de collection group + índice extra.
2. **Relatórios cruzados** ("quantos cartões completados no mês, todas as lojas") ficam triviais.
3. **Regras de segurança mais simples** — o `lojaId` está dentro do próprio documento, não precisa subir na árvore.

O custo é ter que repetir `lojaId` em todo documento e sempre filtrar por ele. Aceitável.

---

## 3. Convenções

| Regra | Motivo |
|---|---|
| Nomes em **português, minúsculo, plural** para coleções (`clientes`, `cartoes`) | Consistência com o resto do código |
| Campos em `camelCase` | Padrão JS |
| Toda data é `Timestamp` do Firestore, nunca string | Permite ordenar e comparar |
| Todo documento tem `criadoEm` e `atualizadoEm` | Debug e auditoria |
| IDs **determinísticos** quando possível (ver abaixo) | Evita duplicata sem precisar de query |
| Valores monetários em **centavos**, inteiros | Float quebra em soma |
| Booleano começa com `ativo`, `exige`, `permite` | Legibilidade |

### IDs determinísticos

| Coleção | ID | Exemplo |
|---|---|---|
| `lojistas` | slug gerado do nome | `padaria-da-ana` |
| `clientes` | celular E.164 sem `+` | `5511987654321` |
| `cartoes` | `{lojaId}_{clienteId}_{ciclo}` | `padaria-da-ana_5511987654321_1` |
| `itens`, `campanhas`, `eventos`, `resgates` | auto-ID | — |

Consequência prática: cadastrar o mesmo celular duas vezes vira um `set(merge:true)`, não um cliente duplicado. Isso elimina a maior fonte de sujeira nesse tipo de app.

---

## 4. Coleções

### 4.1 `/usuarios/{uid}`

Espelha o Firebase Auth. Existe para o app saber, no login, para quais lojas o usuário tem acesso sem varrer coleção.

```js
{
  nome: "Ana Souza",
  email: "ana@padaria.com",
  telefone: "+5511999998888",
  lojas: {                                  // mapa lojaId -> papel
    "padaria-da-ana": "dono",
    "cafe-central":   "operador"
  },
  ultimoAcessoEm: Timestamp,
  criadoEm: Timestamp
}
```

Os mesmos dados vão para **custom claims** do Auth (§7), que é o que as regras de segurança leem.

### 4.2 `/lojistas/{lojaId}`

Documento central. Tudo que o painel do lojista edita.

```js
{
  nome: "Padaria da Ana",
  slug: "padaria-da-ana",
  documento: "12345678000190",             // CNPJ, para faturamento
  contato: { email, telefone, whatsapp },
  endereco: { cep, logradouro, numero, cidade, uf },
  ativo: true,

  layout: {
    corFundo: "#1B4332",
    corTexto: "#FFFFFF",
    logoUrl: "...", logoPath: "lojistas/padaria-da-ana/logo.png",
    heroUrl: "...", heroPath: "...",
    nomePrograma: "Clube da Ana",
    premio: "1 café grátis",
    iconeSelo: "cafe"                       // chave do ícone na UI
  },

  regras: {
    meta: 10,
    intervaloMinimoMin: 30,
    maxSelosDiaPorCliente: 2,
    validadeDias: 180,
    exigirSMS: true,
    exigirPinOperador: true
  },

  wallet: { classId, classSincronizadaEm },

  plano: {
    nome: "gratuito",                       // gratuito | pro
    limiteClientes: 200,
    expiraEm: Timestamp
  },

  operadores: {                             // mapa embutido, leitura barata
    "uid_ana":    { nome: "Ana",      pinHash: "...", papel: "dono",      ativo: true },
    "uid_balcao": { nome: "Balcão 1", pinHash: "...", papel: "operador",  ativo: true }
  },

  criadoEm, atualizadoEm
}
```

**Por que `operadores` é mapa embutido e não subcoleção?** Toda operação de carimbo precisa validar o operador. Como mapa, vem junto no `get()` do lojista que já é necessário para ler `regras` — uma leitura em vez de duas. Limite prático: até ~50 operadores por loja. Acima disso, migre para subcoleção.

**`pinHash`:** nunca guarde PIN em texto. Use `scrypt` ou `bcrypt` na Function.

### 4.3 `/lojistas/{lojaId}/clientes/{clienteId}`

```js
{
  nome: "João Silva",
  celular: "+5511987654321",
  email: "joao@email.com",
  aniversario: "1990-03-14",
  aniversarioMMDD: "03-14",                // permite query "aniversariantes de hoje"
  verificado: true,                        // passou pelo SMS

  consentimento: { aceito: true, versaoTermo: "v1", em: Timestamp, ip: "..." },

  // denormalizado, atualizado por trigger — evita query no cartão para listar
  resumo: {
    cartaoAtivoId: "padaria-da-ana_5511987654321_1",
    selosAtuais: 3,
    ciclosCompletos: 2,
    totalSelosHistorico: 23,
    ultimaVisitaEm: Timestamp
  },

  tags: ["vip"],                           // segmentação manual
  origem: "qr-balcao",                     // qr-balcao | link-instagram | manual
  criadoEm, atualizadoEm
}
```

O bloco `resumo` é a decisão mais importante desta coleção: sem ele, a tela "meus clientes" com 500 linhas faz 500 leituras extras em `cartoes`. Com ele, faz 500 e pronto. O trigger `atualizarPasse` já roda a cada selo — aproveite o mesmo gatilho para escrever aqui.

### 4.4 `/lojistas/{lojaId}/itens/{itemId}`

O catálogo. Serve para dois papéis, distinguidos por `tipo`:

```js
{
  tipo: "produto",              // produto | premio
  nome: "Cappuccino 300ml",
  descricao: "",
  precoCentavos: 1450,
  imagemUrl: null,

  // se tipo = produto: quantos selos a compra concede
  selosConcedidos: 1,

  // se tipo = premio: quantos selos custa para resgatar
  selosNecessarios: 10,

  ativo: true,
  ordem: 1,                     // ordenação manual na tela
  criadoEm, atualizadoEm
}
```

Isso abre o caminho para "café expresso vale 1 selo, combo vale 2" sem mudar o esquema depois. Se hoje a loja só tem um prêmio único, o campo `layout.premio` já cobre — os `itens` do tipo `premio` viram opcionais.

### 4.5 `/cartoes/{cartaoId}`

```js
{
  lojaId, clienteId, ciclo: 1,
  selos: 3,
  meta: 10,                     // congelado na criação: se a loja mudar a meta,
                                // cartões em andamento mantêm a regra combinada
  status: "ativo",              // ativo | completo | resgatado | expirado
  totpSecret: "BASE32...",      // nunca sai do servidor
  wallet: { objectId, ultimaSync },

  // desnormalizado para a tela do lojista não ter que buscar o cliente
  clienteNome: "João Silva",

  ultimoSeloEm: Timestamp,
  expiraEm: Timestamp,          // usado pelo TTL do Firestore
  criadoEm, atualizadoEm
}
```

**`meta` congelada** evita a pior reclamação possível: cliente com 8 de 10 selos, lojista muda para 15, cliente se sente roubado.

### 4.6 `/cartoes/{cartaoId}/eventos/{eventoId}`

Append-only. Nunca editar, nunca apagar.

```js
{
  tipo: "selo",                 // selo | selo_manual | bonus | estorno | resgate
  selosAntes: 2, selosDepois: 3,
  operadorUid, operadorNome,
  origem: "scanner",            // scanner | manual | campanha
  itemId: null,                 // se o selo veio de um produto específico
  motivo: null,                 // preenchido em estorno
  em: Timestamp
}
```

Esse log é o que resolve discussão de balcão e é a base de qualquer relatório futuro. Não economize nele.

### 4.7 `/resgates/{resgateId}`

```js
{
  lojaId, clienteId, cartaoId, ciclo: 1,
  itemId: "abc", premio: "1 café grátis",
  operadorUid, operadorNome,
  em: Timestamp
}
```

### 4.8 `/lojistas/{lojaId}/campanhas/{campanhaId}`

```js
{
  tipo: "aniversario",          // aniversario | selo_dobro | primeira_visita
  ativa: true,
  selosBonus: 1,
  janela: { inicio: Timestamp, fim: Timestamp },   // null = permanente
  mensagem: "Feliz aniversário! Um selo por nossa conta.",
  criadoEm
}
```

Uma Function agendada (`onSchedule('0 8 * * *')`) lê as campanhas ativas do tipo `aniversario`, busca clientes com `aniversarioMMDD == hoje` e concede o bônus gravando um evento `tipo: 'bonus'`.

### 4.9 `/lojistas/{lojaId}/agregados/painel`

Contadores mantidos por trigger, para o dashboard abrir instantâneo sem `count()` caro.

```js
{
  totalClientes: 342,
  cartoesAtivos: 289,
  cartoesCompletos: 12,
  selosHoje: 47,
  selosMes: 1203,
  resgatesMes: 31,
  atualizadoEm: Timestamp
}
```

Incremente com `FieldValue.increment(1)` dentro da mesma transação do carimbo. Se o volume passar de ~1 escrita/segundo no mesmo documento, migre para **distributed counter** (10 shards) — improvável nesse cenário, mas o limite existe.

### 4.10 `/auditoria/{logId}`

Só ações sensíveis: exclusão de cliente, mudança de `regras.meta`, estorno de selo, troca de plano, remoção de operador.

```js
{ lojaId, uid, acao: "regras.meta", de: 10, para: 8, ip, em: Timestamp }
```

---

## 5. Relacionamentos

```
usuarios ──1:N── lojistas          (via mapa usuarios.lojas + lojistas.operadores)
lojistas ──1:N── clientes
lojistas ──1:N── itens · campanhas · convites
clientes ──1:N── cartoes           (1 ativo por vez, N históricos por ciclo)
cartoes  ──1:N── eventos
cartoes  ──1:1── resgate           (por ciclo completado)
```

Regra de ouro: **um cartão ativo por cliente por loja**. Garantida pelo ID determinístico com `ciclo` + verificação de `status in ['ativo','completo']` antes de criar.

---

## 6. Índices

`firestore.indexes.json`:

```json
{
  "indexes": [
    { "collectionGroup": "cartoes", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "lojaId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" },
      { "fieldPath": "ultimoSeloEm", "order": "DESCENDING" } ] },

    { "collectionGroup": "cartoes", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "lojaId", "order": "ASCENDING" },
      { "fieldPath": "clienteId", "order": "ASCENDING" },
      { "fieldPath": "ciclo", "order": "DESCENDING" } ] },

    { "collectionGroup": "cartoes", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "clienteId", "order": "ASCENDING" },
      { "fieldPath": "status", "order": "ASCENDING" } ] },

    { "collectionGroup": "clientes", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "aniversarioMMDD", "order": "ASCENDING" },
      { "fieldPath": "verificado", "order": "ASCENDING" } ] },

    { "collectionGroup": "resgates", "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "lojaId", "order": "ASCENDING" },
      { "fieldPath": "em", "order": "DESCENDING" } ] }
  ],
  "fieldOverrides": [
    { "collectionGroup": "cartoes", "fieldPath": "totpSecret",
      "indexes": [] },
    { "collectionGroup": "cartoes", "fieldPath": "expiraEm",
      "ttlConfig": {} }
  ]
}
```

Dois detalhes que economizam dinheiro:

- **`totpSecret` sem índice.** Segredo nunca é consultado; indexar só custa escrita.
- **TTL em `expiraEm`.** O Firestore apaga cartões expirados sozinho, sem Function, sem custo de leitura. Configure também em `eventos` se quiser reter só 2 anos de log.

Deploy: `firebase deploy --only firestore:indexes`

---

## 7. Autenticação e custom claims

**Provedores:**
- Lojista/operador: e-mail e senha (ou Google)
- Cliente final: **Phone Auth** (SMS)

O cliente e o lojista vivem no mesmo Auth, diferenciados pela claim. Ao criar ou alterar um operador, a Function grava:

```js
await admin.auth().setCustomUserClaims(uid, {
  lojas: { 'padaria-da-ana': 'dono' }
});
```

E as regras leem `request.auth.token.lojas[lojaId]` — **sem nenhuma leitura no Firestore**. Isso é relevante: a versão que usa `get()` dentro da regra cobra uma leitura por avaliação, em toda query. Com claims, custa zero.

Limite: o token tem 1000 bytes. Cabem umas 30 lojas por usuário, suficiente.

Após alterar a claim, o cliente precisa de `getIdToken(true)` para o token novo valer.

---

## 8. Regras de segurança

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function auth()      { return request.auth != null; }
    function papel(l)    { return auth() ? request.auth.token.lojas[l] : null; }
    function ehDono(l)   { return papel(l) == 'dono'; }
    function ehEquipe(l) { return papel(l) in ['dono','operador']; }
    function meuTel()    { return auth() && request.auth.token.phone_number != null
                           ? request.auth.token.phone_number.replace('\\+','') : 'x'; }

    match /usuarios/{uid} {
      allow read, update: if auth() && request.auth.uid == uid;
      allow create, delete: if false;             // só Function
    }

    match /lojistas/{lojaId} {
      // leitura pública: a página de cadastro precisa do layout antes do login
      allow read: if true;
      allow update: if ehDono(lojaId);
      allow create, delete: if false;

      match /clientes/{clienteId} {
        allow read: if ehEquipe(lojaId);
        allow write: if false;                    // só Function
      }
      match /itens/{itemId} {
        allow read: if true;                      // catálogo é público
        allow write: if ehDono(lojaId);
      }
      match /campanhas/{id} { allow read: if ehEquipe(lojaId); allow write: if ehDono(lojaId); }
      match /agregados/{id} { allow read: if ehEquipe(lojaId); allow write: if false; }
      match /convites/{id}  { allow read, write: if ehDono(lojaId); }
    }

    match /cartoes/{cartaoId} {
      allow read: if ehEquipe(resource.data.lojaId)
                  || resource.data.clienteId == meuTel();
      allow write: if false;

      match /eventos/{eventoId} {
        allow read: if ehEquipe(
          get(/databases/$(database)/documents/cartoes/$(cartaoId)).data.lojaId);
        allow write: if false;
      }
    }

    match /resgates/{id} {
      allow read: if ehEquipe(resource.data.lojaId) || resource.data.clienteId == meuTel();
      allow write: if false;
    }

    match /auditoria/{id} { allow read: if ehDono(resource.data.lojaId); allow write: if false; }
  }
}
```

**Princípio único deste arquivo:** o cliente lê, nunca escreve. Toda mutação de selo, cliente e resgate passa por Cloud Function. Se um dia aparecer `allow write: true` em `cartoes`, alguém vai carimbar o próprio cartão pelo console do navegador em cinco minutos.

Teste as regras antes de subir:
```bash
npm i -D @firebase/rules-unit-testing
firebase emulators:exec --only firestore "npm test"
```

---

## 9. Cloud Storage

```
/lojistas/{lojaId}/logo.png          660x660, PNG
/lojistas/{lojaId}/hero.png          1032x336, PNG
/lojistas/{lojaId}/itens/{itemId}.jpg
/exports/{data}/                     backups automáticos
```

```js
service firebase.storage {
  match /b/{bucket}/o {
    match /lojistas/{lojaId}/{arquivo=**} {
      allow read: if true;                        // a Wallet precisa baixar a imagem
      allow write: if request.auth.token.lojas[lojaId] == 'dono'
                   && request.resource.size < 2 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    match /exports/{p=**} { allow read, write: if false; }
  }
}
```

⚠️ As imagens do passe **precisam ser publicamente acessíveis por URL** — o servidor do Google Wallet busca a imagem sem autenticação. Use `getDownloadURL()` e guarde a URL no documento do lojista, junto com o `path` (para conseguir deletar depois).

---

## 10. Triggers que mantêm a base coerente

| Trigger | Dispara em | O que faz |
|---|---|---|
| `sincronizarClasse` | write em `lojistas/{id}` | atualiza a LoyaltyClass na Wallet |
| `atualizarPasse` | update em `cartoes/{id}` | PATCH no LoyaltyObject + push |
| `atualizarResumoCliente` | update em `cartoes/{id}` | escreve `clientes.resumo` |
| `contarAgregados` | create em `eventos` e `resgates` | `increment()` em `agregados/painel` |
| `provisionarUsuario` | `auth.onCreate` | cria `/usuarios/{uid}` |
| `campanhaAniversario` | agendada, 08:00 | concede selo bônus |
| `zerarContadoresDiarios` | agendada, 00:00 | `selosHoje = 0` |
| `limparConvites` | agendada, semanal | apaga convites com +7 dias |

Agrupe todas em `functions/src/triggers/` com um arquivo por domínio. Um `index.js` com 900 linhas fica impossível de manter e faz cold start pior — com Functions v2, cada export vira um serviço Cloud Run independente.

---

## 11. Backup e retenção

**Export agendado** (Blaze, custa centavos):
```bash
gcloud firestore export gs://mimo-fidelidade-backups \
  --collection-ids=lojistas,cartoes,resgates
```
Agende diário via Cloud Scheduler. Configure lifecycle de 30 dias no bucket.

**PITR (Point-in-time recovery):** ative no console. Permite voltar o banco a qualquer segundo dos últimos 7 dias. Vale o custo — protege contra o script de migração que apaga a coleção errada.

**Retenção:**
| Dado | Prazo | Como |
|---|---|---|
| Cartões expirados | 180 dias | TTL em `expiraEm` |
| Eventos | 24 meses | TTL |
| Resgates e auditoria | indefinido | base fiscal/contábil |
| Cliente que pediu exclusão | imediato | Function `excluirCliente` |

**LGPD — Function `excluirCliente`:** apaga o documento do cliente, anonimiza os eventos (troca nome por `[removido]` mantendo o contador), expira o passe na Wallet (`state: 'EXPIRED'`) e grava em `auditoria`. Exponha em `/meus-dados`.

---

## 12. Custos e limites a vigiar

| Limite | Valor | Risco aqui |
|---|---|---|
| Escritas no mesmo documento | ~1/s sustentado | `agregados/painel` em loja movimentada |
| Tamanho do documento | 1 MiB | `operadores` como mapa, se crescer muito |
| Operações por transação | 500 | script de migração em lote |
| Índices por documento | 200 | irrelevante nesse modelo |
| Custom claims | 1000 bytes | usuário com muitas lojas |

Estimativa para 20 lojas / 5 mil clientes / 30 mil carimbos por mês: leituras e escritas ficam dentro ou pouco acima da cota gratuita. A conta mensal deve ficar abaixo de R$ 20, dominada por SMS do Phone Auth — não por Firestore.

---

## 13. Checklist de implantação

- [ ] Projeto `-dev` criado e emulador rodando com seed
- [ ] Região confirmada (`southamerica-east1`) antes de qualquer dado real
- [ ] `firestore.rules` e `firestore.indexes.json` versionados no repositório
- [ ] Testes de regras passando no emulador
- [ ] Custom claims sendo gravadas no login do lojista
- [ ] TTL configurado em `cartoes.expiraEm`
- [ ] `totpSecret` fora do índice
- [ ] Export diário agendado + PITR ativo
- [ ] Regras de Storage limitando tamanho e tipo
- [ ] Rota `/meus-dados` com exclusão funcionando
- [ ] Alerta de orçamento no Google Cloud (ex.: R$ 50/mês)
