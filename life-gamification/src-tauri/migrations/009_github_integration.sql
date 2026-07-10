-- Migration 009: GitHub Integration (open issues -> tasks via local gh CLI)

-- Watchlist of repos to sync issues from
CREATE TABLE IF NOT EXISTS github_repos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    owner TEXT NOT NULL,
    name TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    last_synced_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(owner, name)
);

-- Singleton settings row for GitHub sync behavior
CREATE TABLE IF NOT EXISTS github_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    sync_enabled INTEGER NOT NULL DEFAULT 1,
    close_on_complete INTEGER NOT NULL DEFAULT 1,
    last_sync_at DATETIME
);

INSERT OR IGNORE INTO github_settings (id) VALUES (1);

-- Link tasks to GitHub issues
ALTER TABLE tasks ADD COLUMN github_issue_id INTEGER;
ALTER TABLE tasks ADD COLUMN github_repo TEXT; -- "owner/name"
ALTER TABLE tasks ADD COLUMN github_issue_number INTEGER;

-- One task per issue
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_github_issue
    ON tasks(github_repo, github_issue_number)
    WHERE github_repo IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_github_repos_enabled ON github_repos(enabled);
