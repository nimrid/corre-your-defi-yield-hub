import { pool } from "./db.js";

/**
 * runMigrations
 *
 * Idempotent schema bootstrapping — safe to run on every startup while the
 * project is still young.  Replace this with a proper migration tool (e.g.
 * dbmate, Flyway, or Prisma Migrate) once the schema stabilises.
 */
export async function runMigrations(): Promise<void> {
  const statements: string[] = [
    // ── Core tables ─────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS users (
       id             SERIAL PRIMARY KEY,
       privy_user_id  TEXT UNIQUE NOT NULL,
       email          TEXT,
       name           TEXT,
       created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS wallets (
       id          SERIAL PRIMARY KEY,
       user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       chain_type  TEXT NOT NULL,
       address     TEXT NOT NULL,
       is_linked   BOOLEAN NOT NULL DEFAULT FALSE,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS transactions (
       id            SERIAL PRIMARY KEY,
       user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       chain_type    TEXT,
       asset_symbol  TEXT,
       amount        TEXT,
       direction     TEXT,
       tx_signature  TEXT,
       from_address  TEXT,
       to_address    TEXT,
       source        TEXT,
       created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS pending_withdrawals (
       id                 SERIAL PRIMARY KEY,
       privy_user_id      TEXT NOT NULL,
       owner              TEXT NOT NULL,
       withdrawal_id      INTEGER NOT NULL,
       mint_address       TEXT NOT NULL,
       native_amount      TEXT NOT NULL,
       created_timestamp  BIGINT NOT NULL,
       cooldown_seconds   INTEGER NOT NULL,
       source             TEXT,
       completed          BOOLEAN NOT NULL DEFAULT FALSE,
       completed_at       TIMESTAMPTZ,
       UNIQUE (privy_user_id, withdrawal_id)
     )`,

    `CREATE TABLE IF NOT EXISTS privy_transactions (
       id                         SERIAL PRIMARY KEY,
       transaction_id             TEXT NOT NULL UNIQUE,
       wallet_id                  TEXT NOT NULL,
       caip2                      TEXT NOT NULL,
       user_operation_hash        TEXT,
       transaction_hash           TEXT,
       replacement_transaction_id TEXT,
       status                     TEXT NOT NULL,
       created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       confirmed_at               TIMESTAMPTZ,
       reverted_at                TIMESTAMPTZ,
       failed_at                  TIMESTAMPTZ,
       replaced_at                TIMESTAMPTZ
     )`,

    `CREATE TABLE IF NOT EXISTS suspicious_activity (
       id             SERIAL PRIMARY KEY,
       privy_user_id  TEXT NOT NULL,
       activity_type  TEXT NOT NULL,
       details        JSONB,
       created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS circuit_breaker (
       id          SERIAL PRIMARY KEY,
       name        TEXT NOT NULL,
       enabled     BOOLEAN NOT NULL DEFAULT true,
       reason      TEXT,
       expires_at  TIMESTAMPTZ NOT NULL,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS paj_user_sessions (
       privy_user_id  TEXT PRIMARY KEY,
       email          TEXT,
       session_token  TEXT,
       expires_at     TIMESTAMPTZ,
       is_active      BOOLEAN,
       otp            TEXT,
       otp_pending    BOOLEAN NOT NULL DEFAULT FALSE,
       created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS stock_purchases (
       id                  SERIAL PRIMARY KEY,
       user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       stock_mint          TEXT NOT NULL,
       stock_symbol        TEXT,
       stock_name          TEXT,
       usdc_amount         TEXT NOT NULL,
       shares_amount       TEXT,
       wallet_address      TEXT,
       tx_signature        TEXT,
       jupiter_request_id  TEXT,
       source              TEXT,
       created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS savings_activity (
       id              SERIAL PRIMARY KEY,
       user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       vault_type      TEXT NOT NULL,
       direction       TEXT NOT NULL,
       usdc_amount     TEXT NOT NULL,
       wallet_address  TEXT,
       tx_signature    TEXT,
       source          TEXT,
       created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS stock_sales (
       id                  SERIAL PRIMARY KEY,
       user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       stock_mint          TEXT NOT NULL,
       stock_symbol        TEXT,
       stock_name          TEXT,
       usdc_amount         TEXT NOT NULL,
       shares_amount       TEXT,
       wallet_address      TEXT,
       tx_signature        TEXT,
       jupiter_request_id  TEXT,
       source              TEXT,
       created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS paj_offramp_orders (
       id              TEXT PRIMARY KEY,
       account_number  TEXT NOT NULL DEFAULT '',
       bank            TEXT NOT NULL DEFAULT '',
       currency        TEXT NOT NULL DEFAULT 'NGN',
       amount_usdc     NUMERIC NOT NULL DEFAULT 0,
       amount_fiat     NUMERIC,
       rate            NUMERIC,
       fee             NUMERIC,
       status          TEXT NOT NULL DEFAULT 'INIT',
       raw_payload     JSONB,
       created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS paj_onramp_orders (
       id              TEXT PRIMARY KEY,
       account_number  TEXT NOT NULL DEFAULT '',
       account_name    TEXT NOT NULL DEFAULT '',
       bank            TEXT NOT NULL DEFAULT '',
       currency        TEXT NOT NULL DEFAULT 'NGN',
       amount_usdc     NUMERIC NOT NULL DEFAULT 0,
       amount_fiat     NUMERIC,
       mint            TEXT NOT NULL DEFAULT '',
       recipient       TEXT NOT NULL DEFAULT '',
       chain           TEXT NOT NULL DEFAULT 'SOLANA',
       rate            NUMERIC,
       status          TEXT NOT NULL DEFAULT 'INIT',
       raw_payload     JSONB,
       created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,

    `CREATE TABLE IF NOT EXISTS referral_actions (
       id              SERIAL PRIMARY KEY,
       referrer_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       referred_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       action_type     TEXT NOT NULL,
       points          INTEGER NOT NULL,
       created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE(referred_id, action_type)
     )`,

    `CREATE TABLE IF NOT EXISTS private_market_purchases (
       id                  SERIAL PRIMARY KEY,
       user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       investment_id       TEXT NOT NULL,
       amount              NUMERIC NOT NULL,
       receipt_image_url   TEXT NOT NULL,
       status              TEXT NOT NULL DEFAULT 'PENDING',
       expected_shares     NUMERIC,
       created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,


    // ── Column additions (idempotent via ADD COLUMN IF NOT EXISTS) ───────────
    `ALTER TABLE users
       ADD COLUMN IF NOT EXISTS referral_code  TEXT UNIQUE,
       ADD COLUMN IF NOT EXISTS referred_by_id INTEGER REFERENCES users(id)`,

    `ALTER TABLE private_market_purchases
       ADD COLUMN IF NOT EXISTS expected_shares NUMERIC`,

    // ── Indexes ──────────────────────────────────────────────────────────────
    `CREATE INDEX IF NOT EXISTS idx_users_privy_id
       ON users(privy_user_id)`,

    `CREATE INDEX IF NOT EXISTS idx_users_referral_code
       ON users(referral_code)`,

    `CREATE INDEX IF NOT EXISTS idx_wallets_address_chain
       ON wallets(address, chain_type)`,

    `CREATE INDEX IF NOT EXISTS idx_suspicious_activity_user
       ON suspicious_activity(privy_user_id, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_circuit_breaker_name
       ON circuit_breaker(name, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_paj_offramp_orders_status
       ON paj_offramp_orders(status, updated_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_paj_onramp_orders_status
       ON paj_onramp_orders(status, updated_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_paj_onramp_orders_recipient
       ON paj_onramp_orders(recipient, updated_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_stock_purchases_user_id
       ON stock_purchases(user_id)`,

    `CREATE INDEX IF NOT EXISTS idx_stock_sales_user_id
       ON stock_sales(user_id)`,

    `CREATE INDEX IF NOT EXISTS idx_savings_activity_user_id
       ON savings_activity(user_id)`,

    // ── Performance: stock holdings summary table ────────────────────────────
    // Maintained on every buy/sell so getStockHoldings is a simple key lookup
    // instead of a UNION ALL scan over all historical trades.
    `CREATE TABLE IF NOT EXISTS stock_holdings_summary (
       user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       stock_mint TEXT NOT NULL,
       shares     NUMERIC NOT NULL DEFAULT 0,
       updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       PRIMARY KEY (user_id, stock_mint)
     )`,

    `CREATE INDEX IF NOT EXISTS idx_stock_holdings_summary_user
       ON stock_holdings_summary(user_id)`,

    // ── Performance indexes ───────────────────────────────────────────────────
    // Transactions time-range scans (gas sponsorship stats + history)
    `CREATE INDEX IF NOT EXISTS idx_transactions_created_at
       ON transactions(created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_transactions_user_direction
       ON transactions(user_id, direction, created_at DESC)`,

    // Savings time-range scans
    `CREATE INDEX IF NOT EXISTS idx_savings_activity_created_at
       ON savings_activity(created_at DESC)`,

    // Suspicious activity time-range scans
    `CREATE INDEX IF NOT EXISTS idx_suspicious_activity_created_at
       ON suspicious_activity(created_at DESC)`,

    // Wallets lookups (used in gas sponsorship suspicious-pattern check)
    `CREATE INDEX IF NOT EXISTS idx_wallets_user_id
       ON wallets(user_id)`,

    // Stock history queries filter by user_id + created_at
    `CREATE INDEX IF NOT EXISTS idx_stock_purchases_user_created
       ON stock_purchases(user_id, created_at DESC)`,

    `CREATE INDEX IF NOT EXISTS idx_stock_sales_user_created
       ON stock_sales(user_id, created_at DESC)`,

    // Users registration sorting (Admin panel)
    `CREATE INDEX IF NOT EXISTS idx_users_created_at
       ON users(created_at DESC)`,

    // Savings history pagination and sorting
    `CREATE INDEX IF NOT EXISTS idx_savings_activity_user_created
       ON savings_activity(user_id, created_at DESC)`,
  ];

  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      // Log but do not crash — some statements may fail on re-runs if
      // the schema has diverged (e.g. a constraint that already exists
      // under a different name).  Move to a proper migration tool to
      // handle these edge-cases robustly.
      console.error("Migration statement failed:", sql.slice(0, 120), "\n", err);
    }
  }

  console.log("[migrations] Schema bootstrap complete.");
}
