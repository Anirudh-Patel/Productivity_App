# Plan: Connections Framework + SimpleFIN Live Bank Sync

**Date:** 2026-07-12 · **Status:** Approved (interview answered with recommended options; user said "yes") · **Executor:** Claude subagent

## Problem

All integrations so far are credential-free (gh CLI, osascript, folder watch, CSV). Live API connections (SimpleFIN banks first, others later) need a reusable framework: where secrets live, connection status, sync loop, settings UI. Nothing like that exists.

## Interview

**Q1: Where do secrets live?**
- (a) **[RECOMMENDED]** macOS Keychain via the `security` CLI (`add-generic-password -U` / `find-generic-password -w`, service `life-gamification`). Encrypted by OS, survives app rebuilds, never touches SQLite or the public repo. No new crate needed (shell out, same pattern as gh/osascript).
- (b) SQLite table (plaintext at rest — no).
- (c) keyring crate (adds dep; security CLI does the same job).
- **Chosen: (a)**.

**Q2: Framework shape?**
- (a) **[RECOMMENDED]** `connections` table (provider TEXT UNIQUE, status connected|error|disconnected, last_sync_at, last_error, metadata JSON) + generic Rust helpers (`keychain_set/get/delete`) + Settings → Connections panel listing providers with status/connect/disconnect/sync-now. Providers implement: connect(input) → validate + store secret + upsert row; sync() → pull, update status.
- (b) Full plugin trait system (overkill for one user).
- **Chosen: (a)** — table + convention, not abstraction ceremony.

**Q3: SimpleFIN mapping into existing finance tables?**
- (a) **[RECOMMENDED]** SimpleFIN accounts upsert into `accounts` (new `external_id` + `balance_cents` + `currency` columns); transactions into `transactions` with `source='simplefin'`, `source_hash = 'sf:'+simplefin txn id` (their IDs are stable — perfect dedup), amounts to cents, category rules applied same as CSV import. Coexists with CSV imports.
- **Chosen: (a)**.

**Q4: Sync cadence?**
- (a) **[RECOMMENDED]** On app start + every 6h + Sync Now button (banks post transactions slowly; aggressive polling pointless and SimpleFIN rate-limits). Start-date = last_sync_at - 7 days (catch late-posting txns; dedup absorbs overlap).
- **Chosen: (a)**.

## SimpleFIN protocol (for implementer)

1. User pastes **setup token** (base64 string from bridge.simplefin.org after connecting their bank).
2. Claim once: `base64 -d` the token → claim URL → `POST` (empty body) → response body is the **access URL** (`https://user:pass@.../simplefin`). Setup token is now consumed.
3. Store access URL in Keychain (`simplefin_access_url`). Never log it.
4. Sync: `GET {access_url}/accounts?start-date=<unix>` → `{"accounts":[{id, name, currency, balance, "transactions":[{id, posted(unix), amount("-12.34"), description, payee?, memo?}]}]}`.
5. reqwest (rustls) already in Cargo.toml from oauth.rs.

## Implementation

1. Migration `016_connections.sql`: `connections` table; `accounts` +`external_id TEXT UNIQUE`, `+balance_cents INTEGER`, `+currency TEXT DEFAULT 'USD'`.
2. `commands/connections.rs`: keychain helpers, `get_connections`, `disconnect_provider` (delete secret + row update).
3. `commands/simplefin.rs`: `simplefin_connect(setup_token)` (claim → store → initial sync), `simplefin_sync()` (fetch, upsert accounts+transactions, apply category rules, update connections row; robust errors → status='error' + last_error).
4. Frontend: `connectionsStore.ts`; Settings → Connections panel: provider cards (SimpleFIN now; GitHub/Calendar/Reminders/Health shown as "built-in, no credentials" info rows), SimpleFIN card = paste-token input when disconnected / status + last sync + Sync Now + Disconnect when connected. Sync hook: app start + 6h.
5. Finance page unaffected (data flows into same tables); balances shown on Finance page account cards if present.

## Out of scope

Plaid, Robinhood API, webhooks, multi-currency conversion, completing Google OAuth refresh.

## Verification

- cargo check + tests (claim-URL decode, response parsing, amount→cents, dedup on re-sync via fixtures) + tsc-gated build pass.
- Live path requires user's setup token later: paste → accounts+transactions appear in Finance; re-sync no dupes; disconnect wipes Keychain entry.
