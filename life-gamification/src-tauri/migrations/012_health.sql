-- Migration 012: Workout verification (Apple Watch -> Health Auto Export JSON -> watched folder)

-- Imported workouts (parsed from Health Auto Export JSON dumps)
CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    workout_type TEXT NOT NULL,               -- run | strength | cycling | walk | other
    workout_name TEXT NOT NULL,               -- raw workout name from the source (e.g. "Outdoor Run")
    start_time TEXT NOT NULL,                 -- local wall time "YYYY-MM-DD HH:MM:SS"
    end_time TEXT,
    duration_seconds INTEGER NOT NULL,
    calories REAL,                            -- kcal
    distance_m REAL,
    source TEXT NOT NULL DEFAULT 'health_auto_export',
    source_id TEXT NOT NULL UNIQUE,           -- stable hash of start+name (dedupes re-exported files)
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workouts_start_time ON workouts(start_time);
CREATE INDEX IF NOT EXISTS idx_workouts_type ON workouts(workout_type);

-- Files already imported from the watched folder (filename + mtime dedupe)
CREATE TABLE IF NOT EXISTS health_import_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    mtime INTEGER NOT NULL DEFAULT 0,
    imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Singleton settings row for the health integration
CREATE TABLE IF NOT EXISTS health_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    folder_path TEXT,
    last_scan_at DATETIME
);

INSERT OR IGNORE INTO health_settings (id) VALUES (1);

-- Optional workout-verification requirements on tasks
ALTER TABLE tasks ADD COLUMN verify_workout_type TEXT;    -- any | run | strength | cycling | walk | other
ALTER TABLE tasks ADD COLUMN verify_min_minutes INTEGER;
ALTER TABLE tasks ADD COLUMN verified INTEGER DEFAULT 0;  -- 1 when auto-verified by a matching workout
