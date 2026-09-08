-- =====================================================================
-- Cartão Fidelidade Digital — Schema PostgreSQL 15+
-- Executar em ordem. Compatível com Supabase.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- Lojas
-- ---------------------------------------------------------------------
CREATE TABLE stores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    slug            TEXT        NOT NULL UNIQUE,
    timezone        TEXT        NOT NULL DEFAULT 'America/Sao_Paulo',
    stamps_required SMALLINT    NOT NULL DEFAULT 10,
    reward_label    TEXT        NOT NULL DEFAULT 'Cookie grátis',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT stamps_required_valid CHECK (stamps_required BETWEEN 1 AND 20)
);

-- ---------------------------------------------------------------------
-- Funcionários e administradores
-- ---------------------------------------------------------------------
CREATE TABLE staff (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id     UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    auth_user_id UUID        NOT NULL UNIQUE,  -- id do Supabase Auth
    name         TEXT        NOT NULL,
    role         TEXT        NOT NULL DEFAULT 'clerk',
    active       BOOLEAN     NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT role_valid CHECK (role IN ('clerk', 'admin'))
);

CREATE INDEX idx_staff_store ON staff(store_id) WHERE active;

-- ---------------------------------------------------------------------
-- Convites de cadastro (QR emitido pelo operador)
-- Uso único, expiração curta.
-- ---------------------------------------------------------------------
CREATE TABLE enrollment_invites (
    token       TEXT        PRIMARY KEY,          -- vai dentro do QR
    store_id    UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    issued_by   UUID        REFERENCES staff(id) ON DELETE SET NULL,

    used_at     TIMESTAMPTZ,
    customer_id UUID,                             -- preenchido ao consumir
    expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_expiry ON enrollment_invites(expires_at)
    WHERE used_at IS NULL;
CREATE INDEX idx_invites_issuer ON enrollment_invites(issued_by, created_at DESC);

-- ---------------------------------------------------------------------
-- Clientes
-- Chave natural: e-mail. Sem login, sem senha — não existe área do cliente.
-- ---------------------------------------------------------------------
CREATE TABLE customers (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id      UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    first_name    TEXT        NOT NULL,
    last_name     TEXT        NOT NULL,
    email         TEXT        NOT NULL,
    birth_date    DATE        NOT NULL,
    phone_e164    TEXT,                            -- opcional (ver Q9 no PRD)

    consent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at    TIMESTAMPTZ,

    CONSTRAINT email_format  CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT phone_format  CHECK (phone_e164 IS NULL
                                    OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
    CONSTRAINT name_not_blank CHECK (length(trim(first_name)) > 0
                                     AND length(trim(last_name)) > 0),
    CONSTRAINT birth_plausible CHECK (birth_date > '1900-01-01'
                                      AND birth_date < CURRENT_DATE)
);

-- E-mail único por loja, ignorando excluídos
CREATE UNIQUE INDEX idx_customers_email
    ON customers(store_id, lower(email))
    WHERE deleted_at IS NULL;

-- Aniversariantes do mês (campanha futura)
CREATE INDEX idx_customers_birthday
    ON customers(store_id, (extract(month from birth_date)))
    WHERE deleted_at IS NULL;

ALTER TABLE enrollment_invites
    ADD CONSTRAINT fk_invite_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------
-- Design do cartão (versionado)
-- ---------------------------------------------------------------------
CREATE TABLE card_designs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    version     INTEGER     NOT NULL,

    config      JSONB       NOT NULL,   -- cores, estilo de selo, textos, assets
    status      TEXT        NOT NULL DEFAULT 'draft',

    published_at TIMESTAMPTZ,
    published_by UUID       REFERENCES staff(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT design_status_valid CHECK (status IN ('draft','published','archived')),
    CONSTRAINT design_version_unique UNIQUE (store_id, version)
);

-- Apenas um design publicado por loja
CREATE UNIQUE INDEX idx_design_active
    ON card_designs(store_id)
    WHERE status = 'published';

-- ---------------------------------------------------------------------
-- Cartões
-- ---------------------------------------------------------------------
CREATE TABLE cards (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    store_id         UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    serial           TEXT        NOT NULL UNIQUE,  -- vai no QR e no passe. IMUTÁVEL.
    auth_token       TEXT        NOT NULL,         -- Apple web service

    stamps_count     SMALLINT    NOT NULL DEFAULT 0,
    cycle            INTEGER     NOT NULL DEFAULT 1,

    design_version   INTEGER,                      -- versão aplicada ao passe
    google_object_id TEXT UNIQUE,
    apple_issued_at  TIMESTAMPTZ,
    google_issued_at TIMESTAMPTZ,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT one_card_per_customer UNIQUE (customer_id),
    CONSTRAINT stamps_in_range CHECK (stamps_count >= 0 AND stamps_count <= 20),
    CONSTRAINT cycle_positive CHECK (cycle >= 1)
);

CREATE INDEX idx_cards_updated ON cards(updated_at);
CREATE INDEX idx_cards_store   ON cards(store_id);
-- Cartões com design desatualizado (fila de reemissão após publicar)
CREATE INDEX idx_cards_stale_design ON cards(store_id, design_version);

-- updated_at automático — crítico para passesUpdatedSince da Apple
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cards_touch_updated
    BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ---------------------------------------------------------------------
-- Selos (histórico imutável)
-- ---------------------------------------------------------------------
CREATE TABLE stamps (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id    UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    staff_id   UUID        REFERENCES staff(id) ON DELETE SET NULL,
    store_id   UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    cycle      INTEGER     NOT NULL,
    source     TEXT        NOT NULL DEFAULT 'staff_scan',
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT source_valid
        CHECK (source IN ('staff_scan', 'manual_adjust', 'signup_bonus', 'migration'))
);

CREATE INDEX idx_stamps_card_time  ON stamps(card_id, created_at DESC);
CREATE INDEX idx_stamps_store_time ON stamps(store_id, created_at DESC);
CREATE INDEX idx_stamps_staff      ON stamps(staff_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Resgates
-- ---------------------------------------------------------------------
CREATE TABLE redemptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id      UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    staff_id     UUID        REFERENCES staff(id) ON DELETE SET NULL,
    store_id     UUID        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,

    cycle        INTEGER     NOT NULL,
    reward_label TEXT        NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT one_redemption_per_cycle UNIQUE (card_id, cycle)
);

CREATE INDEX idx_redemptions_store_time ON redemptions(store_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Devices Apple (não existe equivalente no Google)
-- ---------------------------------------------------------------------
CREATE TABLE apple_devices (
    device_library_identifier TEXT        NOT NULL,
    card_id                   UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    push_token                TEXT        NOT NULL,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (device_library_identifier, card_id)
);

CREATE INDEX idx_apple_devices_card ON apple_devices(card_id);

-- ---------------------------------------------------------------------
-- Idempotência
-- ---------------------------------------------------------------------
CREATE TABLE idempotency_keys (
    key          TEXT        PRIMARY KEY,
    endpoint     TEXT        NOT NULL,
    response     JSONB       NOT NULL,
    status_code  SMALLINT    NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours'
);

CREATE INDEX idx_idempotency_expiry ON idempotency_keys(expires_at);

-- ---------------------------------------------------------------------
-- Log de atualização de passe (diagnóstico)
-- ---------------------------------------------------------------------
CREATE TABLE pass_update_log (
    id         BIGSERIAL PRIMARY KEY,
    card_id    UUID        REFERENCES cards(id) ON DELETE CASCADE,
    platform   TEXT        NOT NULL,
    ok         BOOLEAN     NOT NULL,
    detail     TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT platform_valid CHECK (platform IN ('apple', 'google'))
);

CREATE INDEX idx_pass_log_card ON pass_update_log(card_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Tokens de reemissão de cartão (fluxo F5 — emitido pela loja)
-- ---------------------------------------------------------------------
CREATE TABLE reissue_tokens (
    token      TEXT        PRIMARY KEY,
    card_id    UUID        NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    issued_by  UUID        REFERENCES staff(id) ON DELETE SET NULL,
    used_at    TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 minutes',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================================
-- Seed inicial
-- =====================================================================
INSERT INTO stores (name, slug, stamps_required, reward_label)
VALUES ('Dessert Club', 'dessert-club', 10, 'Cookie grátis');

-- =====================================================================
-- Manutenção (agendar via pg_cron)
-- =====================================================================
-- DELETE FROM idempotency_keys    WHERE expires_at < now();
-- DELETE FROM reissue_tokens      WHERE expires_at < now() AND used_at IS NULL;
-- DELETE FROM enrollment_invites  WHERE expires_at < now() AND used_at IS NULL;
-- DELETE FROM pass_update_log     WHERE created_at < now() - interval '90 days';

-- Reconciliação semanal: divergência entre stamps_count e o histórico
-- SELECT c.serial, c.stamps_count,
--        (SELECT count(*) FROM stamps s
--          WHERE s.card_id = c.id AND s.cycle = c.cycle) AS real_count
-- FROM cards c
-- WHERE c.stamps_count <> (SELECT count(*) FROM stamps s
--                           WHERE s.card_id = c.id AND s.cycle = c.cycle);

-- Cartões pendentes de reemissão após publicar novo design
-- SELECT c.serial FROM cards c
-- JOIN card_designs d ON d.store_id = c.store_id AND d.status = 'published'
-- WHERE c.design_version IS DISTINCT FROM d.version;
