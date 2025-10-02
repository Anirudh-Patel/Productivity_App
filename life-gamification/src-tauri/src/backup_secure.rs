// Secure backup and restore functions to replace the vulnerable versions in lib.rs

use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct BackupInfo {
    pub filename: String,
    pub created_at: String,
    pub size_bytes: u64,
}

// Get the secure backup directory
fn get_backup_directory() -> Result<PathBuf, String> {
    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .ok_or("Failed to get app data directory")?;

    let backup_dir = app_dir.join("backups");

    // Create backup directory if it doesn't exist
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }

    Ok(backup_dir)
}

// Validate that a filename is safe (no path traversal)
fn validate_filename(filename: &str) -> Result<(), String> {
    // Check for path traversal attempts
    if filename.contains("..") || filename.contains("/") || filename.contains("\\") {
        return Err("Invalid filename: path traversal detected".to_string());
    }

    // Only allow alphanumeric, underscore, hyphen, and .db extension
    if !filename.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == '.') {
        return Err("Invalid filename: contains invalid characters".to_string());
    }

    // Must end with .db
    if !filename.ends_with(".db") {
        return Err("Invalid filename: must end with .db".to_string());
    }

    Ok(())
}

// Secure create backup function
#[tauri::command]
pub async fn create_backup_secure() -> Result<String, String> {
    let backup_dir = get_backup_directory()?;
    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .ok_or("Failed to get app data directory")?;
    let db_path = app_dir.join("game.db");

    if !db_path.exists() {
        return Err("Database file does not exist".to_string());
    }

    // Generate backup filename with timestamp
    let backup_filename = format!("backup_{}.db", Utc::now().format("%Y%m%d_%H%M%S"));
    let backup_path = backup_dir.join(&backup_filename);

    // Copy database to backup
    fs::copy(&db_path, &backup_path)
        .map_err(|e| format!("Failed to create backup: {}", e))?;

    Ok(backup_filename)
}

// Secure restore from backup function
#[tauri::command]
pub async fn restore_from_backup_secure(backup_filename: String) -> Result<(), String> {
    // Validate filename to prevent path traversal
    validate_filename(&backup_filename)?;

    let backup_dir = get_backup_directory()?;
    let backup_path = backup_dir.join(&backup_filename);

    // Check if backup file exists within the backup directory
    if !backup_path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    // Verify the backup is actually within our backup directory (double-check)
    let canonical_backup = backup_path.canonicalize()
        .map_err(|e| format!("Failed to resolve backup path: {}", e))?;
    let canonical_dir = backup_dir.canonicalize()
        .map_err(|e| format!("Failed to resolve backup directory: {}", e))?;

    if !canonical_backup.starts_with(&canonical_dir) {
        return Err("Security error: backup file is outside the backup directory".to_string());
    }

    let app_dir = tauri::api::path::app_data_dir(&tauri::Config::default())
        .ok_or("Failed to get app data directory")?;
    let db_path = app_dir.join("game.db");

    // Create a safety backup before restoring
    let safety_backup = backup_dir.join(format!("pre_restore_{}.db", Utc::now().format("%Y%m%d_%H%M%S")));
    if db_path.exists() {
        fs::copy(&db_path, &safety_backup)
            .map_err(|e| format!("Failed to create safety backup: {}", e))?;
    }

    // Restore the backup
    match fs::copy(&backup_path, &db_path) {
        Ok(_) => {
            println!("Database restored from backup: {}", backup_filename);
            Ok(())
        }
        Err(e) => {
            // Try to restore the safety backup if restore failed
            if safety_backup.exists() {
                let _ = fs::copy(&safety_backup, &db_path);
            }
            Err(format!("Failed to restore from backup: {}", e))
        }
    }
}

// List available backups (secure version)
#[tauri::command]
pub async fn list_available_backups_secure() -> Result<Vec<String>, String> {
    let backup_dir = get_backup_directory()?;
    let mut backups = Vec::new();

    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(filename) = entry.file_name().to_str() {
                    if filename.starts_with("backup_") && filename.ends_with(".db") {
                        backups.push(filename.to_string());
                    }
                }
            }
        }
    }

    // Sort backups by date (newest first)
    backups.sort_by(|a, b| b.cmp(a));
    Ok(backups)
}

// Get backup info (secure version)
#[tauri::command]
pub async fn get_backup_info_secure(backup_filename: String) -> Result<BackupInfo, String> {
    // Validate filename to prevent path traversal
    validate_filename(&backup_filename)?;

    let backup_dir = get_backup_directory()?;
    let backup_path = backup_dir.join(&backup_filename);

    if !backup_path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let metadata = fs::metadata(&backup_path)
        .map_err(|e| format!("Failed to get backup metadata: {}", e))?;

    // Extract timestamp from filename (format: backup_YYYYMMDD_HHMMSS.db)
    let created_at = if backup_filename.starts_with("backup_") && backup_filename.len() > 23 {
        let timestamp_str = &backup_filename[7..22]; // Extract YYYYMMDD_HHMMSS
        timestamp_str.to_string()
    } else {
        "Unknown".to_string()
    };

    Ok(BackupInfo {
        filename: backup_filename,
        created_at,
        size_bytes: metadata.len(),
    })
}

// Schedule automatic backups (secure version)
#[tauri::command]
pub async fn schedule_automatic_backups_secure() -> Result<(), String> {
    // Create a backup immediately
    create_backup_secure().await?;

    // In a real implementation, you would set up a timer here
    // For now, we just create an immediate backup
    Ok(())
}

// Clean up old backups (keep only last N backups)
#[tauri::command]
pub async fn cleanup_old_backups(keep_count: usize) -> Result<usize, String> {
    let backup_dir = get_backup_directory()?;
    let mut backups = Vec::new();

    // List all backup files
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                if let Some(filename) = entry.file_name().to_str() {
                    if filename.starts_with("backup_") && filename.ends_with(".db") {
                        backups.push(filename.to_string());
                    }
                }
            }
        }
    }

    // Sort backups by date (newest first)
    backups.sort_by(|a, b| b.cmp(a));

    // Delete old backups
    let mut deleted_count = 0;
    if backups.len() > keep_count {
        for backup in backups.iter().skip(keep_count) {
            let backup_path = backup_dir.join(backup);
            if fs::remove_file(backup_path).is_ok() {
                deleted_count += 1;
            }
        }
    }

    Ok(deleted_count)
}