# Plan: Two-Way Calendar Sync (macOS Calendar)

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

User wants tasks pulled from a connected calendar and the ability to push tasks onto the calendar (productivity-automation priority #1). Existing code: Calendar page, calendarStore, mock `connect_apple_calendar`/`get_apple_calendar_events` Rust commands, stubbed Google OAuth (`googleCalendar.ts` calls unimplemented commands), an old paused Google-GSI approach in stash@{2}.

## Interview

**Q1: Google OAuth in-app vs macOS Calendar bridge?**
- (a) **[RECOMMENDED]** macOS Calendar (Calendar.app) via AppleScript/`osascript` from Rust. The user's Google account can be added to Calendar.app once (system feature), then ALL calendars (Google, iCloud) are readable/writable locally with zero API keys, zero OAuth, zero token refresh. Matches "personal app on this Mac".
- (b) Google Calendar REST + OAuth client (requires user to create GCP OAuth credentials, token storage, refresh flow).
- **Chosen: (a)** — no credentials to manage; first access triggers one macOS permission dialog. Google-direct can come later if needed.

**Q2: Pull model — what becomes a task?**
- (a) **[RECOMMENDED]** Events are shown in Calendar page + UpcomingEventsWidget from the real calendar; conversion to quest is explicit (existing "convert event to quest" quick action) PLUS an opt-in per-calendar auto-import rule ("import events from calendar X as tasks", default off).
- (b) Auto-import everything.
- **Chosen: (a)** — meetings aren't all tasks; explicit + opt-in rule avoids noise.

**Q3: Push model?**
- (a) **[RECOMMENDED]** Tasks with a due date get "Add to calendar" action (task card menu + CreateTaskModal toggle "put on calendar"). Creates event in a dedicated "Quests" calendar (created if missing) with 1h default duration; completing the task updates the event title with ✅ prefix.
- (b) Sync every task automatically.
- **Chosen: (a)**.

**Q4: Replace or extend existing mock commands?**
- (a) **[RECOMMENDED]** Replace mock implementations of `get_apple_calendar_events` etc. with real osascript-backed ones, keeping command names/signatures the frontend already calls. Delete unused Google OAuth stubs from `googleCalendar.ts` (or leave marked deprecated) — do not build on stash@{2}.
- **Chosen: (a)**.

## Implementation

1. Rust `src-tauri/src/commands/calendar.rs`: helpers running `osascript -e` (AppleScript against Calendar.app):
   - `get_apple_calendar_list()` → calendar names/ids,
   - `get_apple_calendar_events(start, end)` → events (uid, title, start/end, calendar, all-day) — use `osascript -l JavaScript` (JXA) for JSON-friendly output,
   - `create_calendar_event(calendar, title, start, end, notes)` → returns uid; ensure "Quests" calendar exists,
   - `update_calendar_event_title(uid, title)`.
   Note: first call prompts macOS for Calendar access (expected; document in plan/README). Performance: JXA over large ranges is slow — query ±30 days max.
2. Migration `010_calendar_links.sql`: tasks columns `calendar_event_uid TEXT`; `calendar_import_rules` table (calendar_name, enabled).
3. Frontend: wire calendarStore fetch to real commands (it already largely calls them); Calendar page shows real events; per-calendar import-rule toggles in Settings → Calendar; auto-import on sync creates tasks for future events from enabled calendars (dedup on event uid — add `source_event_uid` column or reuse calendar_event_uid).
4. Push: "Add to calendar" in task card menu when due_date set; CreateTaskModal toggle; completeTask updates linked event title with ✅.

## Out of scope

Direct Google API OAuth, recurring-event expansion beyond what Calendar.app returns, two-way edits (event time changes → task updates).

## Verification

- `cargo check` + `npm run build` pass.
- Live: list calendars, events render in Calendar page; create task with "put on calendar" → event appears in Calendar.app "Quests"; complete → ✅ title; enable import rule → events become tasks, no duplicates on re-sync.
