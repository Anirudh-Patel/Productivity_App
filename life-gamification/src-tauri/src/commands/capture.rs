// Quick-Capture inbox: watched iCloud Drive folder -> quests.
//
// Pipeline: iPhone Shortcut (or Siri / anything that can write a file to iCloud
// Drive) drops a small .txt/.md/.json file — or appends lines to inbox.txt —
// into a watched folder. This module scans that folder, parses each file into
// tasks, and creates them with sensible XP/gold defaults.
//
// Post-ingest handling: inbox.txt is truncated in place (append-friendly for
// Shortcuts); other processed files move to processed/; failures move to
// failed/ alongside a <name>.reason.txt explaining why.

use rusqlite::OptionalExtension;
use serde::Serialize;
use serde_json::Value;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::database::DbConnection;

// ---------- Types ----------

#[derive(Debug, Clone, Serialize)]
pub struct CaptureSettings {
    pub folder_path: Option<String>,
    pub last_scan_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CaptureLogEntry {
    pub id: i64,
    pub filename: String,
    pub tasks_created: i64,
    pub status: String,
    pub detail: Option<String>,
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct CaptureScanSummary {
    pub files_scanned: i64,
    pub tasks_created: i64,
    pub errors: Vec<String>,
}

/// A task parsed out of an inbox file, before persistence.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedCaptureTask {
    pub title: String,
    /// From a `#category` token; None -> 'general'.
    pub category: Option<String>,
    /// From a `!N` token (1-10); None -> 3.
    pub difficulty: Option<i64>,
    /// From an `@YYYY-MM-DD` token.
    pub due_date: Option<String>,
}

// ---------- Parsing (pure functions, unit-tested against fixtures) ----------

/// Validate an `@YYYY-MM-DD` date string (calendar-checked, not just shaped).
fn parse_due_date(s: &str) -> Option<String> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .ok()
        .map(|d| d.format("%Y-%m-%d").to_string())
}

/// Parse one captured line into a task.
///
/// Whitespace-separated tokens are pulled out of the title:
///   #word       -> category (lowercased; first wins)
///   !N          -> difficulty, only if 1 <= N <= 10
///   @YYYY-MM-DD -> due date, only if a valid calendar date
/// Unrecognized/malformed tokens (e.g. `!99`, `@tomorrow`) stay in the title.
/// Returns None for blank lines or lines that are nothing but tokens.
pub fn parse_capture_line(line: &str) -> Option<ParsedCaptureTask> {
    let mut title_words: Vec<&str> = Vec::new();
    let mut category: Option<String> = None;
    let mut difficulty: Option<i64> = None;
    let mut due_date: Option<String> = None;

    for word in line.split_whitespace() {
        if let Some(rest) = word.strip_prefix('#') {
            if !rest.is_empty() && category.is_none() {
                category = Some(rest.to_lowercase());
                continue;
            }
        } else if let Some(rest) = word.strip_prefix('!') {
            if difficulty.is_none() {
                if let Ok(n) = rest.parse::<i64>() {
                    if (1..=10).contains(&n) {
                        difficulty = Some(n);
                        continue;
                    }
                }
            }
        } else if let Some(rest) = word.strip_prefix('@') {
            if due_date.is_none() {
                if let Some(date) = parse_due_date(rest) {
                    due_date = Some(date);
                    continue;
                }
            }
        }
        title_words.push(word);
    }

    let title = title_words.join(" ");
    if title.is_empty() {
        return None;
    }
    Some(ParsedCaptureTask {
        title,
        category,
        difficulty,
        due_date,
    })
}

/// Parse a plain-text/markdown inbox document: each non-empty line is one task.
/// Common list prefixes ("- ", "* ", "- [ ] ") are stripped first.
pub fn parse_capture_text(content: &str) -> Vec<ParsedCaptureTask> {
    content
        .lines()
        .map(|line| {
            let mut l = line.trim();
            // Strip markdown checkbox/list prefixes so .md checklists work.
            for prefix in ["- [ ]", "- [x]", "- [X]", "-", "*"] {
                if let Some(rest) = l.strip_prefix(prefix) {
                    l = rest.trim();
                    break;
                }
            }
            l
        })
        .filter_map(parse_capture_line)
        .collect()
}

/// Parse a JSON inbox document: {"tasks":[{"title", "category"?, "difficulty"?, "due_date"?}]}.
/// Malformed documents error (the file moves to failed/); entries without a
/// usable title are skipped; out-of-range difficulties are clamped to 1-10.
pub fn parse_capture_json(content: &str) -> Result<Vec<ParsedCaptureTask>, String> {
    let root: Value =
        serde_json::from_str(content).map_err(|e| format!("Invalid JSON: {}", e))?;
    let tasks = root
        .get("tasks")
        .and_then(|t| t.as_array())
        .ok_or_else(|| "Expected a top-level \"tasks\" array".to_string())?;

    let parsed = tasks
        .iter()
        .filter_map(|entry| {
            let title = entry.get("title")?.as_str()?.trim();
            if title.is_empty() {
                return None;
            }
            Some(ParsedCaptureTask {
                title: title.to_string(),
                category: entry
                    .get("category")
                    .and_then(|c| c.as_str())
                    .map(|c| c.trim().to_lowercase())
                    .filter(|c| !c.is_empty()),
                difficulty: entry
                    .get("difficulty")
                    .and_then(|d| d.as_i64())
                    .map(|d| d.clamp(1, 10)),
                due_date: entry
                    .get("due_date")
                    .and_then(|d| d.as_str())
                    .and_then(parse_due_date),
            })
        })
        .collect();
    Ok(parsed)
}

// ---------- File handling helpers ----------

/// Move `path` into `folder/<subdir>/`, creating the subdir and avoiding
/// name collisions by prefixing a unix timestamp when needed.
fn move_into_subdir(folder: &Path, path: &Path, subdir: &str) -> Result<PathBuf, String> {
    let dir = folder.join(subdir);
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create {}/: {}", subdir, e))?;

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| format!("Bad filename: {}", path.display()))?;
    let mut dest = dir.join(filename);
    if dest.exists() {
        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        dest = dir.join(format!("{}_{}", stamp, filename));
    }
    std::fs::rename(path, &dest)
        .map_err(|e| format!("Failed to move {} to {}/: {}", filename, subdir, e))?;
    Ok(dest)
}

/// Move a bad file to failed/ and drop a sibling <name>.reason.txt next to it.
fn move_to_failed(folder: &Path, path: &Path, reason: &str) -> Result<(), String> {
    let dest = move_into_subdir(folder, path, "failed")?;
    let reason_path = dest.with_file_name(format!(
        "{}.reason.txt",
        dest.file_name().and_then(|n| n.to_str()).unwrap_or("file")
    ));
    std::fs::write(&reason_path, reason)
        .map_err(|e| format!("Failed to write reason file: {}", e))?;
    Ok(())
}

// ---------- Commands ----------

#[tauri::command]
pub async fn get_capture_settings(db: State<'_, DbConnection>) -> Result<CaptureSettings, String> {
    let conn = db.lock().await;
    conn.query_row(
        "SELECT folder_path, last_scan_at FROM capture_settings WHERE id = 1",
        [],
        |row| {
            Ok(CaptureSettings {
                folder_path: row.get(0)?,
                last_scan_at: row.get(1)?,
            })
        },
    )
    .map_err(|e| format!("Failed to read capture settings: {}", e))
}

/// Set (or clear, with an empty string) the watched capture inbox folder.
#[tauri::command]
pub async fn set_capture_folder(
    db: State<'_, DbConnection>,
    path: String,
) -> Result<CaptureSettings, String> {
    let trimmed = path.trim().to_string();
    let stored: Option<String> = if trimmed.is_empty() {
        None
    } else {
        // Expand a leading ~ so users can paste "~/Library/Mobile Documents/...".
        let expanded = if trimmed == "~" || trimmed.starts_with("~/") {
            match std::env::var("HOME") {
                Ok(home) => trimmed.replacen('~', &home, 1),
                Err(_) => trimmed.clone(),
            }
        } else {
            trimmed.clone()
        };
        if !std::path::Path::new(&expanded).is_dir() {
            return Err(format!("Folder not found: {}", expanded));
        }
        Some(expanded)
    };

    {
        let conn = db.lock().await;
        conn.execute(
            "UPDATE capture_settings SET folder_path = ?1 WHERE id = 1",
            rusqlite::params![stored],
        )
        .map_err(|e| format!("Failed to save capture folder: {}", e))?;
    }
    get_capture_settings(db).await
}

#[tauri::command]
pub async fn get_capture_log(
    db: State<'_, DbConnection>,
    limit: Option<i64>,
) -> Result<Vec<CaptureLogEntry>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare(
            "SELECT id, filename, tasks_created, status, detail, imported_at
             FROM capture_log ORDER BY id DESC LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare capture log query: {}", e))?;

    let entries: Result<Vec<CaptureLogEntry>, _> = stmt
        .query_map([limit.unwrap_or(20).max(1)], |row| {
            Ok(CaptureLogEntry {
                id: row.get(0)?,
                filename: row.get(1)?,
                tasks_created: row.get(2)?,
                status: row.get(3)?,
                detail: row.get(4)?,
                imported_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query capture log: {}", e))?
        .collect();

    entries.map_err(|e| format!("Failed to collect capture log: {}", e))
}

/// Scan the configured inbox folder and turn dropped files into quests.
///
/// - inbox.txt (any case): ingest its lines, then truncate it to empty in
///   place — iPhone Shortcuts can keep appending to the same file.
/// - *.txt / *.md: one task per non-empty line, then move to processed/.
/// - *.json: {"tasks":[...]} shape, then move to processed/.
/// - Anything else (or malformed JSON): move to failed/ with a .reason.txt.
#[tauri::command]
pub async fn scan_capture_inbox(
    db: State<'_, DbConnection>,
) -> Result<CaptureScanSummary, String> {
    let mut summary = CaptureScanSummary::default();

    let folder = {
        let conn = db.lock().await;
        conn.query_row(
            "SELECT folder_path FROM capture_settings WHERE id = 1",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read capture settings: {}", e))?
        .flatten()
    };
    let folder = match folder {
        Some(f) if !f.trim().is_empty() => f,
        _ => {
            return Err(
                "No capture folder configured. Set one in Settings → Quick Capture.".to_string(),
            )
        }
    };

    let dir = Path::new(&folder);
    if !dir.is_dir() {
        return Err(format!("Capture folder not found: {}", folder));
    }

    // List candidate files (no DB lock needed). Hidden files (.DS_Store,
    // .foo.icloud placeholders) are skipped; processed/ and failed/ are
    // subdirectories, so read_dir never revisits already-handled files.
    let mut files: Vec<(String, PathBuf)> = Vec::new();
    let entries =
        std::fs::read_dir(dir).map_err(|e| format!("Failed to read capture folder: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        if filename.starts_with('.') {
            continue;
        }
        files.push((filename, path));
    }
    files.sort_by(|a, b| a.0.cmp(&b.0));

    for (filename, path) in files {
        let is_inbox = filename.eq_ignore_ascii_case("inbox.txt");
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();

        // Parse the file into tasks; a per-file failure moves it to failed/.
        let parse_result: Result<Vec<ParsedCaptureTask>, String> =
            match std::fs::read_to_string(&path) {
                Err(e) => Err(format!("Failed to read file: {}", e)),
                Ok(content) => {
                    if is_inbox || ext == "txt" || ext == "md" {
                        Ok(parse_capture_text(&content))
                    } else if ext == "json" {
                        parse_capture_json(&content)
                    } else {
                        Err(format!(
                            "Unsupported file type: .{} (use .txt, .md, or .json)",
                            ext
                        ))
                    }
                }
            };

        let tasks = match parse_result {
            Ok(tasks) => tasks,
            Err(reason) => {
                if let Err(e) = move_to_failed(dir, &path, &reason) {
                    summary.errors.push(format!("{}: {}", filename, e));
                }
                summary.errors.push(format!("{}: {}", filename, reason));
                let conn = db.lock().await;
                let _ = conn.execute(
                    "INSERT INTO capture_log (filename, tasks_created, status, detail)
                     VALUES (?1, 0, 'failed', ?2)",
                    rusqlite::params![filename, reason],
                );
                continue;
            }
        };

        // An empty inbox.txt just means nothing new was captured — skip quietly.
        if is_inbox && tasks.is_empty() {
            continue;
        }

        summary.files_scanned += 1;
        let mut created_here: i64 = 0;

        {
            let conn = db.lock().await;
            for task in &tasks {
                let difficulty = task.difficulty.unwrap_or(3);
                // Same reward formula as create_task in lib.rs / github.rs.
                let base_xp = 10 + (difficulty - 1) * 5;
                let gold_reward = 1 + (difficulty - 1);
                let category = task.category.as_deref().unwrap_or("general");

                match conn.execute(
                    "INSERT INTO tasks (user_id, title, description, category, difficulty,
                         base_experience_reward, gold_reward, due_date, status, priority, task_type)
                     VALUES (1, ?1, NULL, ?2, ?3, ?4, ?5, ?6, 'active', 3, 'standard')",
                    rusqlite::params![
                        task.title,
                        category,
                        difficulty as i32,
                        base_xp as i32,
                        gold_reward as i32,
                        task.due_date,
                    ],
                ) {
                    Ok(_) => created_here += 1,
                    Err(e) => summary
                        .errors
                        .push(format!("{}: failed to create \"{}\": {}", filename, task.title, e)),
                }
            }

            conn.execute(
                "INSERT INTO capture_log (filename, tasks_created, status, detail)
                 VALUES (?1, ?2, 'processed', NULL)",
                rusqlite::params![filename, created_here],
            )
            .map_err(|e| format!("Failed to record capture of {}: {}", filename, e))?;
        }

        summary.tasks_created += created_here;

        // Post-ingest: truncate inbox.txt in place; move everything else away.
        if is_inbox {
            if let Err(e) = std::fs::write(&path, "") {
                summary
                    .errors
                    .push(format!("{}: failed to truncate after ingest: {}", filename, e));
            }
        } else if let Err(e) = move_into_subdir(dir, &path, "processed") {
            summary.errors.push(format!("{}: {}", filename, e));
        }
    }

    {
        let conn = db.lock().await;
        conn.execute(
            "UPDATE capture_settings SET last_scan_at = CURRENT_TIMESTAMP WHERE id = 1",
            [],
        )
        .map_err(|e| format!("Failed to stamp scan time: {}", e))?;
    }

    Ok(summary)
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;

    const TXT_FIXTURE: &str = include_str!("../../tests/fixtures/capture/inbox_sample.txt");
    const JSON_FIXTURE: &str = include_str!("../../tests/fixtures/capture/tasks_sample.json");

    #[test]
    fn parses_plain_line_without_tokens() {
        let task = parse_capture_line("Buy groceries").expect("should parse");
        assert_eq!(task.title, "Buy groceries");
        assert_eq!(task.category, None);
        assert_eq!(task.difficulty, None);
        assert_eq!(task.due_date, None);
    }

    #[test]
    fn parses_all_tokens_and_strips_them_from_title() {
        let task =
            parse_capture_line("Ship the report #work !7 @2026-07-15").expect("should parse");
        assert_eq!(task.title, "Ship the report");
        assert_eq!(task.category.as_deref(), Some("work"));
        assert_eq!(task.difficulty, Some(7));
        assert_eq!(task.due_date.as_deref(), Some("2026-07-15"));
    }

    #[test]
    fn tokens_can_appear_anywhere_and_category_is_lowercased() {
        let task = parse_capture_line("#Fitness Morning run !2").expect("should parse");
        assert_eq!(task.title, "Morning run");
        assert_eq!(task.category.as_deref(), Some("fitness"));
        assert_eq!(task.difficulty, Some(2));
    }

    #[test]
    fn invalid_tokens_stay_in_the_title() {
        // Out-of-range difficulty, non-numeric difficulty, invalid dates.
        let task = parse_capture_line("Call mom !99 @tomorrow @2026-13-40").expect("should parse");
        assert_eq!(task.title, "Call mom !99 @tomorrow @2026-13-40");
        assert_eq!(task.difficulty, None);
        assert_eq!(task.due_date, None);

        let task = parse_capture_line("Fix bug !high").expect("should parse");
        assert_eq!(task.title, "Fix bug !high");
    }

    #[test]
    fn difficulty_bounds_are_respected() {
        assert_eq!(parse_capture_line("a !1").unwrap().difficulty, Some(1));
        assert_eq!(parse_capture_line("a !10").unwrap().difficulty, Some(10));
        assert_eq!(parse_capture_line("a !0").unwrap().difficulty, None);
        assert_eq!(parse_capture_line("a !11").unwrap().difficulty, None);
    }

    #[test]
    fn blank_and_token_only_lines_yield_nothing() {
        assert_eq!(parse_capture_line(""), None);
        assert_eq!(parse_capture_line("   "), None);
        assert_eq!(parse_capture_line("#work !5 @2026-07-15"), None);
    }

    #[test]
    fn parses_text_fixture_line_per_task() {
        let tasks = parse_capture_text(TXT_FIXTURE);
        assert_eq!(tasks.len(), 4);

        assert_eq!(tasks[0].title, "Buy groceries");
        assert_eq!(tasks[0].category, None);

        assert_eq!(tasks[1].title, "Finish quarterly report");
        assert_eq!(tasks[1].category.as_deref(), Some("work"));
        assert_eq!(tasks[1].difficulty, Some(6));
        assert_eq!(tasks[1].due_date.as_deref(), Some("2026-07-15"));

        // Markdown list prefixes are stripped.
        assert_eq!(tasks[2].title, "Morning run");
        assert_eq!(tasks[2].category.as_deref(), Some("fitness"));

        assert_eq!(tasks[3].title, "Read 20 pages");
        assert_eq!(tasks[3].difficulty, Some(2));
    }

    #[test]
    fn parses_json_fixture() {
        let tasks = parse_capture_json(JSON_FIXTURE).expect("fixture should parse");
        assert_eq!(tasks.len(), 3);

        assert_eq!(tasks[0].title, "Plan the trip");
        assert_eq!(tasks[0].category.as_deref(), Some("personal"));
        assert_eq!(tasks[0].difficulty, Some(4));
        assert_eq!(tasks[0].due_date.as_deref(), Some("2026-08-01"));

        // Minimal entry: defaults deferred to insert time.
        assert_eq!(tasks[1].title, "Water the plants");
        assert_eq!(tasks[1].category, None);
        assert_eq!(tasks[1].difficulty, None);
        assert_eq!(tasks[1].due_date, None);

        // Difficulty out of range is clamped; bad due_date is dropped.
        assert_eq!(tasks[2].title, "Deep clean the garage");
        assert_eq!(tasks[2].difficulty, Some(10));
        assert_eq!(tasks[2].due_date, None);
    }

    #[test]
    fn json_entries_without_titles_are_skipped() {
        let parsed =
            parse_capture_json(r#"{"tasks":[{"title":"ok"},{"category":"x"},{"title":"  "}]}"#)
                .expect("should parse");
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].title, "ok");
    }

    #[test]
    fn malformed_json_errors() {
        assert!(parse_capture_json("not json").is_err());
        assert!(parse_capture_json("{}").is_err());
        assert!(parse_capture_json(r#"{"tasks": "nope"}"#).is_err());
    }

    #[test]
    fn empty_text_yields_no_tasks() {
        assert!(parse_capture_text("").is_empty());
        assert!(parse_capture_text("\n  \n\t\n").is_empty());
    }
}
