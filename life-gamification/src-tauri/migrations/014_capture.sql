-- Migration 014: Quick-Capture inbox (watched iCloud Drive folder -> quests)

-- Singleton settings row for the capture integration
CREATE TABLE IF NOT EXISTS capture_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    folder_path TEXT,
    last_scan_at DATETIME
);

INSERT OR IGNORE INTO capture_settings (id) VALUES (1);

-- Audit log of ingested inbox files (processed files are moved to processed/,
-- inbox.txt is truncated, so this log is the history of what was captured)
CREATE TABLE IF NOT EXISTS capture_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    tasks_created INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processed',  -- processed | failed
    detail TEXT,                               -- failure reason, if any
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capture_log_imported_at ON capture_log(imported_at);
