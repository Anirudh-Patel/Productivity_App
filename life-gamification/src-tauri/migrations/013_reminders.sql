-- Migration 013: Apple Reminders integration (Reminders.app -> tasks; completion syncs both ways)
-- - reminder_lists: per-list opt-in toggles (same UX as calendar_import_rules)
-- - reminders_settings: singleton row for the last sync timestamp
-- - tasks.reminder_id / tasks.reminder_list: link imported tasks back to their reminder

CREATE TABLE IF NOT EXISTS reminder_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminders_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_sync_at DATETIME
);

INSERT OR IGNORE INTO reminders_settings (id) VALUES (1);

ALTER TABLE tasks ADD COLUMN reminder_id TEXT;
ALTER TABLE tasks ADD COLUMN reminder_list TEXT;

-- One task per reminder (SQLite can't add a UNIQUE column via ALTER TABLE,
-- so uniqueness is enforced with a partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_reminder_id
    ON tasks(reminder_id)
    WHERE reminder_id IS NOT NULL;
