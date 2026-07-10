-- Migration 006: Projects and Task Grouping System
-- Adds project management functionality for organizing tasks

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#3B82F6', -- Hex color code for UI
    icon TEXT DEFAULT '📁', -- Emoji icon

    -- Status and tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    due_date DATETIME,
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),

    -- Progress tracking (computed from tasks)
    total_tasks INTEGER DEFAULT 0,
    completed_tasks INTEGER DEFAULT 0,
    total_xp_earned INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    UNIQUE(user_id, name) -- Prevent duplicate project names per user
);

-- Add project_id column to tasks table
ALTER TABLE tasks ADD COLUMN project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_status ON projects(user_id, status);

-- Insert default projects as examples
INSERT OR IGNORE INTO projects (id, user_id, name, description, color, icon, status, priority) VALUES
(1, 1, 'Personal Development', 'Self-improvement and learning goals', '#8B5CF6', '🌱', 'active', 4),
(2, 1, 'Work & Career', 'Professional tasks and career growth', '#3B82F6', '💼', 'active', 5),
(3, 1, 'Health & Fitness', 'Physical and mental wellness', '#10B981', '🏃', 'active', 4),
(4, 1, 'Side Projects', 'Creative and hobby projects', '#F59E0B', '🎨', 'active', 3);

-- Create trigger to update project stats when tasks change
CREATE TRIGGER IF NOT EXISTS update_project_stats_on_task_complete
AFTER UPDATE OF status ON tasks
WHEN NEW.project_id IS NOT NULL AND NEW.status = 'completed' AND OLD.status != 'completed'
BEGIN
    UPDATE projects
    SET
        completed_tasks = (
            SELECT COUNT(*) FROM tasks
            WHERE project_id = NEW.project_id AND status = 'completed'
        ),
        total_tasks = (
            SELECT COUNT(*) FROM tasks
            WHERE project_id = NEW.project_id
        ),
        total_xp_earned = (
            SELECT COALESCE(SUM(base_experience_reward), 0) FROM tasks
            WHERE project_id = NEW.project_id AND status = 'completed'
        )
    WHERE id = NEW.project_id;
END;

-- Create trigger to update project stats when new task is added
CREATE TRIGGER IF NOT EXISTS update_project_stats_on_task_insert
AFTER INSERT ON tasks
WHEN NEW.project_id IS NOT NULL
BEGIN
    UPDATE projects
    SET
        total_tasks = (
            SELECT COUNT(*) FROM tasks
            WHERE project_id = NEW.project_id
        )
    WHERE id = NEW.project_id;
END;

-- Create trigger to update project stats when task is deleted
CREATE TRIGGER IF NOT EXISTS update_project_stats_on_task_delete
AFTER DELETE ON tasks
WHEN OLD.project_id IS NOT NULL
BEGIN
    UPDATE projects
    SET
        completed_tasks = (
            SELECT COUNT(*) FROM tasks
            WHERE project_id = OLD.project_id AND status = 'completed'
        ),
        total_tasks = (
            SELECT COUNT(*) FROM tasks
            WHERE project_id = OLD.project_id
        ),
        total_xp_earned = (
            SELECT COALESCE(SUM(base_experience_reward), 0) FROM tasks
            WHERE project_id = OLD.project_id AND status = 'completed'
        )
    WHERE id = OLD.project_id;
END;

-- Create trigger to auto-complete project when all tasks are done
CREATE TRIGGER IF NOT EXISTS auto_complete_project
AFTER UPDATE OF status ON tasks
WHEN NEW.project_id IS NOT NULL AND NEW.status = 'completed'
BEGIN
    UPDATE projects
    SET
        status = 'completed',
        completed_at = CURRENT_TIMESTAMP
    WHERE
        id = NEW.project_id
        AND status = 'active'
        AND total_tasks > 0
        AND completed_tasks = total_tasks;
END;
