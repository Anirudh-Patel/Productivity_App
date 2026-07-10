# Plan: Spending Tracking (Bank + Robinhood)

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

User wants bank + Robinhood connected for spending tracking (productivity-automation priority #2).

## Interview

**Q1: Live connection vs import?**
- (a) **[RECOMMENDED — phase 1]** CSV/OFX import: every US bank and Robinhood export CSV statements. Build importer (drag-drop or watched folder), transactions table, categorization, spending dashboard. Works today with zero third-party accounts.
- (b) Plaid — requires Plaid account, API keys, per-institution quirks; free tier limited. 
- (c) SimpleFIN Bridge — cheap ($1.50/mo) aggregator with simple token API, good for personal apps.
- **Chosen: (a) now**, with schema designed so (c) SimpleFIN can layer on later. (b)/(c) BLOCKED on user signing up — noted as follow-up requiring user action.

**Q2: Robinhood specifics?**
- (a) **[RECOMMENDED]** Treat Robinhood as another CSV source (account statements + activity export). Track cash flows (deposits/withdrawals/buys/sells) as transactions with account='robinhood'; portfolio value tracking out of scope for v1.
- (b) Unofficial Robinhood API (fragile, MFA hurdles, ToS risk).
- **Chosen: (a)**.

**Q3: Categorization?**
- (a) **[RECOMMENDED]** Rule-based: `category_rules` table (substring/regex on merchant → category), seeded with common defaults (groceries, dining, transport, subscriptions…); unmatched → 'uncategorized' with quick recategorize UI that offers "always categorize X as Y" (creates rule).
- (b) ML/LLM categorization.
- **Chosen: (a)** — deterministic, no external calls.

**Q4: Where in the app?**
- (a) **[RECOMMENDED]** New "Finance" page (sidebar): import button, monthly spending summary cards, category breakdown donut, recent transactions list with recategorize, month-over-month bar chart (recharts already a dependency). Optional gamification hook: staying under a monthly budget grants XP (budget field in preferences) — small, since gaming is second priority now.
- **Chosen: (a)**.

## Implementation

1. Migration `011_finance.sql`: `accounts` (id, name, kind bank|brokerage), `transactions` (id, account_id, date, amount_cents, merchant, description, category, source_hash UNIQUE for dedup, imported_at), `category_rules` (pattern, category, priority).
2. Rust `src-tauri/src/commands/finance.rs`: `import_transactions_csv(account_id, path_or_content, mapping)` — robust CSV parse (csv crate), auto-detect common column layouts (Chase/BofA/Amex/Robinhood headers), dedup via source_hash (date|amount|merchant), apply rules; `get_transactions(filters)`, `get_spending_summary(month)`, `set_category(txn, cat, create_rule)`, account CRUD.
3. Frontend: Finance page + route + sidebar entry; file open via Tauri dialog plugin (add `tauri-plugin-dialog` if absent) reading file in Rust.
4. Seed default category rules migration-side.

## Out of scope (follow-ups needing user action)

- SimpleFIN/Plaid live sync (user must create account; schema ready — transactions.source distinguishes import vs api).
- Robinhood portfolio/positions.
- Budgets beyond a single monthly total.

## Verification

- `cargo check` + `npm run build` pass. Import a synthetic Chase-format and Robinhood-format CSV twice → rows appear once (dedup), categories applied, summary numbers correct (hand-check one month).
