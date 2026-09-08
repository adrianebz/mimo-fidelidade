# 04 — Contratos de API

Base: `https://api.{dominio}.com.br`
Formato: JSON. Datas em ISO 8601 UTC.

## Convenção de erros

```json
{
  "error": {
    "code": "STAMP_TOO_SOON",
    "message": "Selo já registrado há 45 segundos.",
    "details": { "seconds_ago": 45 }
  }
}
```

| Código | HTTP | Situação |
|--------|------|----------|
| `VALIDATION_ERROR` | 400 | Payload inválido |
| `UNAUTHORIZED` | 401 | Token ausente ou inválido |
| `FORBIDDEN` | 403 | Sem permissão para a ação |
| `CARD_NOT_FOUND` | 404 | Serial inexistente |
| `STAMP_TOO_SOON` | 409 | Dentro da janela de 3 min (RN1) |
| `CARD_FULL` | 409 | Já tem 10 selos, precisa resgatar (RN2) |
| `CARD_NOT_FULL` | 409 | Tentou resgatar sem completar |
| `EMAIL_ALREADY_EXISTS` | 409 | E-mail já cadastrado (usar reemissão) |
| `INVITE_EXPIRED` | 410 | Convite passou de 15 min |
| `INVITE_ALREADY_USED` | 409 | Convite já gerou um cadastro |
| `DESIGN_INVALID` | 400 | Design reprovado na validação |
| `INTERNAL_ERROR` | 500 | Falha inesperada |

**As mensagens vão direto para a tela do balconista.** Escrever em pt-BR, curtas
e sem jargão técnico.

---

## 1. Convite e cadastro

### `POST /api/admin/invites` — emitir convite (auth de operador)

Chamado quando o operador toca em "Novo cliente". Retorna o token que vira QR.

**201 Created**
```json
{
  "token": "inv_7fK2...",
  "qr_payload": "https://dominio.com.br/entrar/inv_7fK2...",
  "expires_at": "2026-09-05T14:15:00Z"
}
```

O QR codifica a **URL completa**, não só o token — assim a câmera nativa do
celular abre direto, sem app leitor.

### `GET /api/enroll/:token` — validar convite (público)

Chamado quando o cliente abre o link. Verifica antes de mostrar o formulário.

**200** `{ "valid": true, "store_name": "Dessert Club" }`

**410 `INVITE_EXPIRED`** / **409 `INVITE_ALREADY_USED`** — tela amigável
pedindo para solicitar outro no balcão.

### `POST /api/enroll/:token` — criar perfil (público)

```json
{
  "first_name": "Maria",
  "last_name": "Silva",
  "email": "maria@exemplo.com",
  "birth_date": "1992-04-17",
  "phone": "21999998888",
  "consent": true
}
```

`phone` é opcional (ver Q9 no PRD). Normalizar para E.164 se presente.

**Lógica, em transação:**
1. Travar o convite (`SELECT ... FOR UPDATE`), validar não usado e não expirado
2. Verificar e-mail duplicado na loja
3. Criar `customer` + `card`
4. Marcar convite como consumido
5. Commit → emitir passes nas duas carteiras

**201 Created** — a resposta já traz tudo para os botões aparecerem
automaticamente, sem passo intermediário:
```json
{
  "card_serial": "8f3a...",
  "first_name": "Maria",
  "stamps": 0,
  "required": 10,
  "reward_label": "Cookie grátis",
  "apple_pass_url": "https://api.../api/passes/apple/8f3a...",
  "google_save_url": "https://pay.google.com/gp/v/save/eyJhbGc..."
}
```

**409 `EMAIL_ALREADY_EXISTS`** — não criar cadastro novo. Orientar o cliente a
pedir reemissão no balcão (F5). **Não** oferecer autoatendimento.

> **Não existe endpoint público de recuperação.** A plataforma não tem área do
> cliente. Reemissão só pela loja — ver seção 3.

## 2. Passes (público, protegido por serial)

### `GET /api/passes/apple/:serial`

Retorna o arquivo `.pkpass`.

```
Content-Type: application/vnd.apple.pkpass
Content-Disposition: attachment; filename="dessertclub.pkpass"
```

### `GET /api/passes/google/:serial/save`

Redireciona (302) para o link de salvamento do Google com o JWT assinado.

---

## 3. Operação de balcão (auth de funcionário)

Header: `Authorization: Bearer {jwt_supabase}`

### `GET /api/cards/:serial`

Consulta antes de carimbar. É o que alimenta a tela de confirmação.

**200**
```json
{
  "serial": "8f3a...",
  "customer": {
    "name": "Maria Silva",
    "email_masked": "ma****@exemplo.com"
  },
  "stamps": 8,
  "required": 10,
  "cycle": 3,
  "reward_available": false,
  "last_stamp_at": "2026-08-30T14:22:00Z",
  "can_stamp": true,
  "blocked_reason": null
}
```

> Nunca devolver e-mail ou telefone completos ao balconista. O nome completo
> basta para a conferência visual (RN6).

### `POST /api/cards/:serial/stamps`

**O endpoint mais crítico do sistema.**

Headers:
```
Authorization: Bearer {jwt}
Idempotency-Key: {uuid gerado pela PWA na leitura do QR}
```

Body: vazio, ou `{ "note": "..." }` para ajuste manual.

**Lógica obrigatória, em transação:**

1. Se `Idempotency-Key` já existe → devolver resposta armazenada com
   `Idempotent-Replay: true`
2. Buscar cartão com `SELECT ... FOR UPDATE`
3. Se `stamps_count >= required` → `409 CARD_FULL`
4. Se existe selo há menos de 3 min → `409 STAMP_TOO_SOON`
5. `INSERT INTO stamps`
6. `UPDATE cards SET stamps_count = stamps_count + 1`
7. Gravar `idempotency_keys`
8. Commit
9. **Fora da transação:** disparar atualização do passe (Apple + Google)

O passo 9 fora da transação é intencional. Falha de rede com a Apple não pode
desfazer um selo já dado ao cliente.

**201 Created**
```json
{
  "serial": "8f3a...",
  "customer_name": "Maria Silva",
  "stamps": 9,
  "required": 10,
  "reward_available": false,
  "message": "Maria Silva — 9 de 10 selos"
}
```

### `POST /api/cards/:serial/redeem`

Headers: `Authorization`, `Idempotency-Key`.

**Lógica:**
1. `SELECT ... FOR UPDATE`
2. Se `stamps_count < required` → `409 CARD_NOT_FULL`
3. `INSERT INTO redemptions` (cycle atual)
4. `UPDATE cards SET stamps_count = 0, cycle = cycle + 1`
5. Commit → atualizar passe

**201**
```json
{
  "serial": "8f3a...",
  "customer_name": "Maria Silva",
  "reward": "Cookie grátis",
  "new_cycle": 4,
  "stamps": 0,
  "message": "Cookie entregue! Cartão reiniciado."
}
```

---

## 4. Painel (auth de administrador, `role = 'admin'`)

### `GET /api/admin/metrics?days=30`
```json
{
  "customers_total": 342,
  "customers_new": 47,
  "stamps_given": 891,
  "redemptions": 61,
  "cards_near_reward": 28
}
```

### `GET /api/admin/customers?page=1&search=maria`
Lista paginada com saldo e última visita.

### `GET /api/admin/customers/export.csv`
CSV com BOM UTF-8 (para abrir corretamente no Excel brasileiro).
Colunas: `nome, telefone, email, selos, ciclo, cadastro, ultima_visita`.

### `POST /api/admin/staff` / `PATCH /api/admin/staff/:id`
Gestão de funcionários.

---

### `POST /api/admin/cards/:serial/reissue` — reemitir cartão (F5)

Usado quando o cliente trocou de celular. **Mantém serial e selos.**

```json
{ "delivery": "screen" }
```

`delivery`: `screen` (exibe QR na tela do operador, mais rápido) ou `email`
(envia link, válido por 30 min).

**201**
```json
{
  "qr_payload": "https://dominio.com.br/cartao/rei_9dK...",
  "expires_at": "2026-09-05T14:45:00Z",
  "stamps": 8,
  "cycle": 3
}
```

### `GET /api/passes/reissue/:token` — consumir reemissão (público)

Devolve as mesmas URLs de passe do cadastro. Token de uso único.

---

## 4b. Construtor de design (auth `role = 'admin'`)

### `GET /api/admin/design` — design publicado + rascunho
### `PUT /api/admin/design/draft` — salvar rascunho

```json
{
  "colors": {
    "background": "#0A0A0C",
    "foreground": "#FFFFFF",
    "label": "rgba(235,235,245,0.6)",
    "accent": "#FFD60A"
  },
  "logo_asset_id": "ast_...",
  "stamp": {
    "filled_style": "gold_coin",
    "empty_style": "outline",
    "grid": "2x5",
    "strip_background": "transparent"
  },
  "reward": { "badge_text": "COOKIE GRÁTIS", "badge_color": "#FFD60A" },
  "texts": {
    "counter_label": "SELOS",
    "progress": "Quase lá! Faltam {faltam} selos para o seu cookie.",
    "complete": "Cookie grátis liberado!",
    "change_message": "Você tem %@ selos!",
    "terms": "1 selo por compra. 10 selos = 1 cookie grátis."
  }
}
```

### `POST /api/admin/design/preview` — renderizar preview

Body: o config do rascunho + `state` (0 a 10).
Retorna as URLs das imagens de preview para Apple e Google. **Não persiste.**

### `POST /api/admin/design/validate`

Roda as validações bloqueantes de `09-design-system.md`.

```json
{
  "valid": false,
  "errors": [
    { "field": "colors.foreground",
      "message": "Contraste 3.1:1 — mínimo 4.5:1." }
  ],
  "warnings": [
    { "field": "texts.progress",
      "message": "58 caracteres. Pode cortar em telas pequenas." }
  ]
}
```

### `POST /api/admin/design/publish`

Só publica se `validate` retornar `valid: true`.

**Efeitos:** cria nova versão, regenera as 11 imagens de grade, atualiza o
`LoyaltyClass` no Google, enfileira a reemissão progressiva de todos os passes.

**202 Accepted**
```json
{
  "version": 4,
  "cards_to_update": 342,
  "estimated_minutes": 12
}
```

> **Limite de uma publicação por dia** (RN8). Cada publicação notifica todos os
> clientes. Retornar `429` com a data da próxima janela se violado.

### `POST /api/admin/design/rollback/:version`

Reverte para uma versão anterior. Conta no limite diário.

---

## 5. Web Service da Apple (obrigatório, formato fixo)

**Estes endpoints têm caminho, método e resposta definidos pela Apple.
Não alterar nada.** A URL base é declarada no `webServiceURL` do `pass.json`.

Auth em todos: `Authorization: ApplePass {card.auth_token}`

### Registrar device
```
POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
Body: { "pushToken": "..." }
```
- `201` se novo registro
- `200` se já existia
- `401` se o token não bater

### Listar passes atualizados
```
GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince={tag}
```
- `200` com `{ "serialNumbers": [...], "lastUpdated": "..." }`
- `204` se nada mudou (**sem body**)

`lastUpdated` é uma string opaca; usar o timestamp do `updated_at` mais recente.

### Baixar o passe atualizado
```
GET /v1/passes/{passTypeIdentifier}/{serialNumber}
```
- `200` com o `.pkpass`
- Respeitar `If-Modified-Since` → `304` quando aplicável

### Cancelar registro
```
DELETE /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
```
- `200`, deletar a linha em `apple_devices`

### Log de erros (opcional mas recomendado)
```
POST /v1/log
Body: { "logs": ["...", "..."] }
```
Sem auth. A Apple envia aqui os erros do device. **Implementar** — é a principal
ferramenta de diagnóstico quando um passe não atualiza.

---

## Regras transversais

- **Rate limit** em `/api/enroll` (10/min por IP) e no web service da Apple.
- **CORS**: liberar apenas os domínios do front.
- **Logs**: nunca gravar `auth_token` nem telefone completo.
- **Idempotência** obrigatória em `stamps` e `redeem`. Nos demais, ignorar o header.
