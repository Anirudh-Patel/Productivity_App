-- Migration 010: Calendar links for two-way sync with macOS Calendar.app
-- - tasks.calendar_event_uid: uid of the Calendar.app event this task was pushed to ("Quests" calendar)
-- - tasks.source_event_uid: uid of the Calendar.app event this task was imported from (dedup key)
-- - calendar_import_rules: opt-in per-calendar auto-import ("import events from calendar X as tasks")

ALTER TABLE tasks ADD COLUMN calendar_event_uid TEXT;
ALTER TABLE tasks ADD COLUMN source_event_uid TEXT;

CREATE TABLE IF NOT EXISTS calendar_import_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_source_event_uid ON tasks(source_event_uid);
CREATE INDEX IF NOT EXISTS idx_tasks_calendar_event_uid ON tasks(calendar_event_uid);
