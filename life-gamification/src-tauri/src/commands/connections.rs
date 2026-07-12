// Connections framework: provider status rows + macOS Keychain secret helpers.
// Secrets are stored in the login Keychain via the `security` CLI (service
// "life-gamification") — they never touch SQLite, log output, or the repo.
// Same shell-out pattern as the gh CLI (github.rs) and osascript (calendar.rs).

use serde::Serialize;
use std::process::Command;
use tauri::State;

use crate::database::DbConnection;

pub const KEYCHAIN_SERVICE: &str = "life-gamification";

const SECURITY_BIN: &str = "/usr/bin/security";

// ---------- Keychain helpers ----------

/// Store (or overwrite, via -U) a secret in the login Keychain.
pub fn keychain_set(account: &str, secret: &str) -> Result<(), String> {
    let output = Command::new(SECURITY_BIN)
        .args(["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", account, "-w", secret])
        .output()
        .map_err(|e| format!("Failed to run security CLI: {}", e))?;
    if !output.status.success() {
        // stderr from `security` never echoes the secret value.
        return Err(format!(
            "Keychain write failed for {}: {}",
            account,
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    Ok(())
}

/// Read a secret. Ok(None) when the item simply doesn't exist.
pub fn keychain_get(account: &str) -> Result<Option<String>, String> {
    let output = Command::new(SECURITY_BIN)
        .args(["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account, "-w"])
        .output()
        .map_err(|e| format!("Failed to run security CLI: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("could not be found") {
            return Ok(None);
        }
        return Err(format!("Keychain read failed for {}: {}", account, stderr.trim()));
    }
    Ok(Some(String::from_utf8_lossy(&output.stdout).trim().to_string()))
}

/// Delete a secret. Missing items are not an error (idempotent disconnect).
pub fn keychain_delete(account: &str) -> Result<(), String> {
    let output = Command::new(SECURITY_BIN)
        .args(["delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", account])
        .output()
        .map_err(|e| format!("Failed to run security CLI: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if !stderr.contains("could not be found") {
            return Err(format!("Keychain delete failed for {}: {}", account, stderr.trim()));
        }
    }
    Ok(())
}

// ---------- Connection rows ----------

#[derive(Debug, Clone, Serialize)]
pub struct ConnectionInfo {
    pub provider: String,
    pub status: String, // 'connected' | 'error' | 'disconnected'
    pub last_sync_at: Option<String>,
    pub last_error: Option<String>,
}

/// Keychain account names owned by a provider (wiped on disconnect).
fn provider_secret_accounts(provider: &str) -> &'static [&'static str] {
    match provider {
        "simplefin" => &["simplefin_access_url"],
        _ => &[],
    }
}

#[tauri::command]
pub async fn get_connections(db: State<'_, DbConnection>) -> Result<Vec<ConnectionInfo>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare("SELECT provider, status, last_sync_at, last_error FROM connections ORDER BY provider")
        .map_err(|e| format!("Failed to prepare connections query: {}", e))?;
    let rows: Result<Vec<ConnectionInfo>, _> = stmt
        .query_map([], |row| {
            Ok(ConnectionInfo {
                provider: row.get(0)?,
                status: row.get(1)?,
                last_sync_at: row.get(2)?,
                last_error: row.get(3)?,
            })
        })
        .map_err(|e| format!("Failed to query connections: {}", e))?
        .collect();
    rows.map_err(|e| format!("Failed to collect connections: {}", e))
}

#[tauri::command]
pub async fn disconnect_provider(db: State<'_, DbConnection>, provider: String) -> Result<(), String> {
    for account in provider_secret_accounts(&provider) {
        keychain_delete(account)?;
    }
    let conn = db.lock().await;
    conn.execute(
        "UPDATE connections SET status = 'disconnected', last_error = NULL WHERE provider = ?1",
        [&provider],
    )
    .map_err(|e| format!("Failed to update connection: {}", e))?;
    Ok(())
}
