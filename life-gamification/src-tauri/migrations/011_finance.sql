-- Migration 011: Finance / Spending Tracking (CSV import: bank + Robinhood)

-- Financial accounts (bank checking/savings, credit cards, brokerage)
CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL DEFAULT 'bank' CHECK (kind IN ('bank', 'credit', 'brokerage')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Imported transactions. amount_cents is signed: negative = money out (spending),
-- positive = money in (income/refunds). source_hash dedups re-imported statements.
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    date TEXT NOT NULL,                 -- ISO YYYY-MM-DD
    amount_cents INTEGER NOT NULL,
    merchant TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'uncategorized',
    source TEXT NOT NULL DEFAULT 'csv', -- 'csv' now; 'simplefin'/'plaid' later
    source_label TEXT,                  -- e.g. original filename
    source_hash TEXT NOT NULL UNIQUE,   -- hash(date|amount|merchant|account|occurrence)
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

-- Merchant substring -> category rules. Higher priority wins; first match applies.
CREATE TABLE IF NOT EXISTS category_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern TEXT NOT NULL,              -- case-insensitive substring on merchant/description
    category TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_category_rules_priority ON category_rules(priority DESC);

-- Default accounts so the import UI works out of the box
INSERT OR IGNORE INTO accounts (name, kind) VALUES ('Checking', 'bank');
INSERT OR IGNORE INTO accounts (name, kind) VALUES ('Robinhood', 'brokerage');

-- Seed sensible default categorization rules.
-- 'UBER EATS' outranks 'UBER' (transport) via priority.
INSERT INTO category_rules (pattern, category, priority) VALUES
    ('UBER EATS', 'dining', 20),
    ('DOORDASH', 'dining', 10),
    ('STARBUCKS', 'dining', 10),
    ('CHIPOTLE', 'dining', 10),
    ('MCDONALD', 'dining', 10),
    ('WHOLE FOODS', 'groceries', 10),
    ('TRADER JOE', 'groceries', 10),
    ('SAFEWAY', 'groceries', 10),
    ('COSTCO', 'groceries', 10),
    ('UBER', 'transport', 5),
    ('LYFT', 'transport', 10),
    ('SHELL', 'transport', 10),
    ('CHEVRON', 'transport', 10),
    ('NETFLIX', 'subscriptions', 10),
    ('SPOTIFY', 'subscriptions', 10),
    ('APPLE.COM/BILL', 'subscriptions', 10),
    ('AMAZON', 'shopping', 5),
    ('TARGET', 'shopping', 10),
    ('COMCAST', 'utilities', 10),
    ('VERIZON', 'utilities', 10),
    ('PLANET FITNESS', 'fitness', 10),
    ('PAYROLL', 'income', 10),
    ('DIRECT DEP', 'income', 10),
    ('AIRBNB', 'travel', 10);
