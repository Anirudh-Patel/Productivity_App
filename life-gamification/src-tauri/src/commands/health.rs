// Workout verification via Apple Health.
//
// Pipeline: Apple Watch -> iPhone HealthKit -> "Health Auto Export" iOS app dumps
// workout JSON into an iCloud Drive folder -> this module scans that folder,
// imports workouts, and auto-verifies matching open fitness/health tasks
// (completing them through the normal reward path plus a 0.5x bonus XP).

use rusqlite::OptionalExtension;
use serde::Serialize;
use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use tauri::State;

use crate::database::DbConnection;

// ---------- Types ----------

#[derive(Debug, Clone, Serialize)]
pub struct HealthSettings {
    pub folder_path: Option<String>,
    pub last_scan_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkoutRecord {
    pub id: i64,
    pub workout_type: String,
    pub workout_name: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_seconds: i64,
    pub calories: Option<f64>,
    pub distance_m: Option<f64>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct HealthScanSummary {
    pub files_scanned: i64,
    pub workouts_imported: i64,
    pub tasks_verified: i64,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VerifiedTask {
    pub task_id: i64,
    pub title: String,
    pub bonus_xp: i64,
}

/// A workout parsed out of a Health Auto Export JSON file, before persistence.
#[derive(Debug, Clone, PartialEq)]
pub struct ParsedWorkout {
    pub name: String,
    pub workout_type: String,
    /// Local wall time, "YYYY-MM-DD HH:MM:SS".
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_seconds: i64,
    /// kcal
    pub calories: Option<f64>,
    pub distance_m: Option<f64>,
    pub source_id: String,
}

// ---------- Parsing (pure functions, unit-tested against fixtures) ----------

/// Map a HealthKit workout name to our coarse workout type buckets.
pub fn map_workout_type(name: &str) -> &'static str {
    let n = name.to_lowercase();
    if n.contains("run") {
        "run"
    } else if n.contains("strength") || n.contains("functional") {
        "strength"
    } else if n.contains("cycl") || n.contains("bik") {
        "cycling"
    } else if n.contains("walk") {
        "walk"
    } else {
        "other"
    }
}

/// Stable dedupe key for a workout: hash of normalized start time + name.
pub fn workout_source_id(start_time: &str, name: &str) -> String {
    let mut hasher = DefaultHasher::new();
    format!("{}|{}", start_time, name).hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

/// Health Auto Export timestamps look like "2026-07-09 07:01:00 -0700".
/// Returns the local wall time (what the user's watch displayed).
fn parse_health_datetime(raw: &str) -> Option<chrono::NaiveDateTime> {
    let s = raw.trim();
    if let Ok(dt) = chrono::DateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S %z") {
        return Some(dt.naive_local());
    }
    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
        return Some(dt.naive_local());
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M:%S") {
        return Some(dt);
    }
    None
}

/// Extract (qty, lowercased units) from either `{"qty": n, "units": "km"}` or a bare number.
fn qty_units(v: &Value) -> Option<(f64, String)> {
    if let Some(n) = v.as_f64() {
        return Some((n, String::new()));
    }
    let obj = v.as_object()?;
    let qty = obj.get("qty")?.as_f64()?;
    let units = obj
        .get("units")
        .and_then(|u| u.as_str())
        .unwrap_or("")
        .to_lowercase();
    Some((qty, units))
}

/// activeEnergyBurned -> kcal (Health Auto Export commonly emits kJ).
fn parse_calories_kcal(v: &Value) -> Option<f64> {
    let (qty, units) = qty_units(v)?;
    if !qty.is_finite() || qty < 0.0 {
        return None;
    }
    if units.contains("kj") {
        Some(qty / 4.184)
    } else {
        Some(qty) // kcal / Cal
    }
}

/// distance -> meters (km default, miles supported).
fn parse_distance_m(v: &Value) -> Option<f64> {
    let (qty, units) = qty_units(v)?;
    if !qty.is_finite() || qty < 0.0 {
        return None;
    }
    if units.contains("mi") {
        Some(qty * 1609.344)
    } else if units == "m" {
        Some(qty)
    } else {
        // "km", bare numbers, and anything unrecognized: treat as km (HAE default).
        Some(qty * 1000.0)
    }
}

/// Parse one workout entry defensively; returns None (skip) on anything malformed.
fn parse_workout_entry(entry: &Value) -> Option<ParsedWorkout> {
    let name = entry.get("name")?.as_str()?.trim();
    if name.is_empty() {
        return None;
    }
    let start_dt = parse_health_datetime(entry.get("start")?.as_str()?)?;
    let end_dt = entry
        .get("end")
        .and_then(|v| v.as_str())
        .and_then(parse_health_datetime);

    // Health Auto Export's `duration` field is in MINUTES; fall back to end-start.
    let duration_seconds = entry
        .get("duration")
        .and_then(|v| v.as_f64())
        .filter(|m| m.is_finite() && *m > 0.0)
        .map(|minutes| (minutes * 60.0).round() as i64)
        .or_else(|| {
            end_dt
                .map(|end| (end - start_dt).num_seconds())
                .filter(|s| *s > 0)
        })?;

    let start_time = start_dt.format("%Y-%m-%d %H:%M:%S").to_string();
    Some(ParsedWorkout {
        workout_type: map_workout_type(name).to_string(),
        source_id: workout_source_id(&start_time, name),
        name: name.to_string(),
        start_time,
        end_time: end_dt.map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string()),
        duration_seconds,
        calories: entry.get("activeEnergyBurned").and_then(parse_calories_kcal),
        distance_m: entry.get("distance").and_then(parse_distance_m),
    })
}

/// Parse a Health Auto Export JSON document. Supports both the v7+ nested shape
/// {"data": {"workouts": [...]}} and the flat {"workouts": [...]} variant.
/// Malformed documents/entries are skipped, never errors.
pub fn parse_workouts_json(content: &str) -> Vec<ParsedWorkout> {
    let root: Value = match serde_json::from_str(content) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let arr = root
        .get("data")
        .and_then(|d| d.get("workouts"))
        .or_else(|| root.get("workouts"))
        .and_then(|w| w.as_array());
    match arr {
        Some(items) => items.iter().filter_map(parse_workout_entry).collect(),
        None => Vec::new(),
    }
}

/// Does a workout satisfy a task's verification requirement?
pub fn workout_satisfies(
    required_type: &str,
    min_minutes: i64,
    workout_type: &str,
    workout_duration_seconds: i64,
) -> bool {
    let type_ok =
        required_type.is_empty() || required_type == "any" || required_type == workout_type;
    type_ok && workout_duration_seconds >= min_minutes * 60
}

// ---------- Verification (matching open fitness tasks against workouts) ----------

struct VerifyCandidate {
    id: i64,
    title: String,
    required_type: String,
    min_minutes: i64,
    day: String,
    base_xp: i64,
}

/// Match open fitness/health tasks that carry a verification requirement against
/// same-day workouts. Matching tasks are completed via the standard reward path,
/// then granted 0.5x of base XP as a verification bonus and flagged verified.
async fn verify_fitness_tasks_inner(
    db: &State<'_, DbConnection>,
) -> Result<(Vec<VerifiedTask>, Vec<String>), String> {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    // Snapshot matches while holding the lock, then release it before completing
    // tasks (complete_task re-acquires the connection).
    let matched: Vec<VerifyCandidate> = {
        let conn = db.lock().await;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, COALESCE(verify_workout_type, 'any'),
                        COALESCE(verify_min_minutes, 0), due_date, base_experience_reward
                 FROM tasks
                 WHERE user_id = 1 AND status = 'active' AND COALESCE(verified, 0) = 0
                   AND lower(category) IN ('fitness', 'health')
                   AND (verify_workout_type IS NOT NULL OR verify_min_minutes IS NOT NULL)",
            )
            .map_err(|e| format!("Failed to prepare verification query: {}", e))?;

        let candidates: Vec<VerifyCandidate> = stmt
            .query_map([], |row| {
                let due_date: Option<String> = row.get(4)?;
                Ok(VerifyCandidate {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    required_type: row.get(2)?,
                    min_minutes: row.get(3)?,
                    // A task's day is its due date's day if set, otherwise today.
                    day: due_date
                        .as_deref()
                        .and_then(|d| d.get(..10))
                        .map(str::to_string)
                        .unwrap_or_else(|| today.clone()),
                    base_xp: row.get(5)?,
                })
            })
            .map_err(|e| format!("Failed to query verification candidates: {}", e))?
            .filter_map(Result::ok)
            .collect();
        drop(stmt);

        let mut matched = Vec::new();
        for cand in candidates {
            let mut wstmt = conn
                .prepare(
                    "SELECT workout_type, duration_seconds FROM workouts
                     WHERE substr(start_time, 1, 10) = ?1",
                )
                .map_err(|e| format!("Failed to prepare workouts query: {}", e))?;
            let workouts: Vec<(String, i64)> = wstmt
                .query_map([&cand.day], |row| Ok((row.get(0)?, row.get(1)?)))
                .map_err(|e| format!("Failed to query workouts: {}", e))?
                .filter_map(Result::ok)
                .collect();
            drop(wstmt);

            if workouts.iter().any(|(wt, secs)| {
                workout_satisfies(&cand.required_type, cand.min_minutes, wt, *secs)
            }) {
                matched.push(cand);
            }
        }
        matched
    };

    let mut verified = Vec::new();
    let mut errors = Vec::new();
    for cand in matched {
        // Standard completion path first (normal XP/gold/streak/buff logic).
        if let Err(e) = crate::complete_task(db.clone(), cand.id).await {
            errors.push(format!("Failed to complete task {}: {}", cand.id, e));
            continue;
        }

        // Verification bonus: 0.5x extra of base XP, and mark the task verified.
        let bonus_xp = (cand.base_xp as f64 * 0.5).round() as i64;
        {
            let conn = db.lock().await;
            conn.execute(
                "UPDATE users SET experience_points = experience_points + ?1 WHERE id = 1",
                [bonus_xp],
            )
            .map_err(|e| format!("Failed to grant bonus XP for task {}: {}", cand.id, e))?;
            conn.execute("UPDATE tasks SET verified = 1 WHERE id = ?1", [cand.id])
                .map_err(|e| format!("Failed to mark task {} verified: {}", cand.id, e))?;
        }

        verified.push(VerifiedTask {
            task_id: cand.id,
            title: cand.title,
            bonus_xp,
        });
    }

    Ok((verified, errors))
}

// ---------- Commands ----------

#[tauri::command]
pub async fn get_health_settings(db: State<'_, DbConnection>) -> Result<HealthSettings, String> {
    let conn = db.lock().await;
    conn.query_row(
        "SELECT folder_path, last_scan_at FROM health_settings WHERE id = 1",
        [],
        |row| {
            Ok(HealthSettings {
                folder_path: row.get(0)?,
                last_scan_at: row.get(1)?,
            })
        },
    )
    .map_err(|e| format!("Failed to read health settings: {}", e))
}

/// Set (or clear, with an empty string) the watched Health Auto Export folder.
#[tauri::command]
pub async fn set_health_folder(
    db: State<'_, DbConnection>,
    path: String,
) -> Result<HealthSettings, String> {
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
            "UPDATE health_settings SET folder_path = ?1 WHERE id = 1",
            rusqlite::params![stored],
        )
        .map_err(|e| format!("Failed to save health folder: {}", e))?;
    }
    get_health_settings(db).await
}

#[tauri::command]
pub async fn get_workouts(
    db: State<'_, DbConnection>,
    limit: Option<i64>,
) -> Result<Vec<WorkoutRecord>, String> {
    let conn = db.lock().await;
    let mut stmt = conn
        .prepare(
            "SELECT id, workout_type, workout_name, start_time, end_time,
                    duration_seconds, calories, distance_m, source
             FROM workouts ORDER BY start_time DESC LIMIT ?1",
        )
        .map_err(|e| format!("Failed to prepare workouts query: {}", e))?;

    let workouts: Result<Vec<WorkoutRecord>, _> = stmt
        .query_map([limit.unwrap_or(50).max(1)], |row| {
            Ok(WorkoutRecord {
                id: row.get(0)?,
                workout_type: row.get(1)?,
                workout_name: row.get(2)?,
                start_time: row.get(3)?,
                end_time: row.get(4)?,
                duration_seconds: row.get(5)?,
                calories: row.get(6)?,
                distance_m: row.get(7)?,
                source: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query workouts: {}", e))?
        .collect();

    workouts.map_err(|e| format!("Failed to collect workouts: {}", e))
}

/// Scan the configured folder for new/changed *.json exports, import their
/// workouts, then auto-verify matching open fitness tasks.
#[tauri::command]
pub async fn scan_health_folder(db: State<'_, DbConnection>) -> Result<HealthScanSummary, String> {
    let mut summary = HealthScanSummary::default();

    let folder = {
        let conn = db.lock().await;
        conn.query_row(
            "SELECT folder_path FROM health_settings WHERE id = 1",
            [],
            |row| row.get::<_, Option<String>>(0),
        )
        .optional()
        .map_err(|e| format!("Failed to read health settings: {}", e))?
        .flatten()
    };
    let folder = match folder {
        Some(f) if !f.trim().is_empty() => f,
        _ => return Err("No health folder configured. Set one in Settings → Health.".to_string()),
    };

    let dir = std::path::Path::new(&folder);
    if !dir.is_dir() {
        return Err(format!("Health folder not found: {}", folder));
    }

    // List *.json files with their mtimes (no DB lock needed).
    let mut files: Vec<(String, i64, PathBuf)> = Vec::new();
    let entries =
        std::fs::read_dir(dir).map_err(|e| format!("Failed to read health folder: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let is_json = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("json"))
            .unwrap_or(false);
        if !is_json {
            continue;
        }
        let filename = match path.file_name().and_then(|n| n.to_str()) {
            Some(n) => n.to_string(),
            None => continue,
        };
        let mtime = entry
            .metadata()
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);
        files.push((filename, mtime, path));
    }

    // Keep only files that are new or changed vs the import log.
    let to_process: Vec<(String, i64, PathBuf)> = {
        let conn = db.lock().await;
        let mut keep = Vec::new();
        for (filename, mtime, path) in files {
            let seen: Option<i64> = conn
                .query_row(
                    "SELECT mtime FROM health_import_log WHERE filename = ?1",
                    [&filename],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| format!("Failed to read import log: {}", e))?;
            if seen != Some(mtime) {
                keep.push((filename, mtime, path));
            }
        }
        keep
    };

    for (filename, mtime, path) in to_process {
        let content = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(e) => {
                summary.errors.push(format!("Failed to read {}: {}", filename, e));
                continue;
            }
        };
        let workouts = parse_workouts_json(&content);
        summary.files_scanned += 1;

        let conn = db.lock().await;
        for w in &workouts {
            let existing: Option<i64> = conn
                .query_row(
                    "SELECT id FROM workouts WHERE source_id = ?1",
                    [&w.source_id],
                    |row| row.get(0),
                )
                .optional()
                .map_err(|e| format!("Failed to check workout {}: {}", w.source_id, e))?;

            // Upsert by source_id: re-exports refresh metrics without duplicating rows.
            conn.execute(
                "INSERT INTO workouts (user_id, workout_type, workout_name, start_time,
                     end_time, duration_seconds, calories, distance_m, source, source_id)
                 VALUES (1, ?1, ?2, ?3, ?4, ?5, ?6, ?7, 'health_auto_export', ?8)
                 ON CONFLICT(source_id) DO UPDATE SET
                     end_time = excluded.end_time,
                     duration_seconds = excluded.duration_seconds,
                     calories = excluded.calories,
                     distance_m = excluded.distance_m",
                rusqlite::params![
                    w.workout_type,
                    w.name,
                    w.start_time,
                    w.end_time,
                    w.duration_seconds,
                    w.calories,
                    w.distance_m,
                    w.source_id,
                ],
            )
            .map_err(|e| format!("Failed to upsert workout from {}: {}", filename, e))?;

            if existing.is_none() {
                summary.workouts_imported += 1;
            }
        }

        conn.execute(
            "INSERT INTO health_import_log (filename, mtime) VALUES (?1, ?2)
             ON CONFLICT(filename) DO UPDATE SET
                 mtime = excluded.mtime, imported_at = CURRENT_TIMESTAMP",
            rusqlite::params![filename, mtime],
        )
        .map_err(|e| format!("Failed to record import of {}: {}", filename, e))?;
    }

    {
        let conn = db.lock().await;
        conn.execute(
            "UPDATE health_settings SET last_scan_at = CURRENT_TIMESTAMP WHERE id = 1",
            [],
        )
        .map_err(|e| format!("Failed to stamp scan time: {}", e))?;
    }

    let (verified, mut verify_errors) = verify_fitness_tasks_inner(&db).await?;
    summary.tasks_verified = verified.len() as i64;
    summary.errors.append(&mut verify_errors);

    Ok(summary)
}

/// Manually re-run task verification against already-imported workouts.
#[tauri::command]
pub async fn verify_fitness_tasks(db: State<'_, DbConnection>) -> Result<Vec<VerifiedTask>, String> {
    let (verified, errors) = verify_fitness_tasks_inner(&db).await?;
    for e in errors {
        eprintln!("verify_fitness_tasks: {}", e);
    }
    Ok(verified)
}

/// Attach (or clear) a workout-verification requirement to a task after creation.
#[tauri::command]
pub async fn set_task_verification(
    db: State<'_, DbConnection>,
    task_id: i64,
    workout_type: Option<String>,
    min_minutes: Option<i64>,
) -> Result<(), String> {
    let workout_type = workout_type
        .map(|t| t.trim().to_lowercase())
        .filter(|t| !t.is_empty());
    if let Some(t) = &workout_type {
        const ALLOWED: &[&str] = &["any", "run", "strength", "cycling", "walk", "other"];
        if !ALLOWED.contains(&t.as_str()) {
            return Err(format!("Invalid workout type: {}", t));
        }
    }
    let min_minutes = min_minutes.filter(|m| *m > 0);

    let conn = db.lock().await;
    let updated = conn
        .execute(
            "UPDATE tasks SET verify_workout_type = ?1, verify_min_minutes = ?2
             WHERE id = ?3 AND user_id = 1",
            rusqlite::params![workout_type, min_minutes, task_id],
        )
        .map_err(|e| format!("Failed to set task verification: {}", e))?;
    if updated == 0 {
        return Err(format!("Task {} not found", task_id));
    }
    Ok(())
}

// ---------- Tests ----------

#[cfg(test)]
mod tests {
    use super::*;

    const NESTED_FIXTURE: &str =
        include_str!("../../tests/fixtures/health/health_auto_export_nested.json");
    const FLAT_FIXTURE: &str =
        include_str!("../../tests/fixtures/health/health_auto_export_flat.json");

    #[test]
    fn maps_workout_names_to_types() {
        assert_eq!(map_workout_type("Outdoor Run"), "run");
        assert_eq!(map_workout_type("Indoor Run"), "run");
        assert_eq!(map_workout_type("Traditional Strength Training"), "strength");
        assert_eq!(map_workout_type("Functional Strength Training"), "strength");
        assert_eq!(map_workout_type("Outdoor Cycle"), "cycling");
        assert_eq!(map_workout_type("Mountain Biking"), "cycling");
        assert_eq!(map_workout_type("Outdoor Walk"), "walk");
        assert_eq!(map_workout_type("Pool Swim"), "other");
        assert_eq!(map_workout_type("Yoga"), "other");
    }

    #[test]
    fn parses_nested_health_auto_export_shape() {
        let workouts = parse_workouts_json(NESTED_FIXTURE);
        // 3 valid entries; the start-less entry and the bare string are skipped.
        assert_eq!(workouts.len(), 3);

        let run = &workouts[0];
        assert_eq!(run.name, "Outdoor Run");
        assert_eq!(run.workout_type, "run");
        assert_eq!(run.start_time, "2026-07-09 07:01:00");
        assert_eq!(run.end_time.as_deref(), Some("2026-07-09 07:31:00"));
        // duration is minutes: 30.02 min -> 1801 s
        assert_eq!(run.duration_seconds, 1801);
        // 250 kJ -> ~59.75 kcal
        let kcal = run.calories.expect("run should have calories");
        assert!((kcal - 59.7514).abs() < 0.01, "got {}", kcal);
        // 5.2 km -> 5200 m
        assert!((run.distance_m.unwrap() - 5200.0).abs() < 0.001);

        let strength = &workouts[1];
        assert_eq!(strength.workout_type, "strength");
        assert_eq!(strength.duration_seconds, 2700);
        assert!((strength.calories.unwrap() - 320.0).abs() < 0.001); // kcal passes through
        assert_eq!(strength.distance_m, None);

        // No duration field -> falls back to end - start (25 min).
        let walk = &workouts[2];
        assert_eq!(walk.workout_type, "walk");
        assert_eq!(walk.duration_seconds, 1500);
    }

    #[test]
    fn parses_flat_workouts_variant() {
        let workouts = parse_workouts_json(FLAT_FIXTURE);
        assert_eq!(workouts.len(), 2);

        let cycle = &workouts[0];
        assert_eq!(cycle.workout_type, "cycling");
        assert_eq!(cycle.duration_seconds, 2910);
        // 12.4 mi -> ~19955.87 m
        assert!((cycle.distance_m.unwrap() - 19955.8656).abs() < 0.01);

        let strength = &workouts[1];
        assert_eq!(strength.workout_type, "strength");
        assert_eq!(strength.end_time, None);
        assert_eq!(strength.duration_seconds, 2100);
        // 900 kJ -> ~215.11 kcal
        assert!((strength.calories.unwrap() - 215.1052).abs() < 0.01);
    }

    #[test]
    fn malformed_documents_yield_no_workouts() {
        assert!(parse_workouts_json("not json at all").is_empty());
        assert!(parse_workouts_json("{}").is_empty());
        assert!(parse_workouts_json("{\"data\": {\"workouts\": \"nope\"}}").is_empty());
        assert!(parse_workouts_json("{\"workouts\": [{\"name\": \"Run\"}]}").is_empty());
    }

    #[test]
    fn source_ids_are_stable_and_distinct() {
        let a = workout_source_id("2026-07-09 07:01:00", "Outdoor Run");
        let b = workout_source_id("2026-07-09 07:01:00", "Outdoor Run");
        let c = workout_source_id("2026-07-09 07:01:00", "Outdoor Walk");
        let d = workout_source_id("2026-07-10 07:01:00", "Outdoor Run");
        assert_eq!(a, b);
        assert_ne!(a, c);
        assert_ne!(a, d);

        // Re-parsing the same file yields the same source ids (dedupe on re-export).
        let first = parse_workouts_json(NESTED_FIXTURE);
        let second = parse_workouts_json(NESTED_FIXTURE);
        let ids1: Vec<_> = first.iter().map(|w| w.source_id.clone()).collect();
        let ids2: Vec<_> = second.iter().map(|w| w.source_id.clone()).collect();
        assert_eq!(ids1, ids2);
    }

    #[test]
    fn workout_matching_respects_type_and_duration() {
        // "any" (or empty) matches every type.
        assert!(workout_satisfies("any", 0, "run", 600));
        assert!(workout_satisfies("", 0, "strength", 600));

        // Exact type match required otherwise.
        assert!(workout_satisfies("run", 0, "run", 600));
        assert!(!workout_satisfies("run", 0, "walk", 600));

        // Minimum minutes gate.
        assert!(workout_satisfies("run", 30, "run", 1801)); // 30.02 min run
        assert!(!workout_satisfies("run", 30, "run", 1799)); // 29.98 min run
        assert!(workout_satisfies("any", 25, "walk", 1500)); // exactly 25 min
        assert!(!workout_satisfies("any", 26, "walk", 1500));
    }
}
