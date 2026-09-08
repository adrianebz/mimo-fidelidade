# 02 — Arquitetura

## Componentes

```
┌─────────────────┐     ┌─────────────────┐
│  PWA Cadastro   │     │  PWA Balconista │
│   (cliente)     │     │   (scanner QR)  │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │ HTTPS
         ┌───────────▼────────────┐
         │      API (Node/TS)     │
         │  ┌──────────────────┐  │
         │  │ Core: clientes,  │  │
         │  │ cartões, selos   │  │
         │  ├──────────────────┤  │
         │  │ Gerador imagem   │  │  ← SVG → PNG (grade de selos)
         │  ├──────────────────┤  │
         │  │ Apple PassKit    │  │  ← assina .pkpass
         │  ├──────────────────┤  │
         │  │ Google Wallet    │  │  ← JWT + REST
         │  └──────────────────┘  │
         └─────┬──────────┬───────┘
               │          │
      ┌────────▼───┐  ┌───▼──────────────┐
      │  Firestore │  │ APNs / Google API│
      └────────────┘  └───┬──────────────┘
                          │
                 ┌────────▼─────────┐
                 │ Carteira do      │
                 │ celular cliente  │
                 └──────────────────┘
```

**Monolito único.** Um serviço, um banco. Não dividir.

## Stack

| Camada | Escolha | Justificativa |
|--------|---------|---------------|
| Runtime | Node.js 20 LTS + TypeScript | Melhores libs de PassKit |
| Framework | Fastify | Leve, rápido, bom suporte a schema |
| Banco | **Cloud Firestore** (modo nativo, `southamerica-east1`) | Mesma conta do Google Wallet; cota grátis cobre o volume |
| Acesso ao banco | `firebase-admin` (Admin SDK) | Transações com bloqueio pessimista |
| Apple pass | `passkit-generator` | Faz manifest + assinatura PKCS#7 |
| Google Wallet | `google-auth-library` + REST | SDK dedicado é opcional |
| APNs | `@parse/node-apn` ou `http2` nativo | Push vazio, payload trivial |
| Imagem | `sharp` (SVG → PNG) | Ver decisão D3 |
| Frontend | React + Vite + Tailwind | PWA simples |
| Scanner QR | `@zxing/browser` | Mais confiável que BarcodeDetector |
| Deploy | Cloud Run (`southamerica-east1`) | Mesma região do Firestore; escala a zero |
| Auth de operador | Firebase Auth | Já vem no mesmo projeto |
| Validação | **Zod — obrigatório em toda escrita** | Firestore não tem `CHECK`; é a única rede de proteção |

## Decisões técnicas

### D1 — Container no Cloud Run, não Cloud Functions

**Decisão:** um serviço Node containerizado, não Functions nem Edge.

**Motivo:** o certificado `.p12` da Apple precisa ser carregado em memória e a
assinatura PKCS#7 exige `node:crypto` completo — runtimes edge têm suporte
parcial. Além disso, o APNs usa HTTP/2 com mTLS, que pede conexão persistente.

**Configuração:** `min-instances: 1`. Sem isso, o cold start estoura o alvo de
2s no carimbo. Custa alguns dólares por mês e vale cada centavo — o balconista
com fila não espera container subir.

### D1b — Firestore, com os olhos abertos

**Decisão:** Firestore em vez de Postgres.

**A favor:** mesma conta Google já usada na Wallet API, cota gratuita
folgada para 200 selos/dia, zero manutenção de servidor de banco, backup
gerenciado.

**Contra, e isto precisa estar claro:** Firestore não tem unicidade, chave
estrangeira, `CHECK`, `JOIN` nem `COUNT` barato. Regras que o Postgres garantia
sozinho passam a depender inteiramente do código.

**Consequências obrigatórias**, detalhadas em `03-modelo-de-dados.md`:
- Unicidade de e-mail por documento em `uniques/`, criado em transação
- Resgate único por ciclo via ID determinístico `{cardId}_{cycle}`
- Nome do cliente desnormalizado no cartão (evita 2 reads no scan)
- Contadores incrementais para o painel
- Zod obrigatório em toda escrita — é a única validação que resta

### D2 — A grade de selos é uma imagem gerada

**Nenhuma das duas carteiras tem componente nativo de "grade de carimbos".**
O que aparece no mockup é uma imagem renderizada pelo servidor.

- Apple: campo `strip.png` do `storeCard`
- Google: campo `heroImage` do `LoyaltyObject`

A cada mudança de selo, o servidor gera uma imagem nova.

### D3 — Gerar imagem via SVG + sharp, não node-canvas

**Decisão:** montar a grade como string SVG e converter com `sharp`.

**Motivo:** `node-canvas` depende de Cairo compilado e é uma fonte recorrente de
falha de deploy em containers. `sharp` traz binário pré-compilado.

**Implicação:** o desenho do selo dourado deve ser um SVG embutido (ou um PNG
pequeno em base64 embutido no SVG). Não usar fontes de sistema — embutir a
fonte ou converter texto em path.

### D4 — Cache das imagens por (selos, versão de design)

Só existem 11 estados de grade (0 a 10 selos) por versão de design. Gerar e
cachear por chave `strip-{n}-v{versao}.png`. Não regenerar por cliente.

**Versionar a URL é obrigatório.** Sem o sufixo de versão, o CDN e a carteira do
Google continuam servindo a imagem antiga depois que o admin publica um design
novo — bug silencioso e difícil de diagnosticar.

> Exceção: se no futuro a imagem incluir o nome do cliente, o cache cai por
> terra. **Não incluir nome na imagem.** O nome vai em campo de texto do passe.

### D5 — QR estático com o serial do cartão

O QR contém apenas o `card_serial` (UUID). Não contém dados pessoais.

Rejeitado: QR rotativo com TOTP. Exigiria atualizar o passe a cada poucos
minutos, o que estoura os limites de push e drena bateria. As defesas de RN6
são suficientes para o risco real de uma loja de bairro.

### D6 — Autenticação

Três esquemas distintos, não misturar:

| Quem | Mecanismo |
|------|-----------|
| Balconista / dono | Firebase Auth (e-mail + senha) → JWT no header `Authorization: Bearer` |
| Passe Apple ↔ web service | `Authorization: ApplePass {authenticationToken}` — token único por cartão, gerado na criação |
| Cliente na landing | Sem login. Link com token de uso único para recuperação |

### D7 — Idempotência

Coleção `idempotency/{key}`, com a chave como **ID do documento**. `tx.create()`
falha se já existir — é a constraint que o Firestore não tem. Se existir,
devolver a resposta armazenada com header `Idempotent-Replay: true`.

Limpeza por política de TTL sobre `expiresAt` (24h). A **validação de expiração
continua no código**: o TTL do Firestore pode levar até 24h para apagar.

### D8 — Sem fila de mensagens no fluxo normal

Volume de 200 selos/dia não justifica. Atualização do passe é síncrona no
request, com retry simples. Se falhar, o passe atualiza na próxima consulta do
device.

Registrar falhas em `passUpdateLog` para diagnóstico.

**Exceção:** a republicação de design toca todos os cartões de uma vez.
Firestore limita transações e batches a **500 documentos**. Processar em lotes
de 400, com pausa entre eles, usando Cloud Tasks ou um loop com controle de
taxa. Não tentar de uma vez.

## Estrutura de pastas

```
/src
  /modules
    /customers      → cadastro, busca
    /invites        → convites QR de uso único
    /cards          → criação, consulta de estado
    /stamps         → carimbo, idempotência, regras
    /redemptions    → resgate, ciclos
    /staff          → funcionários, auth
    /admin          → painel, métricas, export CSV
    /design         → construtor, validação, publicação, versionamento
  /wallet
    /apple
      pass-builder.ts     → monta pass.json
      signer.ts           → assina e empacota .pkpass
      web-service.ts      → os 4 endpoints da Apple
      apns.ts             → push vazio
    /google
      class-manager.ts    → cria/atualiza LoyaltyClass
      object-manager.ts   → cria/atualiza LoyaltyObject
      save-link.ts        → gera JWT do botão
  /imaging
    stamp-grid.ts         → SVG da grade
    render.ts             → SVG → PNG via sharp
  /db
    firestore.ts          → inicialização do Admin SDK
    converters.ts         → tipagem de documentos
    uniques.ts            → helpers de unicidade transacional
    counters.ts           → incremento de contadores
  /lib
    idempotency.ts
    phone.ts              → normalização E.164
    errors.ts
  server.ts

/web
  /enroll         → formulário de cadastro por convite (único contato do cliente)
  /staff          → PWA do balconista
  /admin          → painel do administrador (inclui construtor de design)

/assets
  /pass
    icon.png, icon@2x.png, icon@3x.png
    logo.png, logo@2x.png, logo@3x.png
    stamp-filled.svg, stamp-empty.svg, reward-badge.svg
```

## Assets visuais necessários

O dono precisa fornecer, ou o agente precisa gerar placeholders:

| Asset | Dimensão | Uso |
|-------|----------|-----|
| `icon.png` | 29×29, 58×58, 87×87 | Apple — obrigatório |
| `logo.png` | até 160×50 pt (@1x) | Apple — canto superior |
| `strip.png` | 1125×432 (@3x) | Apple — a grade de selos |
| Selo cheio | SVG | Moeda dourada do mockup |
| Selo vazio | SVG | Círculo cinza |
| Badge recompensa | SVG | Círculo amarelo "BROWNIE COOKIE GRÁTIS" |
| `heroImage` | 1032×336 | Google — a grade |
| Logo Google | 660×660 | Google — `programLogo` |

> Todos os PNGs da Apple precisam das três resoluções (@1x, @2x, @3x). Faltar
> uma não quebra, mas fica borrado.

## Riscos técnicos

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Aprovação Apple Developer demora | Bloqueia Fase 4 | Abrir conta antes da Fase 0 |
| Assinatura PKCS#7 falha em prod | Passe não abre | Testar em iPhone real desde o dia 1 |
| Certificado expira (1 ano) | Passes param de ser emitidos | Alerta em calendário 30 dias antes |
| Cota gratuita do Firestore estoura | Cobrança inesperada | Alerta de orçamento no GCP; volume previsto usa ~3% da cota |
| Falta de constraint gera dado duplicado | Cadastro ou selo duplo | Padrão `uniques/` + Zod + testes de concorrência na Fase 1 |
| Cold start no Cloud Run | Carimbo lento | `min-instances: 1` |
| Cliente perde o passe | Perde selos | F5 (reemissão pela loja) desde a Fase 2 |
| Admin publica design ruim | Todos os cartões ficam feios | Validação bloqueante + rollback + limite diário |
| Publicação em massa estoura APNs | Passes não atualizam | Reemitir em lotes, com retry |
