-- Initial database schema for Life Quest gamification app
-- Users and character progression
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL DEFAULT 'Player',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    -- Character stats
    level INTEGER DEFAULT 1,
    experience_points INTEGER DEFAULT 0,
    experience_to_next_level INTEGER DEFAULT 100,
    
    -- RPG attributes
    strength INTEGER DEFAULT 10,
    intelligence INTEGER DEFAULT 10,
    endurance INTEGER DEFAULT 10,
    charisma INTEGER DEFAULT 10,
    luck INTEGER DEFAULT 10,
    
    -- Health/energy system
    current_health INTEGER DEFAULT 100,
    max_health INTEGER DEFAULT 100,
    current_energy INTEGER DEFAULT 100,
    max_energy INTEGER DEFAULT 100,
    
    -- Currencies
    gold INTEGER DEFAULT 0,
    gems INTEGER DEFAULT 0,
    
    -- Settings
    theme_preference TEXT DEFAULT 'solo_leveling'
);

-- Tasks/quests system
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    difficulty INTEGER DEFAULT 5 CHECK (difficulty BETWEEN 1 AND 10),
    
    -- Rewards
    base_experience_reward INTEGER DEFAULT 10,
    gold_reward INTEGER DEFAULT 1,
    
    -- Scheduling
    due_date DATETIME,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'archived')),
    priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    energy_cost INTEGER DEFAULT 10,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Achievements system
CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon TEXT DEFAULT '🏆',
    requirements_type TEXT DEFAULT 'task_count', -- task_count, streak, level, etc.
    requirements_value INTEGER DEFAULT 1,
    experience_reward INTEGER DEFAULT 50,
    gold_reward INTEGER DEFAULT 10,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary'))
);

-- User achievements (unlocked achievements)
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

-- Streak tracking
CREATE TABLE IF NOT EXISTS streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE,
    streak_type TEXT NOT NULL DEFAULT 'daily_tasks',
    current_count INTEGER DEFAULT 0,
    longest_count INTEGER DEFAULT 0,
    last_completion_date DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_level ON users(level);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id);

-- Insert default user
INSERT OR IGNORE INTO users (id, username) VALUES (1, 'Adventurer');

-- Insert sample achievements
INSERT OR IGNORE INTO achievements (name, description, requirements_type, requirements_value, experience_reward, gold_reward, rarity) VALUES
('First Steps', 'Complete your first quest', 'task_count', 1, 50, 10, 'common'),
('Getting Started', 'Complete 5 quests', 'task_count', 5, 100, 25, 'common'),
('Dedicated', 'Complete 25 quests', 'task_count', 25, 250, 100, 'uncommon'),
('Achiever', 'Complete 50 quests', 'task_count', 50, 500, 250, 'rare'),
('Legend', 'Complete 100 quests', 'task_count', 100, 1000, 500, 'epic'),
('Week Warrior', 'Maintain a 7-day streak', 'streak', 7, 200, 75, 'uncommon'),
('Level Up', 'Reach level 5', 'level', 5, 300, 150, 'uncommon'),
('Powerhouse', 'Reach level 10', 'level', 10, 750, 400, 'rare');

-- Insert default streak tracker
INSERT OR IGNORE INTO streaks (user_id, streak_type) VALUES (1, 'daily_tasks');

-- Auto-calculation trigger for user level
CREATE TRIGGER IF NOT EXISTS update_user_level 
AFTER UPDATE OF experience_points ON users
BEGIN
    UPDATE users 
    SET 
        level = CAST(1 + (NEW.experience_points / 100) AS INTEGER),
        experience_to_next_level = (100 * (1 + CAST(NEW.experience_points / 100 AS INTEGER))) - NEW.experience_points
    WHERE id = NEW.id;
END;