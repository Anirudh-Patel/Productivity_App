// Finance: CSV transaction import (bank + Robinhood statements) and spending analytics.
// CSV content is passed from the frontend as a string (browser File input + FileReader),
// so no dialog plugin is required. Dedup via a stable FNV-1a hash of
// date|amount|merchant|account (+ per-file occurrence counter for legit same-day dupes).

use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use tauri::State;

use crate::database::DbConnection;

// ---------- Types ----------

#[derive(Debug, Clone, Serialize)]
pub struct FinanceAccount {
    pub id: i64,
    pub name: String,
    pub kind: String,
    pub created_at: Option<String>,
    pub balance_cents: Option<i64>, // live balance from SimpleFIN sync; NULL for CSV-only accounts
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FinanceTransaction {
    pub id: i64,
    pub account_id: i64,
    pub account_name: String,
    pub date: String,
    pub amount_cents: i64,
    pub merchant: String,
    pub description: Option<String>,
    pub category: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct ImportSummary {
    pub detected_format: String,
    pub total_rows: i64,
    pub imported: i64,
    pub duplicates: i64,
    pub skipped: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct CategorySpend {
    pub category: String,
    pub spent_cents: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SpendingSummary {
    pub month: String,
    pub spent_cents: i64,
    pub income_cents: i64,
    pub net_cents: i64,
    pub transaction_count: i64,
    pub by_category: Vec<CategorySpend>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MonthlyTotal {
    pub month: String,
    pub spent_cents: i64,
    pub income_cents: i64,
}

#[derive(Debug, Clone)]
pub struct ParsedTransaction {
    pub date: String, // YYYY-MM-DD
    pub amount_cents: i64,
    pub merchant: String,
    pub description: String,
    pub category_hint: Option<String>,
}

// ---------- Parsing helpers ----------

/// Stable 64-bit FNV-1a hash, hex encoded. Avoids pulling in a crypto crate;
/// only needs to be a stable dedup key, not cryptographically strong.
fn fnv1a_hex(input: &str) -> String {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;
    let mut hash = FNV_OFFSET;
    for byte in input.as_bytes() {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(FNV_PRIME);
    }
    format!("{:016x}", hash)
}

/// Parse a currency string into signed cents without float rounding.
/// Handles "$1,234.56", "-6.45", "($424.00)", "+12", "1.5".
/// Shared with the SimpleFIN importer (amounts arrive as "-12.34" strings).
pub(crate) fn parse_amount_cents(raw: &str) -> Option<i64> {
    let mut s = raw.trim().to_string();
    if s.is_empty() {
        return None;
    }
    let mut negative = false;
    if s.starts_with('(') && s.ends_with(')') && s.len() >= 2 {
        negative = true;
        s = s[1..s.len() - 1].to_string();
    }
    let s = s.replace(['$', ','], "");
    let mut s = s.trim();
    if let Some(rest) = s.strip_prefix('-') {
        negative = true;
        s = rest;
    } else if let Some(rest) = s.strip_prefix('+') {
        s = rest;
    }
    if s.is_empty() {
        return None;
    }
    let (dollars_str, cents_str) = match s.split_once('.') {
        Some((d, c)) => (d, c),
        None => (s, ""),
    };
    let dollars: i64 = if dollars_str.is_empty() {
        0
    } else {
        dollars_str.parse().ok()?
    };
    let padded = format!("{:0<2}", cents_str);
    let cents: i64 = padded.get(..2)?.parse().ok()?;
    let total = dollars.checked_mul(100)?.checked_add(cents)?;
    Some(if negative { -total } else { total })
}

/// Normalize common statement date formats to YYYY-MM-DD.
fn parse_date(raw: &str) -> Option<String> {
    let s = raw.trim();
    if s.is_empty() {
        return None;
    }
    for fmt in ["%m/%d/%Y", "%Y-%m-%d", "%m/%d/%y", "%m-%d-%Y"] {
        if let Ok(date) = chrono::NaiveDate::parse_from_str(s, fmt) {
            return Some(date.format("%Y-%m-%d").to_string());
        }
    }
    None
}

fn clean_text(raw: &str) -> String {
    raw.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[derive(Debug, Clone, PartialEq)]
enum CsvFormat {
    Chase,
    BofA,
    Amex,
    Robinhood,
    Generic,
}

impl CsvFormat {
    fn name(&self) -> &'static str {
        match self {
            CsvFormat::Chase => "chase",
            CsvFormat::BofA => "bofa",
            CsvFormat::Amex => "amex",
            CsvFormat::Robinhood => "robinhood",
            CsvFormat::Generic => "generic",
        }
    }
}

struct ColumnMap {
    format: CsvFormat,
    date: usize,
    description: Option<usize>,
    amount: Option<usize>,
    debit: Option<usize>,
    credit: Option<usize>,
    category: Option<usize>,   // Chase's own category column
    instrument: Option<usize>, // Robinhood ticker
    trans_code: Option<usize>, // Robinhood transaction code
}

fn detect_format(headers: &[String]) -> Option<ColumnMap> {
    let idx = |name: &str| headers.iter().position(|h| h == name);
    let idx_contains = |name: &str| headers.iter().position(|h| h.contains(name));

    if idx_contains("trans code").is_some() {
        // Robinhood activity export
        return Some(ColumnMap {
            format: CsvFormat::Robinhood,
            date: idx("activity date").or_else(|| idx_contains("date"))?,
            description: idx("description"),
            amount: idx("amount"),
            debit: None,
            credit: None,
            category: None,
            instrument: idx("instrument"),
            trans_code: idx_contains("trans code"),
        });
    }
    if idx("transaction date").is_some() && idx("post date").is_some() {
        return Some(ColumnMap {
            format: CsvFormat::Chase,
            date: idx("transaction date")?,
            description: idx("description"),
            amount: idx("amount"),
            debit: None,
            credit: None,
            category: idx("category"),
            instrument: None,
            trans_code: None,
        });
    }
    if idx_contains("running bal").is_some() {
        return Some(ColumnMap {
            format: CsvFormat::BofA,
            date: idx("date").or_else(|| idx_contains("date"))?,
            description: idx("description"),
            amount: idx("amount"),
            debit: None,
            credit: None,
            category: None,
            instrument: None,
            trans_code: None,
        });
    }
    if headers == ["date", "description", "amount"] {
        // Amex export: charges are positive, payments negative -> negated on read.
        return Some(ColumnMap {
            format: CsvFormat::Amex,
            date: 0,
            description: Some(1),
            amount: Some(2),
            debit: None,
            credit: None,
            category: None,
            instrument: None,
            trans_code: None,
        });
    }
    // Generic fallback: fuzzy-match date/description/amount (or debit+credit) columns.
    let date = idx_contains("date")?;
    let description = idx_contains("description")
        .or_else(|| idx_contains("merchant"))
        .or_else(|| idx_contains("payee"))
        .or_else(|| idx_contains("memo"))
        .or_else(|| idx_contains("name"));
    let amount = idx_contains("amount");
    let debit = idx_contains("debit");
    let credit = idx_contains("credit");
    if amount.is_none() && debit.is_none() && credit.is_none() {
        return None;
    }
    Some(ColumnMap {
        format: CsvFormat::Generic,
        date,
        description,
        amount,
        debit,
        credit,
        category: idx("category"),
        instrument: None,
        trans_code: None,
    })
}

/// Map a Robinhood trans code to a spending category.
fn robinhood_category(code: &str) -> Option<String> {
    let code = code.trim().to_uppercase();
    let cat = match code.as_str() {
        "BUY" | "SELL" | "STO" | "BTC" | "OEXP" => "investing",
        "ACH" | "RTP" | "WIRE" => "transfers",
        "CDIV" | "DIV" | "INT" | "SLIP" => "income",
        "GOLD" => "subscriptions",
        "DFEE" | "DTAX" | "AFEE" | "MRGN" => "fees",
        _ => return None,
    };
    Some(cat.to_string())
}

fn get_field(record: &[String], idx: Option<usize>) -> String {
    idx.and_then(|i| record.get(i))
        .map(|s| clean_text(s))
        .unwrap_or_default()
}

/// Parse CSV content into normalized transactions. Auto-detects the layout by
/// locating the header row (statements sometimes have preamble lines) and
/// matching it against known bank/brokerage exports.
pub fn parse_transactions(content: &str) -> Result<(String, Vec<ParsedTransaction>), String> {
    let mut reader = csv::ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .from_reader(content.as_bytes());

    let rows: Vec<Vec<String>> = reader
        .records()
        .filter_map(|r| r.ok())
        .map(|record| record.iter().map(|f| f.to_string()).collect())
        .collect();

    // Find the header row: first row with a date-ish column and an amount-ish column.
    let header_pos = rows.iter().position(|row| {
        let lower: Vec<String> = row.iter().map(|f| f.trim().to_lowercase()).collect();
        lower.iter().any(|f| f.contains("date"))
            && lower
                .iter()
                .any(|f| f.contains("amount") || f.contains("debit") || f.contains("credit"))
    });
    let header_pos = header_pos.ok_or_else(|| {
        "Could not find a header row with date and amount columns. Is this a bank/brokerage CSV export?".to_string()
    })?;

    let headers: Vec<String> = rows[header_pos]
        .iter()
        .map(|f| f.trim().to_lowercase())
        .collect();
    let map = detect_format(&headers)
        .ok_or_else(|| format!("Unrecognized CSV layout (headers: {})", headers.join(", ")))?;

    let mut parsed = Vec::new();
    for record in rows.iter().skip(header_pos + 1) {
        let date = match parse_date(&get_field(record, Some(map.date))) {
            Some(d) => d,
            None => continue, // footer/disclaimer/blank rows
        };

        let amount_cents = if let Some(amount) =
            map.amount.and_then(|i| record.get(i)).and_then(|s| parse_amount_cents(s))
        {
            match map.format {
                CsvFormat::Amex => -amount, // Amex reports charges as positive
                _ => amount,
            }
        } else {
            // Generic debit/credit pair: debit = money out, credit = money in.
            let debit = map.debit.and_then(|i| record.get(i)).and_then(|s| parse_amount_cents(s));
            let credit = map.credit.and_then(|i| record.get(i)).and_then(|s| parse_amount_cents(s));
            match (debit, credit) {
                (None, None) => continue, // e.g. Robinhood rows with no cash movement
                (d, c) => c.unwrap_or(0) - d.unwrap_or(0).abs(),
            }
        };

        let description = get_field(record, map.description);
        let merchant = if map.format == CsvFormat::Robinhood {
            let instrument = get_field(record, map.instrument);
            if instrument.is_empty() {
                description.clone()
            } else {
                let code = get_field(record, map.trans_code);
                format!("{} {}", code, instrument).trim().to_string()
            }
        } else {
            description.clone()
        };
        if merchant.is_empty() && description.is_empty() {
            continue;
        }

        let category_hint = match map.format {
            CsvFormat::Robinhood => {
                robinhood_category(&get_field(record, map.trans_code))
            }
            _ => {
                let hinted = get_field(record, map.category).to_lowercase();
                if hinted.is_empty() {
                    None
                } else {
                    Some(hinted)
                }
            }
        };

        parsed.push(ParsedTransaction {
            date,
            amount_cents,
            merchant: if merchant.is_empty() { description.clone() } else { merchant },
            description,
            category_hint,
        });
    }

    Ok((map.format.name().to_string(), parsed))
}

// ---------- Import core (pure Connection fns, unit-testable) ----------

pub(crate) fn load_rules(conn: &Connection) -> Result<Vec<(String, String)>, String> {
    let mut stmt = conn
        .prepare("SELECT pattern, category FROM category_rules ORDER BY priority DESC, id ASC")
        .map_err(|e| format!("Failed to prepare rules query: {}", e))?;
    let rules: Result<Vec<(String, String)>, _> = stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| format!("Failed to query rules: {}", e))?
        .collect();
    rules.map_err(|e| format!("Failed to collect rules: {}", e))
}

pub(crate) fn categorize(rules: &[(String, String)], merchant: &str, description: &str, hint: Option<&str>) -> String {
    let haystack = format!("{} {}", merchant, description).to_uppercase();
    for (pattern, category) in rules {
        if haystack.contains(&pattern.to_uppercase()) {
            return category.clone();
        }
    }
    hint.map(|h| h.to_string())
        .filter(|h| !h.is_empty())
        .unwrap_or_else(|| "uncategorized".to_string())
}

/// Import CSV content into the transactions table. Returns counts; duplicate rows
/// (same date|amount|merchant|account seen in a previous import) are skipped via
/// the UNIQUE source_hash. Within a single file, identical rows get an occurrence
/// suffix so two same-day identical purchases both import.
pub fn import_csv_into(
    conn: &Connection,
    account_id: i64,
    csv_content: &str,
    source_label: &str,
) -> Result<ImportSummary, String> {
    // Validate account exists up front for a clear error message.
    let account_exists: i64 = conn
        .query_row("SELECT COUNT(*) FROM accounts WHERE id = ?1", [account_id], |row| row.get(0))
        .map_err(|e| format!("Failed to check account: {}", e))?;
    if account_exists == 0 {
        return Err(format!("Account {} does not exist", account_id));
    }

    let (detected_format, parsed) = parse_transactions(csv_content)?;
    let rules = load_rules(conn)?;

    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;

    let mut summary = ImportSummary {
        detected_format,
        total_rows: parsed.len() as i64,
        ..Default::default()
    };

    // Occurrence counter: same-file identical rows are distinct purchases,
    // but re-importing the same file stays idempotent.
    let mut occurrences: HashMap<String, i64> = HashMap::new();

    for txn in &parsed {
        let key = format!(
            "{}|{}|{}|{}",
            txn.date,
            txn.amount_cents,
            txn.merchant.to_lowercase(),
            account_id
        );
        let occurrence = occurrences.entry(key.clone()).or_insert(0);
        *occurrence += 1;
        let source_hash = fnv1a_hex(&format!("{}|{}", key, occurrence));

        let category = categorize(&rules, &txn.merchant, &txn.description, txn.category_hint.as_deref());

        let inserted = tx
            .execute(
                "INSERT OR IGNORE INTO transactions
                 (account_id, date, amount_cents, merchant, description, category, source, source_label, source_hash)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'csv', ?7, ?8)",
                rusqlite::params![
                    account_id,
                    txn.date,
                    txn.amount_cents,
                    txn.merchant,
                    txn.description,
                    category,
                    source_label,
                    source_hash,
                ],
            )
            .map_err(|e| format!("Failed to insert transaction: {}", e))?;

        if inserted > 0 {
            summary.imported += 1;
        } else {
            summary.duplicates += 1;
        }
    }
    summary.skipped = 0;

    tx.commit().map_err(|e| format!("Failed to commit import: {}", e))?;
    Ok(summary)
}

// ---------- Commands ----------

#[tauri::command]
pub async fn finance_get_accounts(db: State<'_, DbConnection>) -> Result<Vec<FinanceAccount>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare("SELECT id, name, kind, created_at, balance_cents, currency FROM accounts ORDER BY name")
        .map_err(|e| format!("Failed to prepare accounts query: {}", e))?;
    let accounts: Result<Vec<FinanceAccount>, _> = stmt
        .query_map([], |row| {
            Ok(FinanceAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                created_at: row.get(3)?,
                balance_cents: row.get(4)?,
                currency: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query accounts: {}", e))?
        .collect();
    accounts.map_err(|e| format!("Failed to collect accounts: {}", e))
}

#[tauri::command]
pub async fn finance_create_account(
    db: State<'_, DbConnection>,
    name: String,
    kind: String,
) -> Result<FinanceAccount, String> {
    let name = name.trim().to_string();
    if name.is_empty() {
        return Err("Account name cannot be empty".to_string());
    }
    if !["bank", "credit", "brokerage"].contains(&kind.as_str()) {
        return Err("Account kind must be bank, credit, or brokerage".to_string());
    }
    let conn = db.lock().await;
    conn.execute(
        "INSERT INTO accounts (name, kind) VALUES (?1, ?2)",
        rusqlite::params![name, kind],
    )
    .map_err(|e| format!("Failed to create account: {}", e))?;
    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, kind, created_at, balance_cents, currency FROM accounts WHERE id = ?1",
        [id],
        |row| {
            Ok(FinanceAccount {
                id: row.get(0)?,
                name: row.get(1)?,
                kind: row.get(2)?,
                created_at: row.get(3)?,
                balance_cents: row.get(4)?,
                currency: row.get(5)?,
            })
        },
    )
    .map_err(|e| format!("Failed to load account: {}", e))
}

#[tauri::command]
pub async fn finance_delete_account(db: State<'_, DbConnection>, account_id: i64) -> Result<(), String> {
    let conn = db.lock().await;
    // Cascade delete this account's transactions (FKs are off by default in SQLite).
    conn.execute("DELETE FROM transactions WHERE account_id = ?1", [account_id])
        .map_err(|e| format!("Failed to delete account transactions: {}", e))?;
    conn.execute("DELETE FROM accounts WHERE id = ?1", [account_id])
        .map_err(|e| format!("Failed to delete account: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn import_transactions_csv(
    db: State<'_, DbConnection>,
    account_id: i64,
    csv_content: String,
    source_label: String,
) -> Result<ImportSummary, String> {
    let conn = db.lock().await;
    import_csv_into(&conn, account_id, &csv_content, &source_label)
}

#[tauri::command]
pub async fn finance_get_transactions(
    db: State<'_, DbConnection>,
    month: Option<String>,      // "YYYY-MM"
    account_id: Option<i64>,
    category: Option<String>,
    limit: Option<i64>,
) -> Result<Vec<FinanceTransaction>, String> {
    let conn = db.lock().await;
    let mut sql = String::from(
        "SELECT t.id, t.account_id, a.name, t.date, t.amount_cents, t.merchant, t.description, t.category
         FROM transactions t JOIN accounts a ON a.id = t.account_id WHERE 1=1",
    );
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(month) = month.filter(|m| !m.is_empty()) {
        params.push(Box::new(month));
        sql.push_str(&format!(" AND substr(t.date, 1, 7) = ?{}", params.len()));
    }
    if let Some(account_id) = account_id {
        params.push(Box::new(account_id));
        sql.push_str(&format!(" AND t.account_id = ?{}", params.len()));
    }
    if let Some(category) = category.filter(|c| !c.is_empty()) {
        params.push(Box::new(category));
        sql.push_str(&format!(" AND t.category = ?{}", params.len()));
    }
    sql.push_str(" ORDER BY t.date DESC, t.id DESC");
    params.push(Box::new(limit.unwrap_or(200)));
    sql.push_str(&format!(" LIMIT ?{}", params.len()));

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare transactions query: {}", e))?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let txns: Result<Vec<FinanceTransaction>, _> = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(FinanceTransaction {
                id: row.get(0)?,
                account_id: row.get(1)?,
                account_name: row.get(2)?,
                date: row.get(3)?,
                amount_cents: row.get(4)?,
                merchant: row.get(5)?,
                description: row.get(6)?,
                category: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query transactions: {}", e))?
        .collect();
    txns.map_err(|e| format!("Failed to collect transactions: {}", e))
}

#[tauri::command]
pub async fn finance_get_spending_summary(
    db: State<'_, DbConnection>,
    month: String, // "YYYY-MM"
) -> Result<SpendingSummary, String> {
    let conn = db.lock().await;

    let (spent_cents, income_cents, transaction_count): (i64, i64, i64) = conn
        .query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0),
                COUNT(*)
             FROM transactions WHERE substr(date, 1, 7) = ?1",
            [&month],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Failed to compute summary: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT category, SUM(-amount_cents) AS spent
             FROM transactions
             WHERE substr(date, 1, 7) = ?1 AND amount_cents < 0
             GROUP BY category ORDER BY spent DESC",
        )
        .map_err(|e| format!("Failed to prepare category query: {}", e))?;
    let by_category: Result<Vec<CategorySpend>, _> = stmt
        .query_map([&month], |row| {
            Ok(CategorySpend {
                category: row.get(0)?,
                spent_cents: row.get(1)?,
            })
        })
        .map_err(|e| format!("Failed to query categories: {}", e))?
        .collect();
    let by_category = by_category.map_err(|e| format!("Failed to collect categories: {}", e))?;

    Ok(SpendingSummary {
        month,
        spent_cents,
        income_cents,
        net_cents: income_cents - spent_cents,
        transaction_count,
        by_category,
    })
}

#[tauri::command]
pub async fn finance_get_monthly_totals(
    db: State<'_, DbConnection>,
    months: i64,
) -> Result<Vec<MonthlyTotal>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare(
            "SELECT substr(date, 1, 7) AS month,
                COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0)
             FROM transactions
             GROUP BY month ORDER BY month DESC LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare monthly totals query: {}", e))?;
    let totals: Result<Vec<MonthlyTotal>, _> = stmt
        .query_map([months.max(1)], |row| {
            Ok(MonthlyTotal {
                month: row.get(0)?,
                spent_cents: row.get(1)?,
                income_cents: row.get(2)?,
            })
        })
        .map_err(|e| format!("Failed to query monthly totals: {}", e))?
        .collect();
    let mut totals = totals.map_err(|e| format!("Failed to collect monthly totals: {}", e))?;
    totals.reverse(); // chronological for charting
    Ok(totals)
}

/// Recategorize one transaction. With create_rule, also add a merchant rule and
/// apply it to every other still-uncategorized matching transaction.
#[tauri::command]
pub async fn finance_set_category(
    db: State<'_, DbConnection>,
    transaction_id: i64,
    category: String,
    create_rule: bool,
) -> Result<i64, String> {
    let category = category.trim().to_lowercase();
    if category.is_empty() {
        return Err("Category cannot be empty".to_string());
    }
    let conn = db.lock().await;

    let merchant: String = conn
        .query_row(
            "SELECT merchant FROM transactions WHERE id = ?1",
            [transaction_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to find transaction: {}", e))?;

    conn.execute(
        "UPDATE transactions SET category = ?1 WHERE id = ?2",
        rusqlite::params![category, transaction_id],
    )
    .map_err(|e| format!("Failed to update transaction: {}", e))?;

    let mut updated = 1i64;
    if create_rule {
        conn.execute(
            "INSERT INTO category_rules (pattern, category, priority) VALUES (?1, ?2, 100)",
            rusqlite::params![merchant, category],
        )
        .map_err(|e| format!("Failed to create rule: {}", e))?;

        // Retroactively apply to uncategorized (and hint-categorized-alike) rows.
        let extra = conn
            .execute(
                "UPDATE transactions SET category = ?1
                 WHERE id != ?2 AND category = 'uncategorized'
                   AND instr(upper(merchant || ' ' || COALESCE(description, '')), upper(?3)) > 0",
                rusqlite::params![category, transaction_id, merchant],
            )
            .map_err(|e| format!("Failed to apply rule: {}", e))?;
        updated += extra as i64;
    }
    Ok(updated)
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;

    const CHASE_CSV: &str = include_str!("../../tests/fixtures/chase_sample.csv");
    const ROBINHOOD_CSV: &str = include_str!("../../tests/fixtures/robinhood_sample.csv");

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("open in-memory db");
        conn.execute_batch(include_str!("../../migrations/011_finance.sql"))
            .expect("apply finance migration");
        conn
    }

    fn account_id(conn: &Connection, name: &str) -> i64 {
        conn.query_row("SELECT id FROM accounts WHERE name = ?1", [name], |row| row.get(0))
            .expect("seed account exists")
    }

    #[test]
    fn parses_amounts_to_cents() {
        assert_eq!(parse_amount_cents("-6.45"), Some(-645));
        assert_eq!(parse_amount_cents("2500.00"), Some(250000));
        assert_eq!(parse_amount_cents("$1,000.00"), Some(100000));
        assert_eq!(parse_amount_cents("($424.00)"), Some(-42400));
        assert_eq!(parse_amount_cents("$0.52"), Some(52));
        assert_eq!(parse_amount_cents("1.5"), Some(150));
        assert_eq!(parse_amount_cents("+12"), Some(1200));
        assert_eq!(parse_amount_cents(""), None);
        assert_eq!(parse_amount_cents("abc"), None);
    }

    #[test]
    fn parses_dates_to_iso() {
        assert_eq!(parse_date("06/28/2026").as_deref(), Some("2026-06-28"));
        assert_eq!(parse_date("6/5/2026").as_deref(), Some("2026-06-05"));
        assert_eq!(parse_date("2026-06-28").as_deref(), Some("2026-06-28"));
        assert_eq!(parse_date("not a date"), None);
    }

    #[test]
    fn detects_chase_layout_and_parses_rows() {
        let (format, rows) = parse_transactions(CHASE_CSV).expect("parse chase csv");
        assert_eq!(format, "chase");
        assert_eq!(rows.len(), 6);
        assert_eq!(rows[0].date, "2026-06-28");
        assert_eq!(rows[0].amount_cents, -645);
        assert_eq!(rows[0].merchant, "STARBUCKS STORE 12345");
        assert_eq!(rows[4].amount_cents, 250000); // payroll deposit
    }

    #[test]
    fn detects_robinhood_layout_and_parses_rows() {
        let (format, rows) = parse_transactions(ROBINHOOD_CSV).expect("parse robinhood csv");
        assert_eq!(format, "robinhood");
        assert_eq!(rows.len(), 4);
        assert_eq!(rows[0].date, "2026-06-30");
        assert_eq!(rows[0].amount_cents, -42400);
        assert_eq!(rows[0].merchant, "Buy AAPL");
        assert_eq!(rows[0].category_hint.as_deref(), Some("investing"));
        assert_eq!(rows[1].amount_cents, 100000);
        assert_eq!(rows[1].category_hint.as_deref(), Some("transfers"));
        assert_eq!(rows[2].amount_cents, 52);
        assert_eq!(rows[2].category_hint.as_deref(), Some("income"));
        assert_eq!(rows[3].category_hint.as_deref(), Some("subscriptions"));
    }

    #[test]
    fn import_applies_rules_and_dedups_on_reimport() {
        let conn = test_conn();
        let account = account_id(&conn, "Checking");

        let first = import_csv_into(&conn, account, CHASE_CSV, "chase_sample.csv").expect("import");
        assert_eq!(first.detected_format, "chase");
        assert_eq!(first.total_rows, 6);
        // Both identical same-day Starbucks rows import (occurrence suffix).
        assert_eq!(first.imported, 6);
        assert_eq!(first.duplicates, 0);

        // Categories: seeded rules beat the Chase category column hint.
        let category_of = |merchant: &str| -> String {
            conn.query_row(
                "SELECT category FROM transactions WHERE merchant = ?1 LIMIT 1",
                [merchant],
                |row| row.get(0),
            )
            .expect("transaction present")
        };
        assert_eq!(category_of("STARBUCKS STORE 12345"), "dining");
        assert_eq!(category_of("WHOLE FOODS #123 SEATTLE"), "groceries");
        assert_eq!(category_of("NETFLIX.COM"), "subscriptions");
        assert_eq!(category_of("PAYROLL ACME CORP"), "income");
        // No rule match -> falls back to the statement's own category column.
        assert_eq!(category_of("LOCAL HARDWARE STORE"), "home");

        // Re-import: fully deduplicated.
        let second = import_csv_into(&conn, account, CHASE_CSV, "chase_sample.csv").expect("reimport");
        assert_eq!(second.imported, 0);
        assert_eq!(second.duplicates, 6);
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM transactions", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 6);
    }

    #[test]
    fn robinhood_import_and_summary_math() {
        let conn = test_conn();
        let account = account_id(&conn, "Robinhood");

        let summary = import_csv_into(&conn, account, ROBINHOOD_CSV, "robinhood.csv").expect("import");
        assert_eq!(summary.detected_format, "robinhood");
        assert_eq!(summary.imported, 4);

        // June 2026: spent = 424.00 + 5.00, income = 1000.00 + 0.52
        let (spent, income): (i64, i64) = conn
            .query_row(
                "SELECT
                    COALESCE(SUM(CASE WHEN amount_cents < 0 THEN -amount_cents ELSE 0 END), 0),
                    COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0)
                 FROM transactions WHERE substr(date, 1, 7) = '2026-06'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(spent, 42900);
        assert_eq!(income, 100052);
    }

    #[test]
    fn same_account_different_files_still_dedup() {
        let conn = test_conn();
        let checking = account_id(&conn, "Checking");
        let robinhood = account_id(&conn, "Robinhood");

        import_csv_into(&conn, checking, CHASE_CSV, "a.csv").unwrap();
        // Same content re-imported under a different label still dedups...
        let relabeled = import_csv_into(&conn, checking, CHASE_CSV, "b.csv").unwrap();
        assert_eq!(relabeled.imported, 0);
        // ...but the same rows into a different account are distinct.
        let other_account = import_csv_into(&conn, robinhood, CHASE_CSV, "a.csv").unwrap();
        assert_eq!(other_account.imported, 6);
    }
}
