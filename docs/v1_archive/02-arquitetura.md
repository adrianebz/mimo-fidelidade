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
      │ PostgreSQL │  │ APNs / Google API│
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
| Banco | PostgreSQL 15 (Supabase free) | Free tier suficiente; 500MB é muito |
| ORM | Drizzle ORM | Migrations versionadas, tipagem forte, leve |
| Apple pass | `passkit-generator` | Faz manifest + assinatura PKCS#7 |
| Google Wallet | `google-auth-library` + REST | SDK dedicado é opcional |
| APNs | `@parse/node-apn` ou `http2` nativo | Push vazio, payload trivial |
| Imagem | `sharp` (SVG → PNG) | Ver decisão D3 |
| Frontend | React + Vite + Tailwind | PWA simples |
| Scanner QR | `@zxing/browser` | Mais confiável que BarcodeDetector |
| Deploy | Fly.io ou Render | Free/hobby tier, região São Paulo |
| Validação | Zod | Compartilhar schemas entre API e front |

## Decisões técnicas

### D1 — Monolito, não serverless

**Decisão:** um processo Node persistente, não Edge Functions.

**Motivo:** o certificado `.p12` da Apple precisa ser carregado e a assinatura
PKCS#7 exige `node:crypto` completo. Runtimes edge têm suporte parcial. Cold
start também prejudica o alvo de < 2s no carimbo.

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
| Balconista / dono | Supabase Auth (e-mail + senha) → JWT no header `Authorization: Bearer` |
| Passe Apple ↔ web service | `Authorization: ApplePass {authenticationToken}` — token único por cartão, gerado na criação |
| Cliente na landing | Sem login. Link com token de uso único para recuperação |

### D7 — Idempotência

Tabela `idempotency_keys` com constraint única. Toda requisição de carimbo
carrega `Idempotency-Key`. Se a chave já existe, devolver a resposta original
armazenada, com `200` e header `Idempotent-Replay: true`.

### D8 — Sem fila de mensagens

Volume de 200 selos/dia não justifica. Atualização do passe é chamada
síncrona dentro do request, com retry simples. Se falhar, o passe atualiza na
próxima consulta do device (a Apple faz polling ocasional de qualquer forma).

Registrar falhas em `pass_update_log` para diagnóstico.

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
    schema.ts             → Drizzle
    migrations/
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
| Free tier do banco estoura | Serviço cai | Monitorar; upgrade custa ~US$ 25 |
| Cliente perde o passe | Perde selos | F5 (reemissão pela loja) desde a Fase 2 |
| Admin publica design ruim | Todos os cartões ficam feios | Validação bloqueante + rollback + limite diário |
| Publicação em massa estoura APNs | Passes não atualizam | Reemitir em lotes, com retry |
