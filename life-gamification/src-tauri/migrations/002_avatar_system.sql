-- Avatar System Database Schema
-- Equipment type definitions
CREATE TABLE equipment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slot TEXT NOT NULL CHECK (slot IN ('head', 'chest', 'legs', 'weapon', 'accessory')),
    rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    base_stats JSON DEFAULT '{}',
    sprite_data JSON DEFAULT '{}', -- Will store sprite sheet coordinates
    unlock_requirements JSON DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User equipment instances
CREATE TABLE user_equipment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    equipment_type_id INTEGER NOT NULL,
    equipped_slot TEXT, -- NULL if in inventory, slot name if equipped
    custom_name TEXT,
    obtained_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (equipment_type_id) REFERENCES equipment_types(id),
    UNIQUE(user_id, equipped_slot) -- Only one item per slot
);

-- Avatar configurations
CREATE TABLE avatar_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    skin_color TEXT DEFAULT '#F5DEB3',
    hair_color TEXT DEFAULT '#4A4A4A',
    eye_color TEXT DEFAULT '#4A90E2',
    scale REAL DEFAULT 2.0,
    animation_speed INTEGER DEFAULT 8, -- FPS
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_user_equipment_user ON user_equipment(user_id);
CREATE INDEX idx_user_equipment_equipped ON user_equipment(user_id, equipped_slot) 
    WHERE equipped_slot IS NOT NULL;
CREATE INDEX idx_equipment_types_slot ON equipment_types(slot);
CREATE INDEX idx_equipment_types_rarity ON equipment_types(rarity);