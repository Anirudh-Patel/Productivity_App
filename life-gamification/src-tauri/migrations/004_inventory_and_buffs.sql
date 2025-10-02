-- Migration to add inventory and buffs tables for persistent storage
-- This replaces the in-memory static variables

-- Inventory items for users
CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    item_type TEXT NOT NULL CHECK (item_type IN ('consumable', 'cosmetic', 'upgrade', 'title')),
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    quantity INTEGER DEFAULT 1,
    price INTEGER DEFAULT 0,

    -- Effects (JSON string for flexibility)
    effects JSON,

    -- Cosmetic data
    icon TEXT,
    color TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Active buffs/effects on users
CREATE TABLE IF NOT EXISTS active_buffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    buff_type TEXT NOT NULL CHECK (buff_type IN ('xp_boost', 'gold_boost', 'health_regen', 'stat_boost', 'other')),

    -- Effect values
    effect_value REAL DEFAULT 1.0, -- Multiplier or flat value
    affected_stat TEXT, -- Which stat is affected (if stat_boost)

    -- Duration
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,

    -- Source
    source TEXT, -- What created this buff (item, achievement, etc.)
    source_id INTEGER -- ID of the source item/achievement
);

-- User equipped titles
CREATE TABLE IF NOT EXISTS user_titles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    is_equipped BOOLEAN DEFAULT FALSE,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, title)
);

-- Add equipped_title column to users table if it doesn't exist
-- SQLite doesn't support ALTER TABLE ADD COLUMN IF NOT EXISTS, so we need to check first
-- This will be handled in the Rust code during initialization

-- Task progress tracking for goal-based tasks
CREATE TABLE IF NOT EXISTS task_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    current_progress INTEGER DEFAULT 0,
    target_progress INTEGER NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(task_id)
);

-- Add task_type column to tasks table for different task types
-- This will be handled in Rust code to check if column exists first

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_buffs_user ON active_buffs(user_id);
CREATE INDEX IF NOT EXISTS idx_buffs_expiry ON active_buffs(expires_at);
CREATE INDEX IF NOT EXISTS idx_titles_user ON user_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_task_progress ON task_progress(task_id);

-- Clean up expired buffs trigger
CREATE TRIGGER IF NOT EXISTS cleanup_expired_buffs
AFTER INSERT ON active_buffs
BEGIN
    DELETE FROM active_buffs
    WHERE expires_at < CURRENT_TIMESTAMP;
END;