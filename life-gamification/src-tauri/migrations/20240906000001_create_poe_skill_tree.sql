-- POE-Style Skill Tree Implementation
-- Migration for creating massive skill tree with 2,050 nodes

-- Skill tree node definitions
CREATE TABLE skill_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_key TEXT UNIQUE NOT NULL, -- e.g., "STR_001", "INT_SPEC_042"
    name TEXT NOT NULL,
    description TEXT,
    node_type TEXT CHECK (node_type IN ('start', 'regular', 'specialized', 'augmenting')) NOT NULL,
    primary_stat TEXT CHECK (primary_stat IN ('strength', 'intelligence', 'luck', 'aura', 'will')) NOT NULL,
    secondary_stat TEXT CHECK (secondary_stat IN ('strength', 'intelligence', 'luck', 'aura', 'will')), -- For border synergy nodes
    
    -- Position on the skill tree canvas
    x_position REAL NOT NULL,
    y_position REAL NOT NULL,
    
    -- Requirements
    level_requirement INTEGER DEFAULT 1,
    prerequisite_nodes TEXT DEFAULT '[]', -- JSON array of node_keys
    skill_point_cost INTEGER DEFAULT 1,
    
    -- Effects (JSON for flexibility)
    stat_bonuses TEXT DEFAULT '{}', -- JSON: {"strength": 5, "health": 10}
    productivity_effects TEXT DEFAULT '{}', -- JSON: {"task_xp_bonus": 0.05}
    game_effects TEXT DEFAULT '{}', -- JSON: For future game integration
    
    -- Visual properties
    icon_sprite TEXT,
    color_hex TEXT,
    size TEXT DEFAULT 'small' CHECK (size IN ('small', 'medium', 'large', 'massive')),
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User's allocated skill points
CREATE TABLE user_skill_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    node_key TEXT NOT NULL,
    allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (node_key) REFERENCES skill_nodes(node_key) ON DELETE CASCADE,
    UNIQUE(user_id, node_key)
);

-- Skill tree paths for visual connections
CREATE TABLE skill_tree_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_node TEXT NOT NULL,
    to_node TEXT NOT NULL,
    path_type TEXT DEFAULT 'normal' CHECK (path_type IN ('normal', 'synergy', 'hidden')),
    FOREIGN KEY (from_node) REFERENCES skill_nodes(node_key) ON DELETE CASCADE,
    FOREIGN KEY (to_node) REFERENCES skill_nodes(node_key) ON DELETE CASCADE,
    UNIQUE(from_node, to_node)
);

-- User skill tree stats (computed/cached for performance)
CREATE TABLE user_skill_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    total_nodes_allocated INTEGER DEFAULT 0,
    available_skill_points INTEGER DEFAULT 3, -- Starting points
    
    -- Base stats from skill tree
    strength_bonus INTEGER DEFAULT 0,
    intelligence_bonus INTEGER DEFAULT 0,
    luck_bonus INTEGER DEFAULT 0,
    aura_bonus INTEGER DEFAULT 0,
    will_bonus INTEGER DEFAULT 0,
    
    -- Derived stats
    health_bonus INTEGER DEFAULT 0,
    mana_bonus INTEGER DEFAULT 0,
    
    -- Productivity effects (cached for performance)
    task_xp_multiplier REAL DEFAULT 1.0,
    task_completion_bonus REAL DEFAULT 1.0,
    streak_protection_count INTEGER DEFAULT 0,
    
    last_calculated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX idx_skill_nodes_primary_stat ON skill_nodes(primary_stat);
CREATE INDEX idx_skill_nodes_node_type ON skill_nodes(node_type);
CREATE INDEX idx_skill_nodes_position ON skill_nodes(x_position, y_position);
CREATE INDEX idx_user_skill_allocations_user_id ON user_skill_allocations(user_id);
CREATE INDEX idx_user_skill_allocations_node_key ON user_skill_allocations(node_key);
CREATE INDEX idx_skill_tree_connections_from_node ON skill_tree_connections(from_node);
CREATE INDEX idx_skill_tree_connections_to_node ON skill_tree_connections(to_node);

-- Insert starting nodes for each stat
INSERT INTO skill_nodes (node_key, name, description, node_type, primary_stat, x_position, y_position, size, color_hex) VALUES
('STRENGTH_START', 'Strength Origin', 'Starting point for strength-based builds', 'start', 'strength', 1400, 2600, 'large', '#FF6B6B'),
('INTELLIGENCE_START', 'Intelligence Origin', 'Starting point for intelligence-based builds', 'start', 'intelligence', 2000, 1400, 'large', '#4ECDC4'),
('LUCK_START', 'Luck Origin', 'Starting point for luck-based builds', 'start', 'luck', 2600, 2600, 'large', '#FFE066'),
('AURA_START', 'Aura Origin', 'Starting point for aura-based builds', 'start', 'aura', 1400, 1400, 'large', '#9B59B6'),
('WILL_START', 'Will Origin', 'Starting point for will-based builds', 'start', 'will', 2600, 1400, 'large', '#3498DB');

-- Initialize skill stats for all existing users
INSERT INTO user_skill_stats (user_id)
SELECT id FROM users
WHERE id NOT IN (SELECT user_id FROM user_skill_stats);