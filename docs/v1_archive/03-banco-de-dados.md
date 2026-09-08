# 03 — Banco de Dados

DDL executável em `schema.sql`. Este documento explica o **porquê** de cada
decisão.

## Diagrama

```
stores
   │
   ├──< card_designs           (versionado, 1 publicado)
   │
   ├──< staff
   │      │
   │      ├──< enrollment_invites ──┐  (QR de uso único)
   │      └──< stamps >──┐          │
   │                     │          ▼
customers ──< cards >────┤     (consome e cria customer)
                  │      │
                  ├──< redemptions
                  ├──< apple_devices
                  ├──< reissue_tokens
                  └──< pass_update_log
```

## Tabelas

### `stores`
Uma linha na v1. Existe para não precisar refatorar tudo quando abrir a segunda
unidade. **Não construir UI de multi-loja agora** — apenas a coluna.

### `customers`
- **`email` é a chave natural**, com índice único por loja (case-insensitive).
- `first_name` e `last_name` separados — permitem tratamento pessoal ("Olá,
  Maria") sem quebrar nomes compostos.
- `birth_date` obrigatória. Índice por mês, para campanha de aniversário futura.
  **Só coletar se houver plano de uso** — ver Q10 no PRD.
- `phone_e164` opcional. Ver Q9 no PRD.
- Sem senha, sem `auth_user_id`: **não existe login de cliente.**
- Soft delete via `deleted_at` para atender LGPD sem quebrar o histórico.

### `enrollment_invites`
Convite de uso único emitido pelo operador. O `token` é o que vai dentro do QR.

Regras no banco: `used_at` marca consumo, `expires_at` fecha em 15 minutos,
`issued_by` registra quem emitiu (auditoria). O índice parcial em `expires_at`
cobre só os não usados — é o conjunto que o job de limpeza varre.

Consumir o convite e criar o cliente devem estar **na mesma transação**, com
`SELECT ... FOR UPDATE` no convite. Sem isso, dois cadastros simultâneos com o
mesmo QR passam.

### `card_designs`
Versionamento do design. `config` em JSONB porque o formato vai evoluir e não
vale migração de coluna a cada campo novo.

O índice parcial `idx_design_active` garante, no banco, **um único design
publicado por loja**. Não confiar só na aplicação.

`cards.design_version` diz qual versão está no passe de cada cliente. A
diferença entre ela e a versão publicada é a fila de reemissão.

### `cards`
- `serial` — UUID v4, **imutável**, é o que vai dentro do QR e do passe.
  Alterar invalida o cartão já distribuído (RN5).
- `auth_token` — segredo por cartão, usado pelo web service da Apple no header
  `Authorization: ApplePass {token}`. Gerar com `crypto.randomBytes(32)`.
- `stamps_count` — desnormalizado de propósito. É lido a cada exibição do passe;
  contar a tabela `stamps` toda vez seria desperdício. Manter consistente por
  transação.
- `cycle` — começa em 1, incrementa a cada resgate.
- `updated_at` — usado pelo endpoint da Apple `passesUpdatedSince`. Precisa ser
  atualizado em **toda** mudança que afete o passe.
- `google_object_id` — o ID do `LoyaltyObject` no Google (`{issuerId}.{sufixo}`).
  Guardar porque o `PATCH` precisa dele.

Constraint: `UNIQUE (customer_id)` — um cartão ativo por cliente (RN4).

### `stamps`
Histórico imutável. Nunca deletar, nunca atualizar. Guarda `cycle` para saber
a qual volta o selo pertenceu.

`source` diferencia `staff_scan` (normal), `manual_adjust` (correção do dono) e
`signup_bonus` (se decidir dar 1 selo no cadastro).

### `redemptions`
Um registro por recompensa entregue. Guarda o `cycle` que foi fechado.

### `apple_devices`
**Só existe por causa da Apple.** O Google não precisa de nada equivalente.

Registro do par (device, passe) com o `push_token`. Um device pode registrar
vários passes; um passe pode estar em vários devices (iPhone + iPad + Watch).
Por isso a PK é composta.

O `device_library_identifier` vem da Apple e não é o UDID — é um identificador
opaco por app/passe.

### `idempotency_keys`
Chave única + resposta serializada + expiração. Limpar registros com mais de
24h por job diário (ou `pg_cron` no Supabase).

### `pass_update_log`
Diagnóstico. Quando um passe não atualiza no celular do cliente, este log diz se
o problema foi APNs, Google API ou geração da imagem. Não é auditoria — pode ser
truncado.

## Decisões que importam

### Por que `stamps_count` desnormalizado

Trade-off consciente. O risco é divergir da tabela `stamps`. Mitigar com:
- Toda escrita em transação (`INSERT stamps` + `UPDATE cards` juntos)
- Job semanal de reconciliação que compara e alerta

### Por que não deletar selos no resgate

Perder histórico impede responder "quantos brownies dei este mês?" e torna
impossível investigar fraude. O espaço é irrelevante — 200 linhas/dia são
73 mil linhas/ano.

### Por que o e-mail virou chave, e o que se perde

O conjunto de campos definido (nome, sobrenome, e-mail, nascimento) não inclui
telefone. Consequências:

- Reemissão de cartão por e-mail é mais lenta e tem entrega pior que WhatsApp
- Campanhas futuras ficam limitadas a e-mail

Recomendação técnica: manter `phone_e164` nullable no schema mesmo que o
formulário não colete agora. Adicionar coluna depois é fácil; recuperar telefone
de 300 clientes já cadastrados, não.

### Por que `auth_token` por cartão e não global

Exigência da Apple. Se um token vazasse e fosse global, qualquer pessoa poderia
ler qualquer passe. Por cartão, o dano fica contido a um cliente.

### Timezone

Gravar tudo em `timestamptz` com UTC. Converter para `America/Sao_Paulo`
apenas na camada de apresentação. Erros de fuso em relatórios de "hoje" são o
bug mais comum neste tipo de sistema.

## Consultas de referência

**Estado do cartão para montar o passe:**
```sql
SELECT c.serial, c.stamps_count, c.cycle, c.auth_token, c.design_version,
       cu.first_name, cu.last_name, cu.email
FROM cards c
JOIN customers cu ON cu.id = c.customer_id
WHERE c.serial = $1 AND cu.deleted_at IS NULL;
```

**Consumir convite com trava (evita cadastro duplo com o mesmo QR):**
```sql
SELECT token FROM enrollment_invites
WHERE token = $1 AND used_at IS NULL AND expires_at > now()
FOR UPDATE;
```

**Verificar a janela de idempotência (RN1):**
```sql
SELECT created_at FROM stamps
WHERE card_id = $1 AND created_at > now() - interval '3 minutes'
ORDER BY created_at DESC LIMIT 1;
```

**Passes alterados desde um marco (endpoint Apple):**
```sql
SELECT c.serial, c.updated_at
FROM cards c
JOIN apple_devices d ON d.card_id = c.id
WHERE d.device_library_identifier = $1
  AND c.updated_at > $2
ORDER BY c.updated_at;
```

**Exportação CSV:**
```sql
SELECT cu.first_name, cu.last_name, cu.email, cu.birth_date, cu.phone_e164,
       c.stamps_count, c.cycle, cu.created_at,
       (SELECT max(created_at) FROM stamps WHERE card_id = c.id) AS last_visit
FROM customers cu
JOIN cards c ON c.customer_id = cu.id
WHERE cu.deleted_at IS NULL
ORDER BY cu.created_at DESC;
```

**Fila de reemissão após publicar design:**
```sql
SELECT c.serial FROM cards c
JOIN card_designs d ON d.store_id = c.store_id AND d.status = 'published'
WHERE c.design_version IS DISTINCT FROM d.version
LIMIT 100;
```
