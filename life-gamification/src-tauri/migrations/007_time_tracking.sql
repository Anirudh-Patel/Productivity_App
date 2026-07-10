-- Migration 007: Time Tracking System
-- Adds comprehensive time tracking for tasks

-- Create time_sessions table for logging work sessions
CREATE TABLE IF NOT EXISTS time_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,

    -- Time tracking
    start_time DATETIME NOT NULL,
    end_time DATETIME,
    duration_seconds INTEGER, -- Calculated when session ends

    -- Session metadata
    session_type TEXT DEFAULT 'focus' CHECK (session_type IN ('focus', 'break', 'manual', 'pomodoro')),
    is_completed BOOLEAN DEFAULT 0, -- For Pomodoro sessions
    notes TEXT,
    tags TEXT, -- JSON array of tags

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Ensure duration is calculated when end_time is set
    CHECK (end_time IS NULL OR end_time > start_time)
);

-- Add time tracking fields to tasks table
ALTER TABLE tasks ADD COLUMN estimated_time_minutes INTEGER; -- User's time estimate
ALTER TABLE tasks ADD COLUMN total_time_spent_seconds INTEGER DEFAULT 0; -- Cumulative time
ALTER TABLE tasks ADD COLUMN last_worked_at DATETIME; -- Last time timer was active

-- Create active_timers table to track currently running timers
CREATE TABLE IF NOT EXISTS active_timers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    session_id INTEGER NOT NULL REFERENCES time_sessions(id) ON DELETE CASCADE,
    start_time DATETIME NOT NULL,
    is_paused BOOLEAN DEFAULT 0,
    paused_at DATETIME,
    total_paused_seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Only one active timer per user
    UNIQUE(user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_sessions_task ON time_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_time_sessions_user ON time_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_time_sessions_start_time ON time_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_time_sessions_type ON time_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_active_timers_user ON active_timers(user_id);
CREATE INDEX IF NOT EXISTS idx_active_timers_task ON active_timers(task_id);

-- Create trigger to auto-calculate duration when session ends
CREATE TRIGGER IF NOT EXISTS calculate_session_duration
AFTER UPDATE OF end_time ON time_sessions
WHEN NEW.end_time IS NOT NULL AND OLD.end_time IS NULL
BEGIN
    UPDATE time_sessions
    SET duration_seconds =
        CAST((julianday(NEW.end_time) - julianday(NEW.start_time)) * 86400 AS INTEGER)
    WHERE id = NEW.id;
END;

-- Create trigger to update task's total_time_spent when session completes
CREATE TRIGGER IF NOT EXISTS update_task_total_time
AFTER UPDATE OF duration_seconds ON time_sessions
WHEN NEW.duration_seconds IS NOT NULL AND OLD.duration_seconds IS NULL
BEGIN
    UPDATE tasks
    SET
        total_time_spent_seconds = COALESCE(total_time_spent_seconds, 0) + NEW.duration_seconds,
        last_worked_at = NEW.end_time
    WHERE id = NEW.task_id;
END;

-- Create view for time analytics
CREATE VIEW IF NOT EXISTS v_task_time_summary AS
SELECT
    t.id as task_id,
    t.title,
    t.category,
    t.project_id,
    t.estimated_time_minutes,
    t.total_time_spent_seconds,
    ROUND(CAST(t.total_time_spent_seconds AS REAL) / 60, 1) as total_time_minutes,
    COUNT(DISTINCT ts.id) as session_count,
    COUNT(DISTINCT CASE WHEN ts.session_type = 'pomodoro' THEN ts.id END) as pomodoro_count,
    MAX(ts.end_time) as last_session_time,
    AVG(ts.duration_seconds) as avg_session_duration
FROM tasks t
LEFT JOIN time_sessions ts ON t.id = ts.task_id AND ts.end_time IS NOT NULL
GROUP BY t.id;

-- Create view for daily time summary
CREATE VIEW IF NOT EXISTS v_daily_time_summary AS
SELECT
    DATE(ts.start_time) as work_date,
    ts.user_id,
    COUNT(ts.id) as total_sessions,
    SUM(ts.duration_seconds) as total_seconds,
    ROUND(SUM(ts.duration_seconds) / 60.0, 1) as total_minutes,
    ROUND(SUM(ts.duration_seconds) / 3600.0, 2) as total_hours,
    SUM(CASE WHEN ts.session_type = 'focus' THEN ts.duration_seconds ELSE 0 END) as focus_seconds,
    SUM(CASE WHEN ts.session_type = 'pomodoro' THEN ts.duration_seconds ELSE 0 END) as pomodoro_seconds,
    SUM(CASE WHEN ts.session_type = 'break' THEN ts.duration_seconds ELSE 0 END) as break_seconds
FROM time_sessions ts
WHERE ts.end_time IS NOT NULL
GROUP BY DATE(ts.start_time), ts.user_id;

-- Initialize time fields for existing tasks
UPDATE tasks SET total_time_spent_seconds = 0 WHERE total_time_spent_seconds IS NULL;
