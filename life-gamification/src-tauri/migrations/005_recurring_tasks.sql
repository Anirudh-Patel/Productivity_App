-- Migration 005: Enhanced Recurring Tasks System
-- Adds fields for recurring tasks, instances, and streak tracking

-- Add recurring task fields to tasks table
ALTER TABLE tasks ADD COLUMN recurrence_pattern TEXT; -- JSON field for recurrence pattern
ALTER TABLE tasks ADD COLUMN parent_recurring_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE; -- Links instances to parent
ALTER TABLE tasks ADD COLUMN instance_date DATE; -- Date this instance is for
ALTER TABLE tasks ADD COLUMN current_streak INTEGER DEFAULT 0; -- Current consecutive completions
ALTER TABLE tasks ADD COLUMN longest_streak INTEGER DEFAULT 0; -- Best streak ever
ALTER TABLE tasks ADD COLUMN last_completed_date DATE; -- Last date this task was completed
ALTER TABLE tasks ADD COLUMN streak_bonus_multiplier REAL DEFAULT 1.0; -- XP multiplier from streaks

-- Create table for tracking which recurring task instances have been generated
CREATE TABLE IF NOT EXISTS recurring_task_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recurring_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    instance_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    instance_date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(recurring_task_id, instance_date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON tasks(parent_recurring_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_instance_date ON tasks(instance_date);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_task ON recurring_task_instances(recurring_task_id);
CREATE INDEX IF NOT EXISTS idx_recurring_instances_date ON recurring_task_instances(instance_date);

-- Update existing recurring tasks to have default values
UPDATE tasks SET current_streak = 0, longest_streak = 0, streak_bonus_multiplier = 1.0
WHERE current_streak IS NULL;
