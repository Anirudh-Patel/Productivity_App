// Apple Reminders integration: Reminders.app -> tasks (content one-way in),
// completion synced both ways.
//
// All Reminders.app access goes through `osascript -l JavaScript` (JXA) so the
// app needs no API keys — same pattern as commands/calendar.rs. NOTE: the very
// first call triggers the macOS "allow access to Reminders" permission dialog
// (expected, one time).
//
// Performance: fetching properties reminder-by-reminder over Apple Events is
// very slow, so the fetch script batch-reads whole property arrays off the
// `whose({completed: false})` specifier and caps results at 200 per list.

use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::process::Command;
use tauri::State;

use crate::database::DbConnection;

/// Max reminders imported per list per sync (JXA gets slow on huge lists).
const MAX_REMINDERS_PER_LIST: usize = 200;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct ReminderList {
    pub name: String,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemindersConnectionResult {
    pub connected: bool,
    pub lists: Vec<ReminderList>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RemindersSettings {
    pub last_sync_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct RemindersSyncSummary {
    pub lists_synced: i64,
    pub reminders_imported: i64,
    pub tasks_updated: i64,
    pub tasks_completed: i64,
    pub reminders_completed: i64,
    pub errors: Vec<String>,
}

/// Shape of a single reminder as emitted by the JXA fetch script.
#[derive(Debug, Deserialize)]
struct JxaReminder {
    id: String,
    name: String,
    #[serde(default)]
    due: Option<String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    priority: Option<i64>,
    list: String,
}

#[derive(Debug, Deserialize)]
struct JxaUpdatedResponse {
    updated: bool,
}

// ---------------------------------------------------------------------------
// JXA scripts (run with `osascript -l JavaScript`; parameters passed via argv
// so no string-escaping of user data into the script body is ever needed)
// ---------------------------------------------------------------------------

const JXA_LIST_LISTS: &str = r#"
function run() {
  const app = Application("Reminders");
  const names = [];
  const lists = app.lists();
  for (let i = 0; i < lists.length; i++) {
    try { names.push(lists[i].name()); } catch (e) {}
  }
  return JSON.stringify(names);
}
"#;

// argv: [listNamesJson, maxPerList]
// CRITICAL for performance: property arrays (.id(), .name(), ...) are read in
// bulk off the whose() specifier — one Apple Event per property instead of one
// per reminder.
const JXA_GET_INCOMPLETE: &str = r#"
function run(argv) {
  const filter = argv[0] ? JSON.parse(argv[0]) : null;
  const cap = parseInt(argv[1], 10) || 200;
  const app = Application("Reminders");
  const out = [];
  const lists = app.lists();
  for (let i = 0; i < lists.length; i++) {
    let listName;
    try { listName = lists[i].name(); } catch (e) { continue; }
    if (filter && filter.indexOf(listName) === -1) continue;
    let ids, names, dues, bodies, priorities;
    try {
      const rems = lists[i].reminders.whose({ completed: false });
      ids = rems.id();
      names = rems.name();
      dues = rems.dueDate();
      bodies = rems.body();
      priorities = rems.priority();
    } catch (e) { continue; }
    const n = Math.min(ids.length, cap);
    for (let j = 0; j < n; j++) {
      try {
        let due = null;
        try { if (dues[j]) due = dues[j].toISOString(); } catch (e) {}
        const body = (typeof bodies[j] === "string" && bodies[j].length > 0) ? bodies[j] : null;
        const priority = (typeof priorities[j] === "number") ? priorities[j] : 0;
        out.push({ id: ids[j], name: names[j], due: due, body: body, priority: priority, list: listName });
      } catch (e) {}
    }
  }
  return JSON.stringify(out);
}
"#;

// argv: [reminderId]
const JXA_COMPLETE_REMINDER: &str = r#"
function run(argv) {
  const id = argv[0];
  const app = Application("Reminders");
  try {
    const rem = app.reminders.byId(id);
    rem.name(); // throws if the reminder no longer exists
    rem.completed = true;
    return JSON.stringify({ updated: true });
  } catch (e) {}
  return JSON.stringify({ updated: false });
}
"#;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn run_jxa(script: &str, args: &[&str]) -> Result<String, String> {
    let mut cmd = Command::new("osascript");
    cmd.arg("-l").arg("JavaScript").arg("-e").arg(script);
    for arg in args {
        cmd.arg(arg);
    }
    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run osascript: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "Reminders access failed (is Reminders permission granted in System Settings > Privacy & Security > Automation?): {}",
            stderr.trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn parse_list_names_json(json: &str) -> Result<Vec<String>, String> {
    serde_json::from_str(json).map_err(|e| format!("Failed to parse reminder lists: {}", e))
}

fn parse_reminders_json(json: &str) -> Result<Vec<JxaReminder>, String> {
    serde_json::from_str(json).map_err(|e| format!("Failed to parse reminders: {}", e))
}

fn parse_updated_json(json: &str) -> Result<bool, String> {
    let resp: JxaUpdatedResponse = serde_json::from_str(json)
        .map_err(|e| format!("Failed to parse complete-reminder response: {}", e))?;
    Ok(resp.updated)
}

/// Map Reminders.app priority (0 none, 1-4 high, 5 medium, 6-9 low) to the
/// task priority scale (1 low .. 5 urgent, default 3).
fn task_priority_from_reminder(priority: Option<i64>) -> i64 {
    match priority.unwrap_or(0) {
        1..=4 => 4,
        5 => 3,
        6..=9 => 2,
        _ => 3,
    }
}

/// Keep imported notes to a sane length for task cards.
fn truncate_body(body: &str) -> String {
    const MAX: usize = 500;
    if body.chars().count() <= MAX {
        return body.trim().to_string();
    }
    let truncated: String = body.chars().take(MAX).collect();
    format!("{}…", truncated.trim_end())
}

/// Read the enabled reminder list names from the DB.
async fn enabled_lists(db: &State<'_, DbConnection>) -> Result<Vec<String>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare("SELECT name FROM reminder_lists WHERE enabled = 1 ORDER BY name")
        .map_err(|e| format!("Failed to prepare enabled lists query: {}", e))?;
    let names = stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Failed to query enabled lists: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect enabled lists: {}", e))?;
    Ok(names)
}

async fn read_lists_from_db(db: &State<'_, DbConnection>) -> Result<Vec<ReminderList>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare("SELECT name, enabled FROM reminder_lists ORDER BY name")
        .map_err(|e| format!("Failed to prepare reminder lists query: {}", e))?;
    let lists = stmt
        .query_map([], |row| {
            Ok(ReminderList {
                name: row.get(0)?,
                enabled: row.get::<_, i64>(1)? != 0,
            })
        })
        .map_err(|e| format!("Failed to query reminder lists: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect reminder lists: {}", e))?;
    Ok(lists)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Connect to Reminders.app: list the reminder lists (this triggers the
/// one-time macOS permission prompt) and store their names in the DB so the
/// rest of the app can work without touching Reminders.app again.
#[tauri::command]
pub async fn connect_apple_reminders(
    db: State<'_, DbConnection>,
) -> Result<RemindersConnectionResult, String> {
    // Slow JXA call first, with no DB lock held.
    let out = run_jxa(JXA_LIST_LISTS, &[])?;
    let names = parse_list_names_json(&out)?;

    {
        let conn = db.lock().await;
        for name in &names {
            conn.execute(
                "INSERT OR IGNORE INTO reminder_lists (name, enabled) VALUES (?1, 0)",
                [name],
            )
            .map_err(|e| format!("Failed to save reminder list: {}", e))?;
        }
    }

    Ok(RemindersConnectionResult {
        connected: true,
        lists: read_lists_from_db(&db).await?,
    })
}

/// Known reminder lists + enabled flags, from the DB only (never triggers the
/// macOS permission prompt — safe to call on app start).
#[tauri::command]
pub async fn get_reminder_lists(db: State<'_, DbConnection>) -> Result<Vec<ReminderList>, String> {
    read_lists_from_db(&db).await
}

#[tauri::command]
pub async fn set_reminder_list_rule(
    db: State<'_, DbConnection>,
    list_name: String,
    enabled: bool,
) -> Result<(), String> {
    let conn = db.lock().await;
    conn.execute(
        "INSERT INTO reminder_lists (name, enabled) VALUES (?1, ?2)
         ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled",
        rusqlite::params![list_name, enabled as i64],
    )
    .map_err(|e| format!("Failed to save reminder list rule: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_reminders_settings(
    db: State<'_, DbConnection>,
) -> Result<RemindersSettings, String> {
    let conn = db.lock().await;
    conn.query_row(
        "SELECT last_sync_at FROM reminders_settings WHERE id = 1",
        [],
        |row| {
            Ok(RemindersSettings {
                last_sync_at: row.get(0)?,
            })
        },
    )
    .map_err(|e| format!("Failed to read Reminders settings: {}", e))
}

/// After a task is completed in-app, check off its linked reminder. No-op
/// (returns false) if the task has no linked reminder. Intended to be called
/// fire-and-forget from the frontend — errors are non-fatal there.
#[tauri::command]
pub async fn mark_reminder_completed(
    db: State<'_, DbConnection>,
    task_id: i64,
) -> Result<bool, String> {
    let reminder_id: Option<String> = {
        let conn = db.lock().await;
        conn.query_row(
            "SELECT reminder_id FROM tasks WHERE id = ?1 AND user_id = 1",
            [task_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Task not found: {}", e))?
    };

    let reminder_id = match reminder_id {
        Some(id) if !id.is_empty() => id,
        _ => return Ok(false),
    };

    let out = run_jxa(JXA_COMPLETE_REMINDER, &[&reminder_id])?;
    parse_updated_json(&out)
}

/// Pull-based sync with Reminders.app:
/// 1. Import incomplete reminders from enabled lists as tasks (dedup on reminder id).
/// 2. Complete in-app tasks whose reminder was checked off (or deleted) in Reminders.
/// 3. Check off reminders whose task was completed in-app (catch-up for missed backflow).
#[tauri::command]
pub async fn sync_reminders(db: State<'_, DbConnection>) -> Result<RemindersSyncSummary, String> {
    let mut summary = RemindersSyncSummary::default();

    // 1. Enabled lists (DB), then release the lock for the slow JXA fetch.
    let enabled = enabled_lists(&db).await?;
    if enabled.is_empty() {
        return Ok(summary);
    }

    let filter_json = serde_json::to_string(&enabled)
        .map_err(|e| format!("Failed to encode list filter: {}", e))?;
    let cap = MAX_REMINDERS_PER_LIST.to_string();
    let out = run_jxa(JXA_GET_INCOMPLETE, &[&filter_json, &cap])?;
    let reminders = parse_reminders_json(&out)?;
    summary.lists_synced = enabled.len() as i64;

    let incomplete_ids: HashSet<&str> = reminders.iter().map(|r| r.id.as_str()).collect();

    let mut tasks_to_complete: Vec<i64> = Vec::new();
    let mut reminders_to_complete: Vec<String> = Vec::new();

    {
        let conn = db.lock().await;

        // 2. Upsert tasks for incomplete reminders (dedup on reminder_id).
        for reminder in &reminders {
            let existing: Option<(i64, String, String)> = conn
                .query_row(
                    "SELECT id, status, title FROM tasks WHERE reminder_id = ?1",
                    [&reminder.id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .optional()
                .map_err(|e| format!("Failed to look up task for reminder {}: {}", reminder.id, e))?;

            match existing {
                Some((task_id, status, title)) => {
                    // Keep still-open imported tasks' titles in sync with Reminders.
                    if status == "active" && title != reminder.name {
                        conn.execute(
                            "UPDATE tasks SET title = ?1 WHERE id = ?2",
                            rusqlite::params![reminder.name, task_id],
                        )
                        .map_err(|e| format!("Failed to update task {}: {}", task_id, e))?;
                        summary.tasks_updated += 1;
                    }
                    // A completed task whose reminder is still open: it was
                    // completed in-app -> check the reminder off (step 3, after
                    // the lock is released).
                    if status == "completed" {
                        reminders_to_complete.push(reminder.id.clone());
                    }
                }
                None => {
                    // Same reward formula as create_task with default difficulty 3.
                    let difficulty = 3i64;
                    let base_xp = 10 + (difficulty - 1) * 5;
                    let gold_reward = 1 + (difficulty - 1);
                    let priority = task_priority_from_reminder(reminder.priority);
                    let description = reminder
                        .body
                        .as_deref()
                        .filter(|b| !b.trim().is_empty())
                        .map(truncate_body);

                    conn.execute(
                        "INSERT INTO tasks (user_id, title, description, category, difficulty,
                         base_experience_reward, gold_reward, due_date, status, priority, task_type,
                         reminder_id, reminder_list)
                         VALUES (1, ?1, ?2, 'general', ?3, ?4, ?5, ?6, 'active', ?7, 'standard', ?8, ?9)",
                        rusqlite::params![
                            reminder.name,
                            description,
                            difficulty as i32,
                            base_xp as i32,
                            gold_reward as i32,
                            reminder.due,
                            priority as i32,
                            reminder.id,
                            reminder.list,
                        ],
                    )
                    .map_err(|e| format!("Failed to import reminder {}: {}", reminder.id, e))?;
                    summary.reminders_imported += 1;
                }
            }
        }

        // Any still-active imported task (from an enabled list) whose reminder is
        // no longer in the incomplete set was checked off or deleted in
        // Reminders -> complete it in-app (after releasing the lock).
        let mut stmt = conn
            .prepare(
                "SELECT id, reminder_id, reminder_list FROM tasks
                 WHERE reminder_id IS NOT NULL AND status = 'active'",
            )
            .map_err(|e| format!("Failed to prepare stale-tasks query: {}", e))?;
        let stale: Vec<(i64, String, String)> = stmt
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .map_err(|e| format!("Failed to query stale tasks: {}", e))?
            .filter_map(Result::ok)
            .collect();
        drop(stmt);

        for (task_id, reminder_id, reminder_list) in stale {
            if enabled.contains(&reminder_list) && !incomplete_ids.contains(reminder_id.as_str()) {
                tasks_to_complete.push(task_id);
            }
        }
    }

    // Reuse the standard completion path (XP/gold/streak logic) for reminders
    // checked off in Reminders.app.
    for task_id in tasks_to_complete {
        match crate::complete_task(db.clone(), task_id).await {
            Ok(_) => summary.tasks_completed += 1,
            Err(e) => summary
                .errors
                .push(format!("Failed to complete task {}: {}", task_id, e)),
        }
    }

    // 3. Backflow catch-up: check off reminders for tasks already completed in-app.
    for reminder_id in reminders_to_complete {
        match run_jxa(JXA_COMPLETE_REMINDER, &[&reminder_id]).and_then(|o| parse_updated_json(&o)) {
            Ok(true) => summary.reminders_completed += 1,
            Ok(false) => {}
            Err(e) => summary
                .errors
                .push(format!("Failed to complete reminder {}: {}", reminder_id, e)),
        }
    }

    {
        let conn = db.lock().await;
        conn.execute(
            "UPDATE reminders_settings SET last_sync_at = CURRENT_TIMESTAMP WHERE id = 1",
            [],
        )
        .map_err(|e| format!("Failed to stamp sync time: {}", e))?;
    }

    Ok(summary)
}

// ---------------------------------------------------------------------------
// Tests (JSON parsing + mapping logic; live Reminders.app access can't run in
// CI because the first call triggers the macOS permission prompt)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_list_names_fixture() {
        let names = parse_list_names_json(r#"["Reminders","Groceries","Work"]"#).unwrap();
        assert_eq!(names, vec!["Reminders", "Groceries", "Work"]);
        assert!(parse_list_names_json("[]").unwrap().is_empty());
        assert!(parse_list_names_json("not json").is_err());
    }

    #[test]
    fn parses_reminders_fixture() {
        let fixture = r#"[
            {"id":"x-apple-reminder://AAA-111","name":"Buy milk","due":"2026-07-11T17:00:00.000Z","body":"2% if they have it","priority":0,"list":"Groceries"},
            {"id":"x-apple-reminder://BBB-222","name":"File taxes","due":null,"body":null,"priority":1,"list":"Reminders"}
        ]"#;
        let reminders = parse_reminders_json(fixture).expect("fixture should parse");
        assert_eq!(reminders.len(), 2);
        assert_eq!(reminders[0].id, "x-apple-reminder://AAA-111");
        assert_eq!(reminders[0].name, "Buy milk");
        assert_eq!(reminders[0].due.as_deref(), Some("2026-07-11T17:00:00.000Z"));
        assert_eq!(reminders[0].body.as_deref(), Some("2% if they have it"));
        assert_eq!(reminders[0].list, "Groceries");
        assert_eq!(reminders[1].due, None);
        assert_eq!(reminders[1].body, None);
        assert_eq!(reminders[1].priority, Some(1));
    }

    #[test]
    fn parses_reminders_with_missing_optional_fields() {
        // Defensive: optional fields absent entirely (not just null).
        let fixture = r#"[{"id":"CCC-333","name":"Minimal","list":"Reminders"}]"#;
        let reminders = parse_reminders_json(fixture).expect("minimal fixture should parse");
        assert_eq!(reminders.len(), 1);
        assert_eq!(reminders[0].due, None);
        assert_eq!(reminders[0].body, None);
        assert_eq!(reminders[0].priority, None);
    }

    #[test]
    fn parses_empty_reminders() {
        assert!(parse_reminders_json("[]").unwrap().is_empty());
    }

    #[test]
    fn rejects_malformed_reminders() {
        assert!(parse_reminders_json("not json").is_err());
        assert!(parse_reminders_json(r#"[{"id":"x"}]"#).is_err()); // missing required fields
    }

    #[test]
    fn parses_updated_response() {
        assert!(parse_updated_json(r#"{"updated":true}"#).unwrap());
        assert!(!parse_updated_json(r#"{"updated":false}"#).unwrap());
        assert!(parse_updated_json("{}").is_err());
    }

    #[test]
    fn maps_reminder_priority_to_task_priority() {
        assert_eq!(task_priority_from_reminder(None), 3); // unset
        assert_eq!(task_priority_from_reminder(Some(0)), 3); // none
        assert_eq!(task_priority_from_reminder(Some(1)), 4); // high
        assert_eq!(task_priority_from_reminder(Some(4)), 4); // high
        assert_eq!(task_priority_from_reminder(Some(5)), 3); // medium
        assert_eq!(task_priority_from_reminder(Some(9)), 2); // low
        assert_eq!(task_priority_from_reminder(Some(42)), 3); // out of range -> default
    }

    #[test]
    fn truncates_long_bodies() {
        let long = "x".repeat(600);
        let truncated = truncate_body(&long);
        assert!(truncated.chars().count() <= 501); // 500 + ellipsis
        assert!(truncated.ends_with('…'));
        assert_eq!(truncate_body("  short note  "), "short note");
    }
}
