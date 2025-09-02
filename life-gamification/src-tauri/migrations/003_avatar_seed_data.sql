-- Insert placeholder equipment types
INSERT INTO equipment_types (name, slot, rarity, base_stats, sprite_data) VALUES
-- Head items
('Basic Cap', 'head', 'common', '{"defense": 1}', '{"color": "#8B4513"}'),
('Iron Helm', 'head', 'uncommon', '{"defense": 3}', '{"color": "#C0C0C0"}'),
('Mage Hat', 'head', 'rare', '{"intelligence": 5}', '{"color": "#6A0DAD"}'),
('Dragon Crown', 'head', 'legendary', '{"defense": 10, "strength": 5}', '{"color": "#FFD700", "glow": true}'),

-- Chest items
('Cloth Shirt', 'chest', 'common', '{"defense": 2}', '{"color": "#A0522D"}'),
('Leather Armor', 'chest', 'uncommon', '{"defense": 5}', '{"color": "#8B4513"}'),
('Plate Mail', 'chest', 'rare', '{"defense": 8}', '{"color": "#4682B4"}'),
('Phoenix Robe', 'chest', 'legendary', '{"defense": 12, "intelligence": 8}', '{"color": "#FF4500", "glow": true}'),

-- Leg items
('Basic Pants', 'legs', 'common', '{"defense": 1}', '{"color": "#4169E1"}'),
('Leather Leggings', 'legs', 'uncommon', '{"defense": 4}', '{"color": "#8B4513"}'),
('Chain Leggings', 'legs', 'rare', '{"defense": 6}', '{"color": "#C0C0C0"}'),
('Dragon Scale Pants', 'legs', 'legendary', '{"defense": 10, "endurance": 5}', '{"color": "#228B22", "glow": true}'),

-- Weapon items
('Wooden Stick', 'weapon', 'common', '{"attack": 2}', '{"color": "#8B4513"}'),
('Iron Sword', 'weapon', 'uncommon', '{"attack": 5}', '{"color": "#C0C0C0"}'),
('Magic Staff', 'weapon', 'rare', '{"attack": 7, "intelligence": 3}', '{"color": "#9370DB"}'),
('Excalibur', 'weapon', 'legendary', '{"attack": 15, "strength": 10}', '{"color": "#FFD700", "glow": true}'),

-- Accessory items
('Simple Ring', 'accessory', 'common', '{"luck": 1}', '{"color": "#C0C0C0"}'),
('Magic Amulet', 'accessory', 'uncommon', '{"intelligence": 2}', '{"color": "#4169E1"}'),
('Power Bracelet', 'accessory', 'rare', '{"strength": 3}', '{"color": "#DC143C"}'),
('Legendary Pendant', 'accessory', 'legendary', '{"strength": 5, "intelligence": 5, "luck": 5}', '{"color": "#FFD700", "glow": true}');

-- Create default avatar config for default user
INSERT OR IGNORE INTO avatar_configs (user_id) VALUES (1);

-- Give the default user some starter equipment
INSERT OR IGNORE INTO user_equipment (user_id, equipment_type_id, equipped_slot) VALUES
(1, 1, 'head'),     -- Basic Cap
(1, 5, 'chest'),    -- Cloth Shirt
(1, 9, 'legs'),     -- Basic Pants
(1, 13, 'weapon');  -- Wooden Stick

-- Add some inventory items for the default user
INSERT OR IGNORE INTO user_equipment (user_id, equipment_type_id) VALUES
(1, 2),  -- Iron Helm (in inventory)
(1, 6),  -- Leather Armor (in inventory)
(1, 14), -- Iron Sword (in inventory)
(1, 17); -- Simple Ring (in inventory)