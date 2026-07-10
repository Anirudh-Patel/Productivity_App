// Calendar integration commands: two-way sync with macOS Calendar.app.
//
// All Calendar.app access goes through `osascript -l JavaScript` (JXA) so the app
// needs no API keys or OAuth — the user's Google/iCloud calendars are readable and
// writable once they are added to Calendar.app. NOTE: the very first call triggers
// the macOS "allow access to Calendar" permission dialog (expected, one time).
//
// Performance: Calendar JXA is slow over large ranges, so event queries are always
// bounded (default ±30 days).

use serde::{Deserialize, Serialize};
use std::process::Command;

use crate::database::DbConnection;

/// Dedicated calendar that pushed quests are written into (created on demand).
const QUESTS_CALENDAR: &str = "Quests";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub start: String,
    pub end: Option<String>,
    #[serde(rename = "allDay")]
    pub all_day: Option<bool>,
    pub description: Option<String>,
    pub source: String,
    /// Name of the Calendar.app calendar this event belongs to.
    pub calendar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarConnectionResult {
    pub connected: bool,
    pub calendar_id: Option<String>,
    /// Names of all calendars visible in Calendar.app.
    pub calendars: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarImportRule {
    pub calendar_name: String,
    pub enabled: bool,
}

/// Shape of a single event as emitted by the JXA events script.
#[derive(Debug, Deserialize)]
struct JxaEvent {
    uid: String,
    title: String,
    start: String,
    end: Option<String>,
    #[serde(rename = "allDay")]
    all_day: bool,
    description: Option<String>,
    calendar: String,
}

#[derive(Debug, Deserialize)]
struct JxaUidResponse {
    uid: String,
}

#[derive(Debug, Deserialize)]
struct JxaUpdatedResponse {
    updated: bool,
}

// ---------------------------------------------------------------------------
// JXA scripts (run with `osascript -l JavaScript`; parameters passed via argv
// so no string-escaping of user data into the script body is ever needed)
// ---------------------------------------------------------------------------

const JXA_LIST_CALENDARS: &str = r#"
function run() {
  const app = Application("Calendar");
  const names = [];
  const cals = app.calendars();
  for (let i = 0; i < cals.length; i++) {
    try { names.push(cals[i].name()); } catch (e) {}
  }
  return JSON.stringify(names);
}
"#;

// argv: [startIso, endIso, calendarNamesJson ("" = all calendars)]
const JXA_GET_EVENTS: &str = r#"
function run(argv) {
  const start = new Date(argv[0]);
  const end = new Date(argv[1]);
  const filter = argv[2] ? JSON.parse(argv[2]) : null;
  const app = Application("Calendar");
  const out = [];
  const cals = app.calendars();
  for (let i = 0; i < cals.length; i++) {
    let calName;
    try { calName = cals[i].name(); } catch (e) { continue; }
    if (filter && filter.indexOf(calName) === -1) continue;
    let evts;
    try {
      evts = cals[i].events.whose({
        _and: [
          { startDate: { _greaterThan: start } },
          { startDate: { _lessThan: end } }
        ]
      })();
    } catch (e) { continue; }
    for (let j = 0; j < evts.length; j++) {
      try {
        const ev = evts[j];
        let desc = null;
        try { const d = ev.description(); if (typeof d === "string") desc = d; } catch (e) {}
        let endDate = null;
        try { const ed = ev.endDate(); if (ed) endDate = ed.toISOString(); } catch (e) {}
        out.push({
          uid: ev.uid(),
          title: ev.summary(),
          start: ev.startDate().toISOString(),
          end: endDate,
          allDay: !!ev.alldayEvent(),
          description: desc,
          calendar: calName
        });
      } catch (e) {}
    }
  }
  return JSON.stringify(out);
}
"#;

// argv: [calendarName, title, startIso, endIso, notes]
const JXA_CREATE_EVENT: &str = r#"
function run(argv) {
  const calName = argv[0];
  const title = argv[1];
  const startIso = argv[2];
  const endIso = argv[3];
  const notes = argv[4] || "";
  const app = Application("Calendar");
  let cal = null;
  try {
    const matches = app.calendars.whose({ name: calName })();
    if (matches.length > 0) cal = matches[0];
  } catch (e) {}
  if (!cal) {
    cal = app.Calendar({ name: calName });
    app.calendars.push(cal);
  }
  const ev = app.Event({
    summary: title,
    startDate: new Date(startIso),
    endDate: new Date(endIso),
    description: notes
  });
  cal.events.push(ev);
  return JSON.stringify({ uid: ev.uid() });
}
"#;

// argv: [uid, newTitle, preferredCalendarName]
const JXA_UPDATE_EVENT_TITLE: &str = r#"
function run(argv) {
  const uid = argv[0];
  const newTitle = argv[1];
  const preferred = argv[2];
  const app = Application("Calendar");
  const tryCal = (cal) => {
    const matches = cal.events.whose({ uid: uid })();
    if (matches.length > 0) { matches[0].summary = newTitle; return true; }
    return false;
  };
  try {
    const named = app.calendars.whose({ name: preferred })();
    for (let i = 0; i < named.length; i++) {
      if (tryCal(named[i])) return JSON.stringify({ updated: true });
    }
  } catch (e) {}
  const cals = app.calendars();
  for (let i = 0; i < cals.length; i++) {
    try { if (tryCal(cals[i])) return JSON.stringify({ updated: true }); } catch (e) {}
  }
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
            "Calendar access failed (is Calendar permission granted in System Settings > Privacy & Security > Automation?): {}",
            stderr.trim()
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// Parse the JSON emitted by JXA_GET_EVENTS into CalendarEvent structs.
fn parse_events_json(json: &str) -> Result<Vec<CalendarEvent>, String> {
    let raw: Vec<JxaEvent> =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse calendar events: {}", e))?;
    Ok(raw
        .into_iter()
        .map(|e| CalendarEvent {
            id: e.uid,
            title: e.title,
            start: e.start,
            end: e.end,
            all_day: Some(e.all_day),
            description: e.description,
            source: "apple".to_string(),
            calendar: Some(e.calendar),
        })
        .collect())
}

fn parse_uid_json(json: &str) -> Result<String, String> {
    let resp: JxaUidResponse =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse create-event response: {}", e))?;
    Ok(resp.uid)
}

fn parse_updated_json(json: &str) -> Result<bool, String> {
    let resp: JxaUpdatedResponse =
        serde_json::from_str(json).map_err(|e| format!("Failed to parse update response: {}", e))?;
    Ok(resp.updated)
}

/// Convert a task due date string into an (start, end) event window with a
/// 1-hour default duration. Date-only due dates become 09:00–10:00 local time.
/// Output strings are ISO-like and directly consumable by JS `new Date(...)`.
fn due_date_to_event_window(due: &str) -> Result<(String, String), String> {
    use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime};

    const OUT_FMT: &str = "%Y-%m-%dT%H:%M:%S";

    // Full RFC3339 / ISO with timezone (e.g. from new Date().toISOString()).
    if let Ok(dt) = DateTime::parse_from_rfc3339(due) {
        return Ok((dt.to_rfc3339(), (dt + Duration::hours(1)).to_rfc3339()));
    }

    // Naive datetime forms (interpreted as local time by JS Date).
    for fmt in [
        "%Y-%m-%dT%H:%M:%S%.f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
    ] {
        if let Ok(ndt) = NaiveDateTime::parse_from_str(due, fmt) {
            return Ok((
                ndt.format(OUT_FMT).to_string(),
                (ndt + Duration::hours(1)).format(OUT_FMT).to_string(),
            ));
        }
    }

    // Date-only: schedule at 09:00 local.
    if let Ok(nd) = NaiveDate::parse_from_str(due, "%Y-%m-%d") {
        let start = nd
            .and_hms_opt(9, 0, 0)
            .ok_or_else(|| "Invalid time".to_string())?;
        return Ok((
            start.format(OUT_FMT).to_string(),
            (start + Duration::hours(1)).format(OUT_FMT).to_string(),
        ));
    }

    Err(format!("Unrecognized due date format: {}", due))
}

/// Default bounded query window: ±30 days around now (Calendar JXA is slow on
/// large ranges).
fn default_window() -> (String, String) {
    let now = chrono::Utc::now();
    (
        (now - chrono::Duration::days(30)).to_rfc3339(),
        (now + chrono::Duration::days(30)).to_rfc3339(),
    )
}

fn fetch_events(
    start: &str,
    end: &str,
    calendar_filter: Option<&[String]>,
) -> Result<Vec<CalendarEvent>, String> {
    let filter_json = match calendar_filter {
        Some(names) if !names.is_empty() => serde_json::to_string(names)
            .map_err(|e| format!("Failed to encode calendar filter: {}", e))?,
        _ => String::new(),
    };
    let out = run_jxa(JXA_GET_EVENTS, &[start, end, &filter_json])?;
    parse_events_json(&out)
}

// ---------------------------------------------------------------------------
// Commands — read side
// ---------------------------------------------------------------------------

/// Connect to Calendar.app. Listing calendars triggers the one-time macOS
/// permission prompt; success means we have access.
#[tauri::command]
pub async fn connect_apple_calendar() -> Result<CalendarConnectionResult, String> {
    let out = run_jxa(JXA_LIST_CALENDARS, &[])?;
    let calendars: Vec<String> =
        serde_json::from_str(&out).map_err(|e| format!("Failed to parse calendar list: {}", e))?;
    Ok(CalendarConnectionResult {
        connected: true,
        calendar_id: Some("primary".to_string()),
        calendars,
    })
}

#[tauri::command]
pub async fn disconnect_apple_calendar() -> Result<(), String> {
    // Nothing to tear down — access is a macOS permission, not a session.
    Ok(())
}

#[tauri::command]
pub async fn get_apple_calendar_list() -> Result<Vec<String>, String> {
    let out = run_jxa(JXA_LIST_CALENDARS, &[])?;
    serde_json::from_str(&out).map_err(|e| format!("Failed to parse calendar list: {}", e))
}

/// Fetch real events from Calendar.app in a bounded window (defaults: ±30 days).
/// `calendar_id` is kept for signature compatibility; "primary"/empty means all
/// calendars, any other value filters to that single calendar by name.
#[tauri::command]
pub async fn get_apple_calendar_events(
    calendar_id: Option<String>,
    start: Option<String>,
    end: Option<String>,
) -> Result<Vec<CalendarEvent>, String> {
    let (default_start, default_end) = default_window();
    let start = start.unwrap_or(default_start);
    let end = end.unwrap_or(default_end);

    let filter: Option<Vec<String>> = match calendar_id.as_deref() {
        None | Some("") | Some("primary") => None,
        Some(name) => Some(vec![name.to_string()]),
    };

    fetch_events(&start, &end, filter.as_deref())
}

// ---------------------------------------------------------------------------
// Commands — write side (push tasks to calendar)
// ---------------------------------------------------------------------------

/// Create an event in Calendar.app (in the "Quests" calendar by default,
/// creating it if missing). Returns the event uid.
#[tauri::command]
pub async fn create_calendar_event(
    calendar: Option<String>,
    title: String,
    start: String,
    end: String,
    notes: Option<String>,
) -> Result<String, String> {
    let cal_name = calendar.unwrap_or_else(|| QUESTS_CALENDAR.to_string());
    let notes = notes.unwrap_or_default();
    let out = run_jxa(JXA_CREATE_EVENT, &[&cal_name, &title, &start, &end, &notes])?;
    parse_uid_json(&out)
}

/// Update the title of an existing calendar event, located by uid.
#[tauri::command]
pub async fn update_calendar_event_title(uid: String, title: String) -> Result<bool, String> {
    let out = run_jxa(JXA_UPDATE_EVENT_TITLE, &[&uid, &title, QUESTS_CALENDAR])?;
    parse_updated_json(&out)
}

/// Push a task onto the calendar: creates a 1-hour event in the "Quests"
/// calendar at the task's due date and stores the event uid on the task.
/// Idempotent — returns the existing uid if the task is already linked.
#[tauri::command]
pub async fn add_task_to_calendar(
    db: tauri::State<'_, DbConnection>,
    task_id: i64,
) -> Result<String, String> {
    // Read task details (release the DB lock before the slow JXA call).
    let (title, due_date, description, existing_uid): (
        String,
        Option<String>,
        Option<String>,
        Option<String>,
    ) = {
        let conn = db.lock().await;
        conn.query_row(
            "SELECT title, due_date, description, calendar_event_uid FROM tasks WHERE id = ?1 AND user_id = 1",
            [task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| format!("Task not found: {}", e))?
    };

    if let Some(uid) = existing_uid {
        if !uid.is_empty() {
            return Ok(uid); // Already on the calendar.
        }
    }

    let due = due_date.ok_or_else(|| "Task has no due date".to_string())?;
    let (start, end) = due_date_to_event_window(&due)?;
    let notes = description.unwrap_or_default();

    let out = run_jxa(
        JXA_CREATE_EVENT,
        &[QUESTS_CALENDAR, &title, &start, &end, &notes],
    )?;
    let uid = parse_uid_json(&out)?;

    {
        let conn = db.lock().await;
        conn.execute(
            "UPDATE tasks SET calendar_event_uid = ?1 WHERE id = ?2",
            rusqlite::params![uid, task_id],
        )
        .map_err(|e| format!("Failed to link task to calendar event: {}", e))?;
    }

    Ok(uid)
}

/// After a task is completed, prefix its linked calendar event title with ✅.
/// No-op (returns false) if the task has no linked event. Intended to be
/// called fire-and-forget from the frontend — errors are non-fatal there.
#[tauri::command]
pub async fn mark_calendar_event_completed(
    db: tauri::State<'_, DbConnection>,
    task_id: i64,
) -> Result<bool, String> {
    let (title, uid): (String, Option<String>) = {
        let conn = db.lock().await;
        conn.query_row(
            "SELECT title, calendar_event_uid FROM tasks WHERE id = ?1 AND user_id = 1",
            [task_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Task not found: {}", e))?
    };

    let uid = match uid {
        Some(u) if !u.is_empty() => u,
        _ => return Ok(false),
    };

    let new_title = format!("✅ {}", title);
    let out = run_jxa(JXA_UPDATE_EVENT_TITLE, &[&uid, &new_title, QUESTS_CALENDAR])?;
    parse_updated_json(&out)
}

// ---------------------------------------------------------------------------
// Commands — import rules & auto-import (pull events into tasks)
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_calendar_import_rules(
    db: tauri::State<'_, DbConnection>,
) -> Result<Vec<CalendarImportRule>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare("SELECT calendar_name, enabled FROM calendar_import_rules ORDER BY calendar_name")
        .map_err(|e| format!("Failed to prepare import rules query: {}", e))?;
    let rules = stmt
        .query_map([], |row| {
            Ok(CalendarImportRule {
                calendar_name: row.get(0)?,
                enabled: row.get::<_, i64>(1)? != 0,
            })
        })
        .map_err(|e| format!("Failed to query import rules: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect import rules: {}", e))?;
    Ok(rules)
}

#[tauri::command]
pub async fn set_calendar_import_rule(
    db: tauri::State<'_, DbConnection>,
    calendar_name: String,
    enabled: bool,
) -> Result<(), String> {
    let conn = db.lock().await;
    conn.execute(
        "INSERT INTO calendar_import_rules (calendar_name, enabled) VALUES (?1, ?2)
         ON CONFLICT(calendar_name) DO UPDATE SET enabled = excluded.enabled",
        rusqlite::params![calendar_name, enabled as i64],
    )
    .map_err(|e| format!("Failed to save import rule: {}", e))?;
    Ok(())
}

/// Auto-import: create tasks for upcoming events (next 30 days) from calendars
/// with an enabled import rule. Deduplicates on event uid, and never imports
/// from the "Quests" calendar (those events originate from tasks). Returns the
/// number of tasks created.
#[tauri::command]
pub async fn import_calendar_events_as_tasks(
    db: tauri::State<'_, DbConnection>,
) -> Result<i64, String> {
    // 1. Enabled calendars.
    let enabled: Vec<String> = {
        let conn = db.lock().await;
        let mut stmt = conn
            .prepare("SELECT calendar_name FROM calendar_import_rules WHERE enabled = 1")
            .map_err(|e| format!("Failed to prepare rules query: {}", e))?;
        let names = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(|e| format!("Failed to query rules: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Failed to collect rules: {}", e))?;
        names
    };

    let enabled: Vec<String> = enabled
        .into_iter()
        .filter(|name| name != QUESTS_CALENDAR)
        .collect();
    if enabled.is_empty() {
        return Ok(0);
    }

    // 2. Upcoming events from those calendars only (bounded window, JXA is slow).
    let now = chrono::Utc::now();
    let start = now.to_rfc3339();
    let end = (now + chrono::Duration::days(30)).to_rfc3339();
    let events = fetch_events(&start, &end, Some(&enabled))?;

    // 3. Insert tasks for events not seen before (dedup on uid).
    let mut imported = 0i64;
    let conn = db.lock().await;
    for event in events {
        if event.calendar.as_deref() == Some(QUESTS_CALENDAR) {
            continue;
        }
        let already: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE source_event_uid = ?1 OR calendar_event_uid = ?1",
                [&event.id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if already > 0 {
            continue;
        }

        // Same reward formula as create_task with default difficulty 3.
        let difficulty = 3i32;
        let base_xp = 10 + (difficulty - 1) * 5;
        let gold_reward = 1 + (difficulty - 1);

        conn.execute(
            "INSERT INTO tasks (user_id, title, description, category, difficulty,
             base_experience_reward, gold_reward, due_date, status, priority, task_type, source_event_uid)
             VALUES (1, ?1, ?2, 'general', ?3, ?4, ?5, ?6, 'active', 3, 'standard', ?7)",
            rusqlite::params![
                event.title,
                event.description,
                difficulty,
                base_xp,
                gold_reward,
                event.start,
                event.id,
            ],
        )
        .map_err(|e| format!("Failed to insert imported task: {}", e))?;
        imported += 1;
    }

    Ok(imported)
}

// ---------------------------------------------------------------------------
// Tests (JSON parsing + date logic; live Calendar.app access can't run in CI
// because the first call triggers the macOS permission prompt)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_events_fixture() {
        let fixture = r#"[
            {"uid":"ABC-123","title":"Team Meeting","start":"2026-07-11T17:00:00.000Z","end":"2026-07-11T18:00:00.000Z","allDay":false,"description":"Weekly sync","calendar":"Work"},
            {"uid":"DEF-456","title":"Holiday","start":"2026-07-14T00:00:00.000Z","end":null,"allDay":true,"description":null,"calendar":"Personal"}
        ]"#;
        let events = parse_events_json(fixture).expect("fixture should parse");
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].id, "ABC-123");
        assert_eq!(events[0].title, "Team Meeting");
        assert_eq!(events[0].all_day, Some(false));
        assert_eq!(events[0].source, "apple");
        assert_eq!(events[0].calendar.as_deref(), Some("Work"));
        assert_eq!(events[1].end, None);
        assert_eq!(events[1].description, None);
        assert_eq!(events[1].all_day, Some(true));
    }

    #[test]
    fn parses_empty_events() {
        let events = parse_events_json("[]").expect("empty array should parse");
        assert!(events.is_empty());
    }

    #[test]
    fn rejects_malformed_events() {
        assert!(parse_events_json("not json").is_err());
        assert!(parse_events_json(r#"[{"uid":"x"}]"#).is_err()); // missing fields
    }

    #[test]
    fn parses_uid_response() {
        assert_eq!(
            parse_uid_json(r#"{"uid":"1B0AF2C3-XYZ"}"#).unwrap(),
            "1B0AF2C3-XYZ"
        );
        assert!(parse_uid_json("{}").is_err());
    }

    #[test]
    fn parses_updated_response() {
        assert!(parse_updated_json(r#"{"updated":true}"#).unwrap());
        assert!(!parse_updated_json(r#"{"updated":false}"#).unwrap());
    }

    #[test]
    fn date_only_due_date_becomes_9am_one_hour() {
        let (start, end) = due_date_to_event_window("2026-07-15").unwrap();
        assert_eq!(start, "2026-07-15T09:00:00");
        assert_eq!(end, "2026-07-15T10:00:00");
    }

    #[test]
    fn naive_datetime_due_date_keeps_time() {
        let (start, end) = due_date_to_event_window("2026-07-15T14:30").unwrap();
        assert_eq!(start, "2026-07-15T14:30:00");
        assert_eq!(end, "2026-07-15T15:30:00");
    }

    #[test]
    fn rfc3339_due_date_round_trips() {
        let (start, end) = due_date_to_event_window("2026-07-15T14:00:00.000Z").unwrap();
        assert!(start.starts_with("2026-07-15T14:00:00"));
        assert!(end.starts_with("2026-07-15T15:00:00"));
    }

    #[test]
    fn invalid_due_date_errors() {
        assert!(due_date_to_event_window("next tuesday").is_err());
    }
}
