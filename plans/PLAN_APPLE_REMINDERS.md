# Plan: Apple Reminders Two-Way Sync

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

User captures todos via Siri/iPhone into Apple Reminders constantly; those never reach the app. Reminders is the highest-value additional connection: zero credentials (osascript, same pattern as the Calendar.app integration), and Siri capture means tasks created by voice anywhere appear as quests.

## Interview

**Q1: Which lists?**
- (a) **[RECOMMENDED]** Per-list opt-in toggles (Settings → Reminders), same UX as calendar import rules. Completed-in-app → completes the reminder; completed-in-Reminders → completes the quest (both directions on sync).
- (b) All lists always.
- **Chosen: (a)**.

**Q2: Sync mechanics?**
- (a) **[RECOMMENDED]** Poll on app start + every 15 min + manual button, via `osascript -l JavaScript` against Reminders.app; incomplete reminders from enabled lists upsert tasks (dedup on reminder id); due dates map to task due dates; priority maps. JXA against Reminders can be slow with huge lists — query only incomplete reminders.
- **Chosen: (a)**.

**Q3: Task→Reminder push?**
- (a) **[RECOMMENDED]** No push (Reminders → app one-way for content, completion syncs both ways). Calendar already handles putting tasks on a timeline; duplicating tasks into Reminders creates loops.
- **Chosen: (a)** — completion-only backflow keeps it loop-free.

## Implementation

1. Migration `013_reminders.sql`: `reminder_lists` (name, enabled), tasks columns `reminder_id TEXT UNIQUE`, `reminder_list TEXT`.
2. Rust `commands/reminders.rs` (JXA via argv, no string interpolation — copy calendar.rs helpers): `get_reminder_lists`, `set_reminder_list_rule`, `sync_reminders` (import incomplete from enabled lists; complete tasks whose reminder got completed; mark reminders complete for tasks completed in-app), all bounded + defensive.
3. lib.rs: `use` + handler entries appended at END. database.rs: add 013 to list.
4. Frontend: remindersStore, Settings → Reminders panel (connect status, list toggles, sync now, last sync), sync hook (app start + 15 min) in Layout, Reminders tag on task cards (additive meta-row span, pattern: project/github tags), completeTask backflow call (non-fatal).
5. First Reminders.app access triggers macOS permission prompt (document).

## Verification

cargo check + npm run build pass; fixture-based JXA JSON parsing tests; live: enable list → reminders appear as quests; complete quest → reminder checked; check reminder → quest completes on next sync.
