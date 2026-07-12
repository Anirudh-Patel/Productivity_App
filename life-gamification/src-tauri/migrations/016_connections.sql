-- Migration 016: Connections framework (live API integrations) + SimpleFIN account columns
-- Secrets are NOT stored here; they live in the macOS Keychain (service 'life-gamification').

CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL UNIQUE,      -- e.g. 'simplefin'
    status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'error', 'disconnected')),
    last_sync_at DATETIME,
    last_error TEXT,                    -- short, secret-free message from the last failed sync
    metadata TEXT,                      -- JSON blob for provider-specific non-secret state
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Link finance accounts to external providers (SimpleFIN account ids) and store live balances.
ALTER TABLE accounts ADD COLUMN external_id TEXT;
ALTER TABLE accounts ADD COLUMN balance_cents INTEGER;
ALTER TABLE accounts ADD COLUMN currency TEXT DEFAULT 'USD';

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_external_id
    ON accounts(external_id) WHERE external_id IS NOT NULL;
