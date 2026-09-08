# 05 — Passes Apple Wallet e Google Wallet

A parte mais específica do projeto. Ambas as plataformas fazem a mesma coisa,
por caminhos muito diferentes.

| | Apple | Google |
|---|---|---|
| Formato | Arquivo `.pkpass` assinado | Registro na API do Google |
| Onde vive | No celular | No servidor do Google |
| Custo de entrada | US$ 99/ano | R$ 0 |
| Atualizar | Web service + APNs + device busca | Um `PATCH` |
| Grade de selos | `strip.png` | `heroImage` |

---

# Parte A — Google Wallet

Fazer primeiro. É a mais simples e valida todo o núcleo.

## Setup

1. Projeto no Google Cloud
2. Ativar **Google Wallet API**
3. Criar **service account**, baixar a chave JSON
4. Em [pay.google.com/business/console](https://pay.google.com/business/console):
   criar conta de Issuer, anotar o **Issuer ID**
5. Conceder à service account o papel de editor no Issuer

## LoyaltyClass (criar uma vez)

Template compartilhado por todos os cartões. Criar via script de setup, não em
runtime.

```
POST https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass
```

```json
{
  "id": "{ISSUER_ID}.dessert_club",
  "issuerName": "Dessert Club",
  "programName": "Dessert Club",
  "reviewStatus": "UNDER_REVIEW",
  "programLogo": {
    "sourceUri": { "uri": "https://cdn.../logo-660.png" }
  },
  "hexBackgroundColor": "#1a1a1a",
  "countryCode": "BR",
  "localizedIssuerName": {
    "defaultValue": { "language": "pt-BR", "value": "Dessert Club" }
  }
}
```

> `reviewStatus`: usar `UNDER_REVIEW` em desenvolvimento. Para produção,
> submeter e aguardar `APPROVED`. **A aprovação leva alguns dias** — pedir cedo.

## LoyaltyObject (um por cliente)

```json
{
  "id": "{ISSUER_ID}.{card_serial_sanitizado}",
  "classId": "{ISSUER_ID}.dessert_club",
  "state": "ACTIVE",
  "accountName": "Maria Silva",
  "accountId": "{card_serial}",
  "loyaltyPoints": {
    "label": "Selos",
    "balance": { "string": "8/10" }
  },
  "barcode": {
    "type": "QR_CODE",
    "value": "{card_serial}",
    "alternateText": "FaveCard"
  },
  "heroImage": {
    "sourceUri": { "uri": "https://cdn.../strip-8.png" }
  },
  "textModulesData": [
    {
      "id": "reward",
      "header": "Recompensas",
      "body": "Quase lá! Faltam 2 selos para o seu cookie."
    }
  ]
}
```

**Atenção ao `id`:** só aceita alfanumérico, `.`, `_` e `-`. UUID com hífen
funciona; sanitizar por precaução. E é **imutável** — não pode mudar depois.

## Botão "Add to Google Wallet"

Gerar um JWT assinado com a chave da service account:

```js
{
  iss: SERVICE_ACCOUNT_EMAIL,
  aud: "google",
  typ: "savetowallet",
  origins: ["https://seudominio.com.br"],
  payload: { loyaltyObjects: [ { id, classId } ] }
}
```

Link: `https://pay.google.com/gp/v/save/{jwt}` — assinado com RS256.

> O objeto pode ser criado antes (via API) e o JWT referenciar só o `id`, ou o
> objeto inteiro pode ir dentro do JWT. **Preferir criar antes** — dá controle e
> permite `PATCH` imediato.

## Atualizar (carimbo)

```
PATCH https://walletobjects.googleapis.com/walletobjects/v1/loyaltyObject/{objectId}
```

```json
{
  "loyaltyPoints": { "balance": { "string": "9/10" } },
  "heroImage": { "sourceUri": { "uri": "https://cdn.../strip-9.png" } },
  "textModulesData": [
    { "id": "reward", "header": "Recompensas",
      "body": "Falta 1 carimbo para a recompensa." }
  ]
}
```

É só isso. A carteira do cliente atualiza sozinha.

## Notificação no Google

Adicionar ao objeto:
```json
"messages": [{
  "header": "Novo selo!",
  "body": "Você tem 9 de 10 selos.",
  "id": "stamp-9-cycle-3",
  "messageType": "TEXT_AND_NOTIFY"
}]
```

`TEXT_AND_NOTIFY` dispara push. **O `id` precisa ser único** ou a notificação é
suprimida como duplicata — por isso incluir selo + ciclo.

Limpar mensagens antigas periodicamente para não acumular.

---

# Parte B — Apple Wallet

## Pré-requisitos

1. Apple Developer Program ativo (US$ 99/ano)
2. **Pass Type ID** criado: `pass.com.{dominio}.fidelidade`
3. Certificado do Pass Type ID
4. Certificado intermediário **Apple WWDR G4**
5. `TEAM_IDENTIFIER` (10 caracteres, no portal)

> **Usar o mesmo Pass Type ID em dev e produção.** Trocar depois invalida todos
> os passes já distribuídos.

### Gerar o certificado no Linux (sem Mac)

```bash
# 1. Chave + CSR
openssl genrsa -out pass.key 2048
openssl req -new -key pass.key -out pass.csr \
  -subj "/emailAddress=voce@dominio.com/CN=Dessert Club/C=BR"

# 2. Subir pass.csr no Developer Portal, baixar pass.cer

# 3. Converter para PEM
openssl x509 -inform DER -outform PEM -in pass.cer -out pass.pem

# 4. Empacotar em .p12
openssl pkcs12 -export -out pass.p12 \
  -inkey pass.key -in pass.pem -passout pass:SENHA_FORTE

# 5. WWDR (baixar de apple.com/certificateauthority/)
openssl x509 -inform DER -outform PEM -in AppleWWDRCAG4.cer -out wwdr.pem
```

Guardar `pass.p12` em base64 como variável de ambiente. **Nunca no repositório.**

## Estrutura do `.pkpass`

ZIP contendo:

```
pass.json
manifest.json      ← SHA-1 de cada arquivo
signature          ← PKCS#7 detached do manifest.json
icon.png / @2x / @3x
logo.png / @2x / @3x
strip.png / @2x / @3x   ← a grade de selos
```

A lib `passkit-generator` cuida do manifest e da assinatura.

## `pass.json`

```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.com.dominio.fidelidade",
  "teamIdentifier": "ABCDE12345",
  "organizationName": "Dessert Club",
  "description": "Cartão fidelidade Dessert Club",
  "serialNumber": "{card_serial}",

  "webServiceURL": "https://api.dominio.com.br/",
  "authenticationToken": "{card.auth_token}",

  "foregroundColor": "rgb(255,255,255)",
  "backgroundColor": "rgb(26,26,26)",
  "labelColor": "rgb(180,180,180)",

  "barcodes": [{
    "format": "PKBarcodeFormatQR",
    "message": "{card_serial}",
    "messageEncoding": "iso-8859-1",
    "altText": "FaveCard"
  }],

  "storeCard": {
    "headerFields": [{
      "key": "stamps",
      "label": "SELOS",
      "value": "8/10",
      "changeMessage": "Você tem %@ selos!"
    }],
    "secondaryFields": [{
      "key": "reward",
      "label": "RECOMPENSAS",
      "value": "Quase lá! Faltam 2 selos para o seu cookie."
    }],
    "backFields": [
      { "key": "name",  "label": "Cliente", "value": "Maria Silva" },
      { "key": "phone", "label": "Telefone", "value": "(21) 9****-8888" },
      { "key": "cycle", "label": "Cartão nº", "value": "3" },
      { "key": "terms", "label": "Regulamento",
        "value": "1 selo por compra. 10 selos = 1 cookie grátis." }
    ]
  }
}
```

**`changeMessage` é o que dispara a notificação na tela de bloqueio.** O `%@` é
substituído pelo novo valor. Sem ele, o passe atualiza em silêncio.

Nome e telefone mascarado nos `backFields` são a defesa antifraude do RN6.

## Dimensões das imagens

| Arquivo | @1x | @2x | @3x |
|---------|-----|-----|-----|
| `icon` | 29×29 | 58×58 | 87×87 |
| `logo` | 160×50 | 320×100 | 480×150 |
| `strip` (storeCard) | 375×144 | 750×288 | 1125×432 |

Gerar a grade em 1125×432 e reduzir para as demais.

## Web service e APNs

Os quatro endpoints estão em `04-api.md`, seção 5. Fluxo do push:

1. Cliente adiciona o passe → iOS chama `POST /v1/devices/.../registrations/...`
2. Servidor guarda `push_token` em `apple_devices`
3. Balconista carimba → servidor atualiza o banco
4. Servidor envia **push vazio** via APNs
5. iOS acorda e chama `GET /v1/devices/.../registrations/...?passesUpdatedSince=`
6. Recebe os seriais alterados
7. Chama `GET /v1/passes/.../{serial}` e baixa o `.pkpass` novo
8. Substitui na carteira e mostra a notificação do `changeMessage`

### O push

```
POST https://api.push.apple.com/3/device/{push_token}
apns-topic: pass.com.dominio.fidelidade    ← o Pass Type ID, não um bundle id
apns-push-type: background
Body: {}
```

Autenticar com o mesmo certificado do passe (mTLS via HTTP/2).

Sandbox: `api.sandbox.push.apple.com`.

**Payload vazio de propósito.** Não tentar mandar conteúdo — a Apple ignora e
pode rejeitar.

### Erros comuns

| Sintoma | Causa provável |
|---------|----------------|
| Passe não abre no iPhone | Assinatura inválida ou `teamIdentifier` errado |
| Abre mas não atualiza | `webServiceURL` sem HTTPS válido, ou 401 no registro |
| Push aceito, nada acontece | `apns-topic` errado — precisa ser o Pass Type ID |
| Notificação não aparece | Falta `changeMessage` no campo alterado |
| Funciona em dev, falha em prod | Certificado sandbox vs produção |

## Regra de ouro para testes

**Testar em iPhone físico desde o primeiro dia.** O simulador do iOS não tem
Wallet. Não existe atalho para isso — reservar um aparelho para o projeto.

---

# Parte C — Geração da grade de selos

Módulo compartilhado. Entrada: `(preenchidos, total)`. Saída: PNG.

## Especificação visual (do mockup)

- Fundo transparente ou `#1a1a1a`
- Duas fileiras de 5 círculos
- Selo preenchido: moeda dourada com relevo
- Selo vazio: círculo cinza escuro, borda sutil
- Posição 10 quando incompleto: badge amarelo "BROWNIE COOKIE GRÁTIS" com
  estrela no canto superior
- Quando completo: o badge acende

## Implementação

```ts
function buildStampGridSvg(filled: number, total: number): string
async function renderStampGrid(filled: number, total: number): Promise<Buffer>
```

Montar SVG como string, converter com `sharp().png()`.

**Não usar fontes do sistema.** Container sem fontes instaladas renderiza
quadrados. Converter o texto do badge em `<path>`, ou embutir a fonte em base64.

## Cache (D4)

11 estados possíveis. Gerar uma vez, servir de storage estático com URL
`https://cdn.../strip-{n}.png`. O Google precisa de URL pública; a Apple
precisa do arquivo dentro do ZIP.

Invalidar o cache se o design mudar — versionar a URL (`strip-8-v2.png`).

---

# Parte D — O que o construtor de design pode alterar

O construtor do admin (`09-design-system.md`, Parte B) grava um JSON de config.
Este é o mapeamento config → campo do passe. **Nada fora desta tabela é
editável** — as carteiras não expõem mais que isso.

| Config | Apple | Google |
|--------|-------|--------|
| `colors.background` | `backgroundColor` | `hexBackgroundColor` |
| `colors.foreground` | `foregroundColor` | — (derivada) |
| `colors.label` | `labelColor` | — |
| `logo_asset_id` | `logo.png` @1x/@2x/@3x | `programLogo` 660×660 |
| `stamp.*` + `reward.*` | `strip.png` (gerada) | `heroImage` (gerada) |
| `texts.counter_label` | `headerFields[0].label` | `loyaltyPoints.label` |
| `texts.progress` | `secondaryFields[0].value` | `textModulesData[0].body` |
| `texts.change_message` | `headerFields[0].changeMessage` | `messages[]` |
| `texts.terms` | `backFields[terms].value` | `textModulesData[terms]` |

**Fixos, não editáveis:** posição dos campos, fonte, formato do cartão,
proporção. Ambas as carteiras impõem layout próprio.

## Publicação de um design novo

1. Regenerar as 11 imagens de grade (0 a 10) na nova identidade
2. Versionar as URLs (`strip-8-v4.png`) — sem isso o CDN serve a imagem antiga
3. `PATCH` no `LoyaltyClass` do Google
4. Reemitir os `.pkpass` e disparar APNs **em lotes**, não todos de uma vez
5. Atualizar `cards.design_version` conforme cada passe é reemitido

> Alterar o `LoyaltyClass` pode exigir novo review do Google. Testar em ambiente
> de rascunho antes de publicar em produção.

> Cada publicação notifica **todos** os clientes. Limite de uma por dia (RN8).
