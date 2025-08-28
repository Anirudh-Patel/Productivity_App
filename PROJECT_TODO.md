# Manhwa-Style Life Gamification App - Project Todo List

## 📋 Project Overview
Building a desktop life gamification app using **Tauri + React + SQLite** with manhwa-inspired aesthetics and RPG mechanics.

---

## Phase 1: Foundation Setup (Week 1)
### Day 1-2: Project Initialization
- [ ] Initialize Tauri + React project with TypeScript template
  ```bash
  npm create tauri-app@latest
  ```
- [ ] Configure TypeScript and ESLint
- [ ] Set up Tailwind CSS
- [ ] Install core dependencies:
  - [ ] `@tauri-apps/api` and `@tauri-apps/plugin-sql`
  - [ ] `zustand` for state management
  - [ ] `framer-motion` for animations
  - [ ] `react-router-dom` for routing
  - [ ] `lucide-react` for icons
  - [ ] `visx` or `recharts` for data visualization
- [ ] Configure Vite build settings
- [ ] Set up project folder structure as specified

### Day 3-4: Database Design
- [ ] Add SQLite integration to Tauri
  ```bash
  npm run tauri add sql
  cd src-tauri && cargo add tauri-plugin-sql --features sqlite
  ```
- [ ] Create database schema with 27 tables:
  - [ ] Users table with character stats
  - [ ] Tasks table with difficulty and rewards
  - [ ] Achievements table with rarity tiers
  - [ ] Streaks tracking table
  - [ ] Task templates table
- [ ] Implement migration system (`001_initial.sql`)
- [ ] Add performance indexes
- [ ] Create seed data for testing
- [ ] Configure SQLite pragmas (WAL mode, memory-mapped I/O)

### Day 5-7: Core Infrastructure
- [ ] Set up Rust backend commands in `src-tauri/src/commands/`
- [ ] Implement database connection layer
- [ ] Create React routing structure
- [ ] Configure Zustand store with slices:
  - [ ] User/character slice
  - [ ] Tasks slice
  - [ ] Achievements slice
  - [ ] UI state slice
- [ ] Set up environment variables (.env files)
- [ ] Configure Git repository and .gitignore

---

## Phase 2: Core Features (Weeks 2-3)

### Week 2: Backend Development
- [ ] **Task Management**
  - [ ] CRUD operations for tasks
  - [ ] Task categories and templates
  - [ ] Difficulty levels (trivial to legendary)
  - [ ] Soft delete implementation
- [ ] **XP & Progression System**
  - [ ] XP calculation with formulas
  - [ ] Level progression curve
  - [ ] Streak multipliers
  - [ ] Time-of-day bonuses
- [ ] **Achievement System**
  - [ ] Achievement unlock logic
  - [ ] JSON-based criteria parsing
  - [ ] Rarity tier implementation
- [ ] **Health & Energy System**
  - [ ] Health point management
  - [ ] Energy regeneration logic
  - [ ] Penalty system for missed tasks

### Week 3: Frontend Components
- [ ] **Layout Components**
  - [ ] Main application shell
  - [ ] Collapsible sidebar navigation
  - [ ] Header with user status
  - [ ] Theme provider wrapper
- [ ] **Dashboard Page**
  - [ ] Character avatar display
  - [ ] XP/Level progress bars
  - [ ] Health/Energy bars
  - [ ] Daily quest overview
  - [ ] Streak display
- [ ] **Task Management UI**
  - [ ] Task list with filters
  - [ ] Task creation modal
  - [ ] Task card component
  - [ ] Quick actions (complete/skip/delete)
- [ ] **Gamification Components**
  - [ ] Animated XP gain display
  - [ ] Level up animation
  - [ ] Achievement unlock notification
  - [ ] Combo multiplier indicator

---

## Phase 3: Integration & Polish (Week 4)

### Day 22-24: System Integration
- [ ] Connect frontend to Rust backend via Tauri commands
- [ ] Implement real-time state synchronization
- [ ] Add data persistence layer
- [ ] Set up error handling and logging

### Day 25-28: Polish & Testing
- [ ] Add loading states and skeletons
- [ ] Implement keyboard shortcuts
- [ ] Add transition animations
- [ ] Write unit tests for critical functions
- [ ] Performance optimization
- [ ] Memory leak checks

---

## Phase 4: Enhanced Features (Weeks 5-6)

### Data Visualization
- [ ] XP progress chart (area chart)
- [ ] Activity heatmap calendar
- [ ] Stats comparison radar chart
- [ ] Habit completion rates
- [ ] Export functionality (CSV/JSON)

### Advanced Gamification
- [ ] Skill tree system
- [ ] Item/reward shop
- [ ] Quest chains
- [ ] Boss battles (major goals)
- [ ] Guild/party system prep

### Theme System
- [ ] Implement theme switcher
- [ ] Create manhwa-inspired themes:
  - [ ] Solo Leveling theme
  - [ ] Second Life Ranker theme
  - [ ] Tower of God theme
- [ ] Dark/light mode toggle
- [ ] Custom color picker

---

## Technical Implementation Details

### Constants & Formulas to Implement
```typescript
// XP Progression
- calculateXPNeeded(level)
- calculateTaskXP(base, difficulty, streak, time)
- getStreakMultiplier(days)
- getTimeMultiplier(hour)

// Difficulty Configuration
- DIFFICULTY_CONFIG (trivial to epic)
- HEALTH_CONFIG (penalties and regeneration)
- ENERGY_CONFIG (regen rates)
```

### Color Palette
- Primary: Warm coral red (#FF6B6B)
- Secondary: Teal turquoise (#4ECDC4)
- Accent: Golden yellow (#FFE066)
- Rarity tiers: Common (white) to Legendary (orange-gold)

### Performance Targets
- App startup: < 2 seconds
- Database queries: < 50ms simple, < 200ms complex
- Memory usage: < 100MB baseline
- UI interactions: < 100ms response
- Animations: Maintain 60fps

---

## Development Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "test": "vitest",
    "lint": "eslint src --ext ts,tsx"
  }
}
```

---

## MVP Checklist (4 weeks)
- [ ] ✅ Basic task management with CRUD
- [ ] ✅ XP and level progression system
- [ ] ✅ Simple achievements (first task, streaks)
- [ ] ✅ Dashboard with character stats
- [ ] ✅ Theme switching (at least 2 themes)

## Should-Have Features (2 weeks)
- [ ] ⭐ Streak tracking with protected days
- [ ] ⭐ Data visualization charts
- [ ] ⭐ Task templates library
- [ ] ⭐ CSV/JSON export functionality

## Nice-to-Have Features (Future)
- [ ] 🎯 Social features and leaderboards
- [ ] 🎯 Cloud sync capability
- [ ] 🎯 Advanced analytics dashboard
- [ ] 🎯 Plugin system for extensions
- [ ] 🎯 Mobile companion app

---

## Testing Checklist
- [ ] Unit tests for XP calculations
- [ ] Unit tests for streak logic
- [ ] Integration tests for database operations
- [ ] E2E tests for critical user flows
- [ ] Performance benchmarking
- [ ] Cross-platform testing (Windows/Mac/Linux)

---

## Documentation
- [ ] README with setup instructions
- [ ] API documentation for Tauri commands
- [ ] Component documentation
- [ ] User guide for gamification features

---

## Notes & References
- **Tech Stack**: Tauri 2.0 + React 18 + SQLite + Zustand
- **UI Library**: Consider Mantine v7+ or Hero UI
- **Inspiration**: Solo Leveling, Second Life Ranker, Tower of God
- **Target**: Desktop-first, offline-capable, 60fps animations

---

## Current Status
🚀 **Phase**: Project Setup
📅 **Started**: Today
🎯 **Next Step**: Initialize Tauri project and configure development environment