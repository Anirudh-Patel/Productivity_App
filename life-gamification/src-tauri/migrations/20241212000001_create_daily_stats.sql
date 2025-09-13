-- Create daily_stats table to track daily performance metrics
CREATE TABLE daily_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    tasks_completed INTEGER DEFAULT 0,
    xp_earned INTEGER DEFAULT 0,
    gold_earned INTEGER DEFAULT 0,
    productivity_score REAL DEFAULT 0.0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    UNIQUE(user_id, date)
);

-- Create an index for faster lookups
CREATE INDEX idx_daily_stats_user_date ON daily_stats(user_id, date);