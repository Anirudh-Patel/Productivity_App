-- Unlocked cosmetic/story content earned from the variable reward system
-- (manhwa pages, character skins, secret chapters, etc.)
CREATE TABLE IF NOT EXISTS unlocked_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    content_type TEXT NOT NULL,
    content_id TEXT NOT NULL,
    name TEXT,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_content_user ON unlocked_content(user_id);
