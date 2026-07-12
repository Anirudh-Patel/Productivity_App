// SimpleFIN bank sync provider (https://www.simplefin.org/protocol.html).
//
// connect: user pastes a setup token (base64-encoded claim URL from
// bridge.simplefin.org) -> POST the claim URL once (token is consumed) ->
// response body is the access URL (https://user:pass@host/simplefin), which is
// stored ONLY in the macOS Keychain (see connections.rs). NEVER log it.
//
// sync: GET {access_url}/accounts?start-date=<unix> -> upsert accounts (live
// balances) and transactions into the existing finance tables, reusing the
// CSV importer's category rules. Dedup via source_hash = 'sf:<txn id>'
// (SimpleFIN transaction ids are stable).

use rusqlite::{Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::connections;
use crate::commands::finance;
use crate::database::DbConnection;

pub const SIMPLEFIN_KEYCHAIN_ACCOUNT: &str = "simplefin_access_url";

const HTTP_TIMEOUT_SECS: u64 = 30;
const INITIAL_BACKFILL_DAYS: i64 = 90;
const RESYNC_OVERLAP_DAYS: i64 = 7; // catch late-posting transactions; dedup absorbs overlap
const DAY_SECS: i64 = 86_400;

// ---------- Types ----------

#[derive(Debug, Deserialize)]
pub struct SfAccountSet {
    #[serde(default)]
    pub accounts: Vec<SfAccount>,
}

#[derive(Debug, Deserialize)]
pub struct SfAccount {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub currency: Option<String>,
    pub balance: String, // decimal string, e.g. "1210.44"
    #[serde(default)]
    pub transactions: Vec<SfTransaction>,
}

#[derive(Debug, Deserialize)]
pub struct SfTransaction {
    pub id: String,
    pub posted: i64,    // unix seconds
    pub amount: String, // decimal string, e.g. "-12.34"
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub payee: Option<String>,
    #[serde(default)]
    pub memo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct SimplefinSyncSummary {
    pub accounts_synced: i64,
    pub transactions_imported: i64,
    pub transactions_duplicates: i64,
}

// ---------- Pure helpers (unit-testable) ----------

/// Minimal base64 decoder (standard + URL-safe alphabets, padding/whitespace
/// tolerated). Avoids a new crate for one small decode.
fn base64_decode(input: &str) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    let mut acc: u32 = 0;
    let mut bits = 0u32;
    for c in input.chars() {
        if c.is_whitespace() || c == '=' {
            continue;
        }
        let v = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '+' | '-' => 62,
            '/' | '_' => 63,
            _ => return Err("Setup token is not valid base64".to_string()),
        };
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            buf.push((acc >> bits) as u8);
        }
    }
    Ok(buf)
}

/// Decode a SimpleFIN setup token into its claim URL.
pub fn decode_setup_token(token: &str) -> Result<String, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Setup token is empty".to_string());
    }
    let bytes = base64_decode(token)?;
    let claim_url = String::from_utf8(bytes)
        .map_err(|_| "Setup token did not decode to text".to_string())?
        .trim()
        .to_string();
    if !claim_url.starts_with("http://") && !claim_url.starts_with("https://") {
        return Err("Setup token did not decode to a claim URL — paste the token from bridge.simplefin.org".to_string());
    }
    Ok(claim_url)
}

pub fn parse_accounts_response(body: &str) -> Result<SfAccountSet, String> {
    serde_json::from_str(body).map_err(|e| format!("Failed to parse SimpleFIN response: {}", e))
}

/// start-date for the /accounts query: last_sync_at minus a 7-day overlap,
/// or a 90-day backfill on first sync. last_sync_at is SQLite's UTC
/// "YYYY-MM-DD HH:MM:SS".
fn start_date_from(last_sync_at: Option<&str>, now_unix: i64) -> i64 {
    match last_sync_at
        .and_then(|s| chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S").ok())
        .map(|dt| dt.and_utc().timestamp())
    {
        Some(ts) => ts - RESYNC_OVERLAP_DAYS * DAY_SECS,
        None => now_unix - INITIAL_BACKFILL_DAYS * DAY_SECS,
    }
}

fn posted_to_date(posted: i64) -> String {
    chrono::DateTime::from_timestamp(posted, 0)
        .map(|dt| dt.format("%Y-%m-%d").to_string())
        .unwrap_or_else(|| "1970-01-01".to_string())
}

/// Keep last_error short and readable in the UI.
fn short_error(e: &str) -> String {
    e.trim().chars().take(200).collect()
}

/// Upsert a SimpleFIN account into `accounts` (matched by external_id),
/// refreshing the live balance. New accounts get a collision-safe name.
fn upsert_account(conn: &Connection, account: &SfAccount) -> Result<i64, String> {
    let balance_cents = finance::parse_amount_cents(&account.balance);
    let currency = account.currency.clone().unwrap_or_else(|| "USD".to_string());

    let existing: Option<i64> = conn
        .query_row("SELECT id FROM accounts WHERE external_id = ?1", [&account.id], |row| row.get(0))
        .optional()
        .map_err(|e| format!("Failed to look up account: {}", e))?;

    if let Some(id) = existing {
        conn.execute(
            "UPDATE accounts SET balance_cents = ?1, currency = ?2 WHERE id = ?3",
            rusqlite::params![balance_cents, currency, id],
        )
        .map_err(|e| format!("Failed to update account balance: {}", e))?;
        return Ok(id);
    }

    // accounts.name is UNIQUE — suffix if a CSV account already uses the name.
    let base_name = {
        let trimmed = account.name.trim();
        if trimmed.is_empty() { "SimpleFIN Account" } else { trimmed }
    };
    let mut name = base_name.to_string();
    let mut suffix = 1i64;
    loop {
        let taken: i64 = conn
            .query_row("SELECT COUNT(*) FROM accounts WHERE name = ?1", [&name], |row| row.get(0))
            .map_err(|e| format!("Failed to check account name: {}", e))?;
        if taken == 0 {
            break;
        }
        suffix += 1;
        name = format!("{} ({})", base_name, suffix);
    }

    conn.execute(
        "INSERT INTO accounts (name, kind, external_id, balance_cents, currency)
         VALUES (?1, 'bank', ?2, ?3, ?4)",
        rusqlite::params![name, account.id, balance_cents, currency],
    )
    .map_err(|e| format!("Failed to create account: {}", e))?;
    Ok(conn.last_insert_rowid())
}

/// Import a parsed SimpleFIN account set into the finance tables.
/// Pure Connection fn so it's unit-testable against an in-memory DB.
pub fn import_simplefin_into(conn: &Connection, set: &SfAccountSet) -> Result<SimplefinSyncSummary, String> {
    let rules = finance::load_rules(conn)?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut summary = SimplefinSyncSummary::default();

    for account in &set.accounts {
        let account_id = upsert_account(&tx, account)?;

        for txn in &account.transactions {
            // Skip unparseable amounts instead of failing the whole sync.
            let amount_cents = match finance::parse_amount_cents(&txn.amount) {
                Some(cents) => cents,
                None => continue,
            };
            let date = posted_to_date(txn.posted);
            let merchant = txn
                .payee
                .as_deref()
                .map(str::trim)
                .filter(|p| !p.is_empty())
                .unwrap_or_else(|| txn.description.trim());
            let merchant = if merchant.is_empty() { "Unknown" } else { merchant };
            let base_description = txn.description.trim();
            let description = match txn.memo.as_deref().map(str::trim).filter(|m| !m.is_empty()) {
                Some(memo) if memo != base_description && !base_description.is_empty() => {
                    format!("{} — {}", base_description, memo)
                }
                Some(memo) if base_description.is_empty() => memo.to_string(),
                _ => base_description.to_string(),
            };
            // Same category-rule application as the CSV importer (shared fns).
            let category = finance::categorize(&rules, merchant, &description, None);
            let source_hash = format!("sf:{}", txn.id); // stable SimpleFIN id -> perfect dedup

            let inserted = tx
                .execute(
                    "INSERT OR IGNORE INTO transactions
                     (account_id, date, amount_cents, merchant, description, category, source, source_label, source_hash)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'simplefin', 'simplefin', ?7)",
                    rusqlite::params![account_id, date, amount_cents, merchant, description, category, source_hash],
                )
                .map_err(|e| format!("Failed to insert transaction: {}", e))?;

            if inserted > 0 {
                summary.transactions_imported += 1;
            } else {
                summary.transactions_duplicates += 1;
            }
        }
        summary.accounts_synced += 1;
    }

    tx.commit().map_err(|e| format!("Failed to commit SimpleFIN import: {}", e))?;
    Ok(summary)
}

// ---------- HTTP ----------

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(HTTP_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))
}

/// Strip URLs from reqwest errors — the access URL embeds credentials and
/// must never leak into last_error or returned messages.
fn sanitize_reqwest_error(e: reqwest::Error) -> String {
    let e = e.without_url();
    if e.is_timeout() {
        "request timed out".to_string()
    } else if e.is_connect() {
        "could not connect to server".to_string()
    } else {
        e.to_string()
    }
}

/// Split the credentials out of a SimpleFIN access URL so requests use
/// explicit basic auth on a credential-free URL.
fn split_access_url(access_url: &str) -> Result<(reqwest::Url, String, String), String> {
    let mut url = reqwest::Url::parse(access_url.trim())
        .map_err(|_| "Stored SimpleFIN access URL is invalid — disconnect and reconnect".to_string())?;
    if !url.has_host() {
        return Err("Stored SimpleFIN access URL is invalid — disconnect and reconnect".to_string());
    }
    let user = url.username().to_string();
    let pass = url.password().unwrap_or("").to_string();
    url.set_username("").map_err(|_| "Failed to normalize access URL".to_string())?;
    url.set_password(None).map_err(|_| "Failed to normalize access URL".to_string())?;
    Ok((url, user, pass))
}

// ---------- Connection-row helpers ----------

fn upsert_connection_status(conn: &Connection, status: &str, last_error: Option<&str>) -> Result<(), String> {
    conn.execute(
        "INSERT INTO connections (provider, status, last_error) VALUES ('simplefin', ?1, ?2)
         ON CONFLICT(provider) DO UPDATE SET status = ?1, last_error = ?2",
        rusqlite::params![status, last_error],
    )
    .map_err(|e| format!("Failed to update connection status: {}", e))?;
    Ok(())
}

async fn record_error(db: &DbConnection, message: &str) {
    let conn = db.lock().await;
    let _ = upsert_connection_status(&conn, "error", Some(&short_error(message)));
}

// ---------- Sync core ----------

async fn sync_inner(db: &DbConnection, access_url: &str) -> Result<SimplefinSyncSummary, String> {
    let last_sync_at: Option<String> = {
        let conn = db.lock().await;
        conn.query_row(
            "SELECT last_sync_at FROM connections WHERE provider = 'simplefin'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read last sync time: {}", e))?
        .flatten()
    };
    let start_date = start_date_from(last_sync_at.as_deref(), chrono::Utc::now().timestamp());

    let (base_url, user, pass) = split_access_url(access_url)?;
    let mut url = base_url;
    let accounts_path = format!("{}/accounts", url.path().trim_end_matches('/'));
    url.set_path(&accounts_path);
    url.query_pairs_mut().append_pair("start-date", &start_date.to_string());

    let response = http_client()?
        .get(url)
        .basic_auth(&user, Some(&pass))
        .send()
        .await
        .map_err(|e| format!("SimpleFIN request failed: {}", sanitize_reqwest_error(e)))?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("SimpleFIN sync failed with HTTP {}", status.as_u16()));
    }
    let body = response
        .text()
        .await
        .map_err(|e| format!("Failed to read SimpleFIN response: {}", sanitize_reqwest_error(e)))?;
    let set = parse_accounts_response(&body)?;

    let conn = db.lock().await;
    let summary = import_simplefin_into(&conn, &set)?;
    conn.execute(
        "INSERT INTO connections (provider, status, last_sync_at, last_error)
         VALUES ('simplefin', 'connected', CURRENT_TIMESTAMP, NULL)
         ON CONFLICT(provider) DO UPDATE SET status = 'connected', last_sync_at = CURRENT_TIMESTAMP, last_error = NULL",
        [],
    )
    .map_err(|e| format!("Failed to stamp sync time: {}", e))?;
    Ok(summary)
}

// ---------- Commands ----------

/// Claim a pasted setup token, store the resulting access URL in the Keychain,
/// and run an initial sync. Setup tokens are single-use.
#[tauri::command]
pub async fn simplefin_connect(db: State<'_, DbConnection>, setup_token: String) -> Result<SimplefinSyncSummary, String> {
    let result = connect_inner(db.inner(), &setup_token).await;
    if let Err(e) = &result {
        record_error(db.inner(), e).await;
    }
    result
}

async fn connect_inner(db: &DbConnection, setup_token: &str) -> Result<SimplefinSyncSummary, String> {
    let claim_url = decode_setup_token(setup_token)?;

    let response = http_client()?
        .post(claim_url)
        .header("Content-Length", "0")
        .send()
        .await
        .map_err(|e| format!("SimpleFIN claim request failed: {}", sanitize_reqwest_error(e)))?;
    let status = response.status();
    if !status.is_success() {
        return Err(format!(
            "SimpleFIN claim failed with HTTP {} — setup tokens are single-use; get a fresh one from bridge.simplefin.org",
            status.as_u16()
        ));
    }
    let access_url = response
        .text()
        .await
        .map_err(|e| format!("Failed to read claim response: {}", sanitize_reqwest_error(e)))?
        .trim()
        .to_string();
    split_access_url(&access_url)?; // validate before storing

    connections::keychain_set(SIMPLEFIN_KEYCHAIN_ACCOUNT, &access_url)?;
    {
        let conn = db.lock().await;
        upsert_connection_status(&conn, "connected", None)?;
    }

    sync_inner(db, &access_url).await
}

/// Pull accounts + transactions from SimpleFIN into the finance tables.
#[tauri::command]
pub async fn simplefin_sync(db: State<'_, DbConnection>) -> Result<SimplefinSyncSummary, String> {
    let access_url = match connections::keychain_get(SIMPLEFIN_KEYCHAIN_ACCOUNT)? {
        Some(url) if !url.is_empty() => url,
        _ => {
            let conn = db.lock().await;
            let _ = conn.execute(
                "UPDATE connections SET status = 'disconnected' WHERE provider = 'simplefin'",
                [],
            );
            return Err("SimpleFIN is not connected — paste a setup token in Settings → Connections.".to_string());
        }
    };

    match sync_inner(db.inner(), &access_url).await {
        Ok(summary) => Ok(summary),
        Err(e) => {
            record_error(db.inner(), &e).await;
            Err(e)
        }
    }
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../../tests/fixtures/simplefin_accounts.json");
    // base64 of "https://bridge.simplefin.org/simplefin/claim/demo"
    const DEMO_TOKEN: &str = "aHR0cHM6Ly9icmlkZ2Uuc2ltcGxlZmluLm9yZy9zaW1wbGVmaW4vY2xhaW0vZGVtbw==";

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch(include_str!("../../migrations/011_finance.sql"))
            .expect("apply finance migration");
        conn.execute_batch(include_str!("../../migrations/016_connections.sql"))
            .expect("apply connections migration");
        conn
    }

    #[test]
    fn decodes_setup_token_to_claim_url() {
        assert_eq!(
            decode_setup_token(DEMO_TOKEN).unwrap(),
            "https://bridge.simplefin.org/simplefin/claim/demo"
        );
        // Padding-free, whitespace-wrapped, and URL-safe variants all decode.
        assert_eq!(
            decode_setup_token(&format!("  {}\n", DEMO_TOKEN.trim_end_matches('='))).unwrap(),
            "https://bridge.simplefin.org/simplefin/claim/demo"
        );
        assert!(decode_setup_token("").is_err());
        assert!(decode_setup_token("!!!not base64!!!").is_err());
        // Valid base64 but not a URL.
        assert!(decode_setup_token("aGVsbG8gd29ybGQ=").is_err());
    }

    #[test]
    fn parses_accounts_response_fixture() {
        let set = parse_accounts_response(FIXTURE).expect("parse fixture");
        assert_eq!(set.accounts.len(), 2);

        let checking = &set.accounts[0];
        assert_eq!(checking.id, "ACT-1a2b3c");
        assert_eq!(checking.name, "Checking");
        assert_eq!(finance::parse_amount_cents(&checking.balance), Some(121044));
        assert_eq!(checking.transactions.len(), 3);
        assert_eq!(finance::parse_amount_cents(&checking.transactions[0].amount), Some(-1234));
        assert_eq!(finance::parse_amount_cents(&checking.transactions[1].amount), Some(250000));
        assert_eq!(checking.transactions[0].payee.as_deref(), Some("Starbucks"));

        let savings = &set.accounts[1];
        assert!(savings.currency.is_none());
        assert_eq!(finance::parse_amount_cents(&savings.balance), Some(-5025));
        assert!(savings.transactions.is_empty());
    }

    #[test]
    fn import_upserts_accounts_applies_rules_and_dedups() {
        let conn = test_conn();
        let set = parse_accounts_response(FIXTURE).unwrap();

        let first = import_simplefin_into(&conn, &set).expect("first import");
        assert_eq!(first.accounts_synced, 2);
        assert_eq!(first.transactions_imported, 3);
        assert_eq!(first.transactions_duplicates, 0);

        // Seeded CSV account is already named "Checking" -> SimpleFIN one gets suffixed.
        let (name, balance, currency): (String, i64, String) = conn
            .query_row(
                "SELECT name, balance_cents, currency FROM accounts WHERE external_id = 'ACT-1a2b3c'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("simplefin checking exists");
        assert_eq!(name, "Checking (2)");
        assert_eq!(balance, 121044);
        assert_eq!(currency, "USD");

        // Category rules from the CSV importer apply identically.
        let category_of = |hash: &str| -> String {
            conn.query_row(
                "SELECT category FROM transactions WHERE source_hash = ?1",
                [hash],
                |row| row.get(0),
            )
            .expect("transaction present")
        };
        assert_eq!(category_of("sf:TXN-001"), "dining"); // Starbucks
        assert_eq!(category_of("sf:TXN-002"), "income"); // Payroll
        assert_eq!(category_of("sf:TXN-003"), "groceries"); // Whole Foods

        // Dates come from unix `posted`, source is tagged.
        let (date, source, merchant): (String, String, String) = conn
            .query_row(
                "SELECT date, source, merchant FROM transactions WHERE source_hash = 'sf:TXN-001'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(date, "2025-06-29");
        assert_eq!(source, "simplefin");
        assert_eq!(merchant, "Starbucks"); // payee preferred over description

        // Re-sync: everything dedups on 'sf:<id>', balance refresh keeps one account.
        let second = import_simplefin_into(&conn, &set).expect("re-import");
        assert_eq!(second.transactions_imported, 0);
        assert_eq!(second.transactions_duplicates, 3);
        let sf_accounts: i64 = conn
            .query_row("SELECT COUNT(*) FROM accounts WHERE external_id IS NOT NULL", [], |row| row.get(0))
            .unwrap();
        assert_eq!(sf_accounts, 2);
        let txn_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(txn_count, 3);
    }

    #[test]
    fn start_date_overlaps_and_backfills() {
        let now = 1_752_000_000i64;
        // No previous sync -> 90-day backfill.
        assert_eq!(start_date_from(None, now), now - 90 * DAY_SECS);
        // Previous sync -> that time minus 7 days.
        // 2026-07-05 10:00:00 UTC = 1783245600
        assert_eq!(
            start_date_from(Some("2026-07-05 10:00:00"), now),
            1_783_245_600 - 7 * DAY_SECS
        );
        // Unparseable stamp falls back to backfill.
        assert_eq!(start_date_from(Some("garbage"), now), now - 90 * DAY_SECS);
    }

    #[test]
    fn splits_credentials_out_of_access_url() {
        let (url, user, pass) =
            split_access_url("https://alice:s3cret@bridge.example.org/simplefin").unwrap();
        assert_eq!(user, "alice");
        assert_eq!(pass, "s3cret");
        assert_eq!(url.as_str(), "https://bridge.example.org/simplefin");
        assert!(split_access_url("not a url").is_err());
    }
}
