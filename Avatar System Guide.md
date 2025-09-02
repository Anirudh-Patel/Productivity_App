# Pixel Art Avatar System Implementation Guide for Claude Code

## Overview
This guide provides step-by-step instructions for implementing a complete modular pixel art avatar system using placeholder graphics. The system is designed to be built entirely within Claude Code, with real assets to be integrated later.

## System Architecture Summary
- **Rendering**: Canvas-based layered system with z-index management
- **State**: Zustand store for equipment and character management
- **Database**: SQLite for equipment inventory and user avatars
- **Animation**: Frame-based state machine at 8 FPS
- **Performance Target**: 60 FPS with 10+ layers

## Phase 1: Database Schema Setup

### 1.1 Create Migration File
Create `src-tauri/migrations/002_avatar_system.sql`:

```sql
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
```

### 1.2 Seed Placeholder Equipment
Create `src-tauri/migrations/003_avatar_seed_data.sql`:

```sql
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

-- Weapon items
('Wooden Stick', 'weapon', 'common', '{"attack": 2}', '{"color": "#8B4513"}'),
('Iron Sword', 'weapon', 'uncommon', '{"attack": 5}', '{"color": "#C0C0C0"}'),
('Magic Staff', 'weapon', 'rare', '{"attack": 7, "intelligence": 3}', '{"color": "#9370DB"}'),
('Excalibur', 'weapon', 'legendary', '{"attack": 15, "strength": 10}', '{"color": "#FFD700", "glow": true}');
```

## Phase 2: Tauri Backend Commands

### 2.1 Create Avatar Commands
Create `src-tauri/src/commands/avatar.rs`:

```rust
use serde::{Deserialize, Serialize};
use tauri::State;
use crate::database::DbConnection;

#[derive(Debug, Serialize, Deserialize)]
pub struct Equipment {
    id: i32,
    name: String,
    slot: String,
    rarity: String,
    sprite_data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AvatarConfig {
    skin_color: String,
    hair_color: String,
    eye_color: String,
    scale: f32,
    animation_speed: i32,
}

#[tauri::command]
pub async fn get_user_equipment(
    user_id: i32,
    db: State<'_, DbConnection>
) -> Result<Vec<Equipment>, String> {
    // Implementation to fetch user's equipment
    Ok(vec![])
}

#[tauri::command]
pub async fn equip_item(
    user_id: i32,
    item_id: i32,
    slot: String,
    db: State<'_, DbConnection>
) -> Result<(), String> {
    // Implementation to equip an item
    Ok(())
}

#[tauri::command]
pub async fn unequip_item(
    user_id: i32,
    slot: String,
    db: State<'_, DbConnection>
) -> Result<(), String> {
    // Implementation to unequip an item
    Ok(())
}

#[tauri::command]
pub async fn get_avatar_config(
    user_id: i32,
    db: State<'_, DbConnection>
) -> Result<AvatarConfig, String> {
    // Implementation to get avatar configuration
    Ok(AvatarConfig {
        skin_color: "#F5DEB3".to_string(),
        hair_color: "#4A4A4A".to_string(),
        eye_color: "#4A90E2".to_string(),
        scale: 2.0,
        animation_speed: 8,
    })
}
```

### 2.2 Register Commands
Update `src-tauri/src/main.rs`:

```rust
mod commands;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // ... existing commands
            commands::avatar::get_user_equipment,
            commands::avatar::equip_item,
            commands::avatar::unequip_item,
            commands::avatar::get_avatar_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Phase 3: React Component Structure

### 3.1 Create Avatar Store
Create `src/store/slices/avatarSlice.ts`:

```typescript
import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

interface Equipment {
  id: number;
  name: string;
  slot: 'head' | 'chest' | 'legs' | 'weapon' | 'accessory';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  spriteData: {
    color: string;
    glow?: boolean;
  };
}

interface AvatarState {
  equipped: {
    head: Equipment | null;
    chest: Equipment | null;
    legs: Equipment | null;
    weapon: Equipment | null;
    accessory: Equipment | null;
  };
  inventory: Equipment[];
  config: {
    skinColor: string;
    hairColor: string;
    eyeColor: string;
    scale: number;
    animationSpeed: number;
  };
  currentAnimation: 'idle' | 'walk' | 'attack' | 'jump';
  animationFrame: number;
  
  // Actions
  loadUserEquipment: (userId: number) => Promise<void>;
  equipItem: (item: Equipment) => Promise<void>;
  unequipItem: (slot: string) => Promise<void>;
  setAnimation: (animation: string) => void;
  nextFrame: () => void;
}

export const useAvatarStore = create<AvatarState>((set, get) => ({
  equipped: {
    head: null,
    chest: null,
    legs: null,
    weapon: null,
    accessory: null,
  },
  inventory: [],
  config: {
    skinColor: '#F5DEB3',
    hairColor: '#4A4A4A',
    eyeColor: '#4A90E2',
    scale: 2,
    animationSpeed: 8,
  },
  currentAnimation: 'idle',
  animationFrame: 0,

  loadUserEquipment: async (userId) => {
    try {
      const equipment = await invoke('get_user_equipment', { userId });
      // Process and set equipment
    } catch (error) {
      console.error('Failed to load equipment:', error);
    }
  },

  equipItem: async (item) => {
    const { equipped } = get();
    // Unequip existing item in slot if present
    if (equipped[item.slot]) {
      await get().unequipItem(item.slot);
    }
    
    set((state) => ({
      equipped: { ...state.equipped, [item.slot]: item },
      inventory: state.inventory.filter(i => i.id !== item.id)
    }));
    
    // Call Tauri command to persist
    await invoke('equip_item', { itemId: item.id, slot: item.slot });
  },

  unequipItem: async (slot) => {
    const { equipped } = get();
    const item = equipped[slot];
    if (!item) return;
    
    set((state) => ({
      equipped: { ...state.equipped, [slot]: null },
      inventory: [...state.inventory, item]
    }));
    
    await invoke('unequip_item', { slot });
  },

  setAnimation: (animation) => {
    set({ currentAnimation: animation, animationFrame: 0 });
  },

  nextFrame: () => {
    set((state) => ({
      animationFrame: (state.animationFrame + 1) % 4 // 4 frames per animation
    }));
  },
}));
```

### 3.2 Create Layered Canvas Renderer
Create `src/features/avatar/components/AvatarCanvas/AvatarCanvas.tsx`:

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useAvatarStore } from '@/store/slices/avatarSlice';

interface Layer {
  zIndex: number;
  name: string;
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void;
}

const LAYER_ORDER = {
  BACKGROUND: 1,
  SHADOW: 5,
  BASE: 10,
  LEGS: 15,
  CHEST: 20,
  HEAD: 25,
  WEAPON: 30,
  EFFECTS: 40,
};

const RARITY_COLORS = {
  common: { primary: '#808080', glow: null },
  uncommon: { primary: '#1EFF00', glow: null },
  rare: { primary: '#0070DD', glow: 'rgba(0, 112, 221, 0.3)' },
  epic: { primary: '#A335EE', glow: 'rgba(163, 53, 238, 0.4)' },
  legendary: { primary: '#FF8000', glow: 'rgba(255, 128, 0, 0.5)' },
};

export const AvatarCanvas: React.FC<{
  width?: number;
  height?: number;
  zoom?: number;
}> = ({ width = 128, height = 128, zoom = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { equipped, config, currentAnimation, animationFrame, nextFrame } = useAvatarStore();

  // Draw placeholder shapes for equipment
  const drawPlaceholderItem = (
    ctx: CanvasRenderingContext2D,
    slot: string,
    equipment: any,
    x: number,
    y: number,
    size: number
  ) => {
    if (!equipment) return;

    const rarityColor = RARITY_COLORS[equipment.rarity];
    
    // Draw glow effect for rare+ items
    if (rarityColor.glow) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = rarityColor.glow;
    }

    ctx.fillStyle = equipment.spriteData.color || rarityColor.primary;

    switch (slot) {
      case 'head':
        // Draw circle for head items
        ctx.beginPath();
        ctx.arc(x + size/2, y + size/4, size/4, 0, Math.PI * 2);
        ctx.fill();
        break;
      
      case 'chest':
        // Draw rectangle for chest
        ctx.fillRect(x + size/4, y + size/3, size/2, size/3);
        break;
      
      case 'weapon':
        // Draw elongated rectangle for weapon
        ctx.save();
        ctx.translate(x + size * 0.8, y + size/2);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-size/8, -size/2, size/4, size);
        ctx.restore();
        break;
      
      case 'legs':
        // Draw two rectangles for legs
        ctx.fillRect(x + size/3 - 5, y + size * 0.6, size/6, size/3);
        ctx.fillRect(x + size/2 + 5, y + size * 0.6, size/6, size/3);
        break;
    }

    ctx.shadowBlur = 0;
  };

  // Draw base character
  const drawCharacterBase = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    // Body
    ctx.fillStyle = config.skinColor;
    ctx.fillRect(x + size/3, y + size/3, size/3, size/3);
    
    // Head
    ctx.beginPath();
    ctx.arc(x + size/2, y + size/4, size/5, 0, Math.PI * 2);
    ctx.fill();
    
    // Eyes
    ctx.fillStyle = config.eyeColor;
    ctx.fillRect(x + size/2 - 10, y + size/4 - 5, 5, 5);
    ctx.fillRect(x + size/2 + 5, y + size/4 - 5, 5, 5);
    
    // Legs (if no leg equipment)
    if (!equipped.legs) {
      ctx.fillStyle = '#4169E1'; // Default pants color
      ctx.fillRect(x + size/3, y + size * 0.6, size/6, size/3);
      ctx.fillRect(x + size/2, y + size * 0.6, size/6, size/3);
    }
  };

  // Main render loop
  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Enable pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;
    
    // Apply zoom
    ctx.save();
    ctx.scale(zoom, zoom);
    
    const centerX = (width / zoom - 64) / 2;
    const centerY = (height / zoom - 64) / 2;
    
    // Draw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(centerX + 32, centerY + 60, 20, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw character base
    drawCharacterBase(ctx, centerX, centerY, 64);
    
    // Draw equipment layers
    if (equipped.legs) {
      drawPlaceholderItem(ctx, 'legs', equipped.legs, centerX, centerY, 64);
    }
    if (equipped.chest) {
      drawPlaceholderItem(ctx, 'chest', equipped.chest, centerX, centerY, 64);
    }
    if (equipped.head) {
      drawPlaceholderItem(ctx, 'head', equipped.head, centerX, centerY, 64);
    }
    if (equipped.weapon) {
      drawPlaceholderItem(ctx, 'weapon', equipped.weapon, centerX, centerY, 64);
    }
    
    // Add animation offset based on current animation
    if (currentAnimation === 'walk') {
      const bobAmount = Math.sin(animationFrame * Math.PI / 2) * 2;
      ctx.translate(0, bobAmount);
    }
    
    ctx.restore();
  };

  // Animation loop
  useEffect(() => {
    let lastTime = 0;
    const fps = config.animationSpeed;
    const frameInterval = 1000 / fps;

    const animate = (currentTime: number) => {
      const deltaTime = currentTime - lastTime;

      if (deltaTime >= frameInterval) {
        nextFrame();
        render();
        lastTime = currentTime;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [equipped, config, currentAnimation, animationFrame]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="pixelated"
      style={{
        imageRendering: 'pixelated',
        imageRendering: '-moz-crisp-edges',
        imageRendering: 'crisp-edges',
        width: width * zoom,
        height: height * zoom,
      }}
    />
  );
};
```

### 3.3 Create Equipment Manager UI
Create `src/features/avatar/components/EquipmentPanel/EquipmentPanel.tsx`:

```tsx
import React from 'react';
import { useAvatarStore } from '@/store/slices/avatarSlice';
import { motion } from 'framer-motion';

const SLOT_NAMES = {
  head: 'Head',
  chest: 'Chest',
  legs: 'Legs',
  weapon: 'Weapon',
  accessory: 'Accessory',
};

export const EquipmentPanel: React.FC = () => {
  const { equipped, inventory, equipItem, unequipItem } = useAvatarStore();

  const handleSlotClick = (slot: string) => {
    if (equipped[slot]) {
      unequipItem(slot);
    }
  };

  const handleInventoryItemClick = (item: any) => {
    equipItem(item);
  };

  return (
    <div className="flex gap-4">
      {/* Equipped Items */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white mb-3">Equipped</h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(SLOT_NAMES).map(([slot, name]) => (
            <motion.div
              key={slot}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => handleSlotClick(slot)}
              className={`
                w-16 h-16 border-2 rounded cursor-pointer
                flex items-center justify-center
                ${equipped[slot] 
                  ? `border-${equipped[slot].rarity} bg-gray-700` 
                  : 'border-gray-600 bg-gray-900'}
              `}
            >
              {equipped[slot] ? (
                <div 
                  className="w-12 h-12 rounded"
                  style={{ backgroundColor: equipped[slot].spriteData.color }}
                />
              ) : (
                <span className="text-gray-500 text-xs">{name}</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Inventory */}
      <div className="bg-gray-800 rounded-lg p-4 flex-1">
        <h3 className="text-white mb-3">Inventory</h3>
        <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
          {inventory.map((item) => (
            <motion.div
              key={item.id}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleInventoryItemClick(item)}
              className={`
                w-12 h-12 border-2 rounded cursor-pointer
                border-${item.rarity} bg-gray-700
                flex items-center justify-center
              `}
              title={item.name}
            >
              <div 
                className="w-10 h-10 rounded"
                style={{ backgroundColor: item.spriteData.color }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### 3.4 Create Main Avatar Display Component
Create `src/features/avatar/components/AvatarDisplay/AvatarDisplay.tsx`:

```tsx
import React, { useState } from 'react';
import { AvatarCanvas } from '../AvatarCanvas/AvatarCanvas';
import { EquipmentPanel } from '../EquipmentPanel/EquipmentPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { Maximize2, Minimize2 } from 'lucide-react';

export const AvatarDisplay: React.FC<{
  showEquipment?: boolean;
  compact?: boolean;
}> = ({ showEquipment = true, compact = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(2);

  const handleZoomChange = (value: number) => {
    setCurrentZoom(value);
  };

  if (compact) {
    // Small version for dashboard
    return (
      <motion.div 
        className="relative"
        whileHover={{ scale: 1.05 }}
        onClick={() => setIsExpanded(true)}
      >
        <AvatarCanvas width={64} height={64} zoom={1} />
      </motion.div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Avatar Display */}
        <div className="bg-gray-900 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Character</h2>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-400 hover:text-white"
            >
              {isExpanded ? <Minimize2 /> : <Maximize2 />}
            </button>
          </div>
          
          <div className="flex justify-center">
            <AvatarCanvas 
              width={128} 
              height={128} 
              zoom={currentZoom} 
            />
          </div>

          {/* Zoom Controls */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <label className="text-gray-400 text-sm">Zoom:</label>
            <input
              type="range"
              min="1"
              max="4"
              step="0.5"
              value={currentZoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="w-32"
            />
            <span className="text-gray-400 text-sm">{currentZoom}x</span>
          </div>
        </div>

        {/* Equipment Panel */}
        {showEquipment && <EquipmentPanel />}
      </div>

      {/* Expanded Modal */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
            onClick={() => setIsExpanded(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 rounded-lg p-8"
            >
              <AvatarCanvas width={256} height={256} zoom={2} />
              <button
                onClick={() => setIsExpanded(false)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
```

## Phase 4: Integration Points

### 4.1 Add to Dashboard
Update `src/pages/Dashboard/Dashboard.tsx`:

```tsx
import { AvatarDisplay } from '@/features/avatar/components/AvatarDisplay/AvatarDisplay';

// In your dashboard component, add:
<div className="avatar-widget">
  <AvatarDisplay compact={true} showEquipment={false} />
</div>
```

### 4.2 Create Dedicated Avatar Page
Create `src/pages/Avatar/Avatar.tsx`:

```tsx
import React, { useEffect } from 'react';
import { AvatarDisplay } from '@/features/avatar/components/AvatarDisplay/AvatarDisplay';
import { useAvatarStore } from '@/store/slices/avatarSlice';
import { useGameStore } from '@/store/gameStore';

export const AvatarPage: React.FC = () => {
  const { loadUserEquipment } = useAvatarStore();
  const { user } = useGameStore();

  useEffect(() => {
    if (user?.id) {
      loadUserEquipment(user.id);
    }
  }, [user?.id]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-white mb-6">Character Customization</h1>
      <AvatarDisplay showEquipment={true} compact={false} />
    </div>
  );
};
```

### 4.3 Add Route
Update `src/App.tsx`:

```tsx
import { AvatarPage } from '@/pages/Avatar/Avatar';

// Add to routes:
<Route path="/avatar" element={<AvatarPage />} />
```

## Phase 5: Performance Optimizations

### 5.1 Add CSS for Pixel Perfect Rendering
Create `src/features/avatar/styles/avatar.css`:

```css
.pixelated {
  image-rendering: -moz-crisp-edges;
  image-rendering: -webkit-crisp-edges;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  -ms-interpolation-mode: nearest-neighbor;
}

.avatar-container {
  position: relative;
}

.avatar-layer {
  position: absolute;
  top: 0;
  left: 0;
}

/* Rarity border colors */
.border-common { border-color: #808080; }
.border-uncommon { border-color: #1EFF00; }
.border-rare { border-color: #0070DD; }
.border-epic { border-color: #A335EE; }
.border-legendary { 
  border-color: #FF8000;
  animation: legendary-glow 2s ease-in-out infinite;
}

@keyframes legendary-glow {
  0%, 100% { box-shadow: 0 0 5px #FF8000; }
  50% { box-shadow: 0 0 20px #FF8000, 0 0 30px #FF8000; }
}
```

### 5.2 Add Mock Data Generator
Create `src/features/avatar/utils/mockData.ts`:

```typescript
export const generateMockInventory = () => {
  const items = [];
  const slots = ['head', 'chest', 'legs', 'weapon'];
  const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  
  for (let i = 0; i < 20; i++) {
    items.push({
      id: i + 1,
      name: `Item ${i + 1}`,
      slot: slots[Math.floor(Math.random() * slots.length)],
      rarity: rarities[Math.floor(Math.random() * rarities.length)],
      spriteData: {
        color: `#${Math.floor(Math.random()*16777215).toString(16)}`,
        glow: Math.random() > 0.7
      }
    });
  }
  
  return items;
};

// Use this to populate the store for testing:
// const mockItems = generateMockInventory();
// set({ inventory: mockItems });
```

## Phase 6: Testing Checklist

### 6.1 Core Functionality Tests
- [ ] Canvas renders correctly at different zoom levels
- [ ] Equipment equips/unequips properly
- [ ] Layers render in correct z-order
- [ ] Animation states transition smoothly
- [ ] Database operations persist correctly
- [ ] Performance maintains 60 FPS with all layers

### 6.2 Performance Benchmarks
- [ ] Initial render: < 16ms
- [ ] Equipment change: < 10ms
- [ ] Animation frame: < 8ms (for 120 FPS headroom)
- [ ] Memory usage: < 50MB for avatar system
- [ ] Database queries: < 5ms

### 6.3 Edge Cases
- [ ] Empty equipment slots render correctly
- [ ] Switching between items in same slot
- [ ] Rapid equipment changes
- [ ] Different screen resolutions
- [ ] Multiple avatars on screen

## Phase 7: Preparing for Real Assets

### 7.1 Asset Integration Points
When ready to add real pixel art assets, you'll need to:

1. **Replace color fills with sprite rendering**:
```typescript
// Current placeholder:
ctx.fillStyle = equipment.spriteData.color;
ctx.fillRect(x, y, width, height);

// Future sprite rendering:
const sprite = await loadSprite(equipment.spriteData.path);
ctx.drawImage(
  sprite,
  equipment.spriteData.frameX,
  equipment.spriteData.frameY,
  equipment.spriteData.width,
  equipment.spriteData.height,
  x, y, width * scale, height * scale
);
```

2. **Update database schema** to include sprite sheet coordinates
3. **Implement sprite sheet loader** with caching
4. **Add animation frame data** for each equipment piece

### 7.2 Asset Pipeline Preparation
Create placeholder directories:
```
src/assets/
  sprites/
    characters/
      base/
    equipment/
      head/
      chest/
      legs/
      weapons/
    effects/
      particles/
      glows/
```

## Troubleshooting Guide

### Common Issues and Solutions

**Issue: Canvas appears blurry**
- Ensure `imageSmoothingEnabled = false`
- Check CSS has `image-rendering: pixelated`
- Verify canvas dimensions match display size

**Issue: Performance drops with multiple layers**
- Use offscreen canvas for static layers
- Implement dirty rectangle optimization
- Cache composed frames

**Issue: Equipment doesn't persist**
- Check Tauri commands are properly invoked
- Verify database migrations ran successfully
- Ensure user_id is passed correctly

**Issue: Animation stutters**
- Use requestAnimationFrame consistently
- Avoid state updates during render
- Profile with Chrome DevTools Performance tab

## Notes for Claude Code

### Important Implementation Details
1. **Always use placeholder shapes** for now - simple rectangles and circles with colors
2. **Focus on the system architecture** - the rendering pipeline is more important than visuals
3. **Test with mock data** - use the generator function to create test inventory
4. **Keep performance in mind** - target 60 FPS even with placeholders
5. **Database schema is complete** - migrations are ready for real implementation

### What NOT to Implement Yet
- Real sprite loading
- Image file handling
- Sprite sheet generation
- Particle effects (save for tsParticles integration)
- Complex animations beyond basic states

### Success Criteria
The system is ready when:
- Equipment can be equipped/unequipped with visual feedback
- Layers render in correct order
- Zoom functionality works smoothly
- Database persists all changes
- Performance metrics are met
- Code structure supports easy asset integration later

This guide provides everything needed to build a complete, working avatar system with placeholders that can easily accept real pixel art assets when ready.