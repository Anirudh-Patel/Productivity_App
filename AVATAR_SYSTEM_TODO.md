# Avatar System Implementation Todo

## Overview
Implementation of a complete modular pixel art avatar system with placeholder graphics, following the Avatar System Guide. The system uses canvas-based layered rendering, Zustand state management, SQLite database, and frame-based animations at 8 FPS targeting 60 FPS performance.

## Phase 1: Database Schema Setup ⏳
**Status: In Progress**

### Tasks:
- [ ] Create `src-tauri/migrations/002_avatar_system.sql` with equipment tables
- [ ] Create `src-tauri/migrations/003_avatar_seed_data.sql` with placeholder equipment
- [ ] Test migrations run successfully
- [ ] Verify database schema with sample queries

**Tables to create:**
- `equipment_types` - Equipment definitions with stats and sprite data
- `user_equipment` - User's equipment instances and equipped items  
- `avatar_configs` - User avatar customization settings

## Phase 2: Tauri Backend Commands 📋
**Status: Pending**

### Tasks:
- [ ] Create `src-tauri/src/commands/avatar.rs`
- [ ] Implement `get_user_equipment()` command
- [ ] Implement `equip_item()` command  
- [ ] Implement `unequip_item()` command
- [ ] Implement `get_avatar_config()` command
- [ ] Register commands in `main.rs`
- [ ] Test commands via Tauri API

## Phase 3: React Avatar Store and Canvas Renderer 🎨
**Status: Pending**

### Tasks:
- [ ] Create `src/store/slices/avatarSlice.ts` with Zustand
- [ ] Implement equipment state management
- [ ] Create `src/features/avatar/components/AvatarCanvas/AvatarCanvas.tsx`
- [ ] Implement layered canvas rendering system
- [ ] Add placeholder equipment drawing functions
- [ ] Implement animation frame system (8 FPS)
- [ ] Add zoom and scaling functionality

**Key Components:**
- Avatar state store with equipped items and inventory
- Canvas renderer with z-index layer management
- Animation state machine (idle, walk, attack, jump)
- Placeholder graphics using colored shapes

## Phase 4: Equipment Management UI 🎮
**Status: Pending**

### Tasks:
- [ ] Create `src/features/avatar/components/EquipmentPanel/EquipmentPanel.tsx`
- [ ] Build equipped items grid (2x3 layout)
- [ ] Build inventory grid with scroll
- [ ] Add drag & drop or click interactions
- [ ] Implement rarity border colors and effects
- [ ] Create `src/features/avatar/components/AvatarDisplay/AvatarDisplay.tsx`
- [ ] Add zoom controls and expanded modal view

**UI Features:**
- Equipment slots: Head, Chest, Legs, Weapon, Accessory
- Inventory management with rarity color coding
- Zoom controls (1x to 4x)
- Expandable modal for full-screen avatar view

## Phase 5: Integration Points 🔧
**Status: Pending**

### Tasks:
- [ ] Add compact avatar widget to Dashboard
- [ ] Create dedicated Avatar page (`src/pages/Avatar/Avatar.tsx`)
- [ ] Add Avatar route to App.tsx
- [ ] Update navigation/sidebar with Avatar link
- [ ] Integrate with existing game store for user data

**Integration Points:**
- Dashboard: Compact avatar display
- New Avatar page: Full equipment management
- Navigation: Avatar menu item
- Cross-store data sharing

## Phase 6: Performance Optimizations and Styling 🚀
**Status: Pending**

### Tasks:
- [ ] Create `src/features/avatar/styles/avatar.css`
- [ ] Add pixel-perfect rendering CSS
- [ ] Implement rarity border animations (legendary glow)
- [ ] Add mock data generator (`src/features/avatar/utils/mockData.ts`)
- [ ] Optimize canvas rendering for 60 FPS
- [ ] Add performance monitoring hooks

**Performance Targets:**
- Initial render: < 16ms
- Equipment change: < 10ms  
- Animation frame: < 8ms
- Memory usage: < 50MB
- Database queries: < 5ms

## Phase 7: Testing and Validation ✅
**Status: Pending**

### Functionality Tests:
- [ ] Canvas renders correctly at different zoom levels
- [ ] Equipment equips/unequips properly  
- [ ] Layers render in correct z-order
- [ ] Animation states transition smoothly
- [ ] Database operations persist correctly
- [ ] Performance maintains 60 FPS with all layers

### Edge Case Tests:
- [ ] Empty equipment slots render correctly
- [ ] Switching between items in same slot
- [ ] Rapid equipment changes
- [ ] Different screen resolutions
- [ ] Multiple avatars on screen

## Implementation Notes

### Current Scope (Placeholders Only):
- Simple colored rectangles and circles for equipment
- Focus on system architecture over visuals
- Mock data for testing inventory
- Database schema ready for real assets

### Future Asset Integration:
- Replace color fills with sprite rendering
- Update database with sprite sheet coordinates  
- Implement sprite sheet loader with caching
- Add animation frame data per equipment piece

### Success Criteria:
✅ Equipment can be equipped/unequipped with visual feedback  
✅ Layers render in correct order  
✅ Zoom functionality works smoothly  
✅ Database persists all changes  
✅ Performance metrics are met  
✅ Code structure supports easy asset integration later  

---
**Created:** 2025-09-02  
**Based on:** Avatar System Guide.md  
**Branch:** feature/avatar-system