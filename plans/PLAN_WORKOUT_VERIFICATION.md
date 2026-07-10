# Plan: Workout Verification (Apple Health)

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

User wants Apple workout data to confirm completion of physical-activity tasks (productivity-automation priority #4). HealthKit is iOS/watchOS-only — no direct macOS API.

## Interview

**Q1: How does health data reach the Mac?**
- (a) **[RECOMMENDED]** "Health Auto Export" iOS app (well-known, one-time ~$5 or sub) exporting workout JSON/CSV to an iCloud Drive folder on a schedule; the desktop app watches that folder. Reliable, no server.
- (b) Manual Apple Health full export (XML zip) — huge file, manual, but free; support as secondary one-shot import.
- (c) Companion iOS app (way out of scope).
- **Chosen: (a) primary + (b) fallback importer.** BLOCKED partially on user installing the iOS app — build the folder-watcher + parser now with sample fixtures; also parse Health-export XML for (b).

**Q2: Matching workouts → tasks?**
- (a) **[RECOMMENDED]** Fitness-category tasks get optional `verification` requirement: workout type (any/run/strength/cycling/walk) + min duration. A workout record satisfies a task if type matches, duration ≥ min, and workout date == task's day. Verified completion grants bonus XP (1.5x); unverified manual completion still allowed (honor system) at normal XP.
- (b) Hard-block completion without workout data.
- **Chosen: (a)** — hard-block is hostile when export lags.

**Q3: Sync trigger?**
- (a) **[RECOMMENDED]** Scan the configured folder on app start + every 15 min + manual button in Settings → Health; parse new files (track by filename+mtime in `health_import_log`), upsert `workouts` table, then auto-verify matching open fitness tasks (auto-complete with bonus XP + toast).
- **Chosen: (a)**.

## Implementation

1. Migration `012_health.sql`: `workouts` (id, workout_type, start_time, end_time, duration_seconds, calories, distance_m, source, source_id UNIQUE), `health_import_log` (filename, mtime, imported_at); tasks columns `verify_workout_type TEXT`, `verify_min_minutes INTEGER`, `verified INTEGER DEFAULT 0`.
2. Rust `src-tauri/src/commands/health.rs`: `set_health_folder(path)` (store in preferences/table), `scan_health_folder()` (read new JSON files — Health Auto Export workout schema; also accept `export.xml` from full Health export via quick-xml), `get_workouts(range)`, `verify_fitness_tasks()` (matching logic; completes tasks via existing completion path with multiplier).
3. Frontend: Settings → Health panel (folder picker, last scan, recent workouts list); CreateTaskModal fitness category shows optional verification fields; task card shows ✓verified badge; TodaysHabits shows verification state for fitness habits.
4. Sample fixture files in `src-tauri/tests/fixtures/` for parser tests.

## Out of scope

Steps/rings/sleep, Strava, direct HealthKit, background daemon when app closed.

## Verification

- `cargo check` + `npm run build` pass; parser unit tests on fixtures pass.
- Drop fixture JSON into watched folder → scan → workout rows appear; fitness task with matching requirement auto-completes with bonus XP.
