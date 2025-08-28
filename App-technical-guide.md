# Complete Technical Specification for Manhwa-Style Life Gamification Desktop App

## Executive summary

This specification provides a complete technical blueprint for building a manhwa-style life gamification personal project using **Tauri + React + SQLite**. The architecture combines a high-performance Rust backend with modern React frontend, optimized for desktop deployment with gaming aesthetics inspired by popular manhwa series like Solo Leveling and Second Life Ranker. The project emphasizes modular design, real-time performance, and engaging gamification mechanics.

## 1. Project setup and boilerplate configuration

### Initial setup commands

```bash
# Prerequisites installation
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# Install Node.js LTS from nodejs.org

# Create project
npm create tauri-app@latest
# Choose: React, TypeScript, pnpm/npm

# Add SQLite support
cd my-gamification-app
npm run tauri add sql
cd src-tauri
cargo add tauri-plugin-sql --features sqlite
```

### Essential npm packages (2025 versions)

```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.8.0",
    "@tauri-apps/plugin-sql": "^2.8.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.2",
    "@heroui/react": "^2.6.7",
    "framer-motion": "^11.11.17",
    "lucide-react": "^0.460.0",
    "visx": "^3.5.0",
    "react-countup": "^6.5.0",
    "react-activity-calendar": "^2.5.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.8.0",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "typescript": "^5.6.0",
    "@vitejs/plugin-react": "^4.3.3",
    "vite": "^6.0.1",
    "tailwindcss": "^3.4.14"
  }
}
```

### Project folder structure

```
my-gamification-app/
├── src/
│   ├── features/
│   │   ├── tasks/
│   │   │   ├── components/
│   │   │   │   ├── TaskCard/
│   │   │   │   ├── TaskList/
│   │   │   │   └── QuestTracker/
│   │   │   ├── hooks/
│   │   │   ├── services/
│   │   │   └── types/
│   │   ├── gamification/
│   │   │   ├── components/
│   │   │   │   ├── XPBar/
│   │   │   │   ├── HealthBar/
│   │   │   │   └── AchievementBadge/
│   │   │   ├── hooks/
│   │   │   └── constants/
│   │   ├── auth/
│   │   └── stats/
│   ├── shared/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── layout/
│   │   ├── hooks/
│   │   └── utils/
│   ├── pages/
│   │   ├── Dashboard/
│   │   ├── Tasks/
│   │   ├── Calendar/
│   │   ├── Shop/
│   │   ├── Stats/
│   │   └── Settings/
│   ├── store/
│   │   ├── slices/
│   │   └── index.ts
│   ├── assets/
│   └── App.tsx
├── src-tauri/
│   ├── migrations/
│   │   └── 001_initial.sql
│   ├── src/
│   │   ├── commands/
│   │   ├── database/
│   │   └── main.rs
│   └── tauri.conf.json
├── .env
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .gitignore
```

### Environment variables

```bash
# .env
VITE_APP_NAME=Life Gamification System
VITE_DEBUG_MODE=true

# src-tauri/.env
DATABASE_URL=sqlite:app.db
RUST_LOG=debug
```

### Comprehensive .gitignore

```gitignore
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
target/
src-tauri/target/
src-tauri/gen/

# Environment
.env
.env.local
*.db
*.sqlite

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
```

## 2. Complete database schema with gamification features

### Core tables with indexes

```sql
-- Users and character progression
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
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
    energy_regen_rate INTEGER DEFAULT 1,
    
    -- Preferences
    theme_preference TEXT DEFAULT 'solo_leveling',
    ui_customization TEXT -- JSON
);

-- Tasks/quests system
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 10),
    
    -- Rewards
    base_experience_reward INTEGER DEFAULT 10,
    strength_reward INTEGER DEFAULT 0,
    intelligence_reward INTEGER DEFAULT 0,
    endurance_reward INTEGER DEFAULT 0,
    
    -- Scheduling
    due_date DATETIME,
    recurrence_pattern TEXT, -- JSON
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'paused')),
    priority INTEGER DEFAULT 1 CHECK (priority BETWEEN 1 AND 5),
    energy_cost INTEGER DEFAULT 10,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- Achievements system
CREATE TABLE achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    requirements TEXT NOT NULL, -- JSON
    experience_reward INTEGER DEFAULT 0,
    rarity TEXT DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
);

-- Streak tracking
CREATE TABLE active_streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    streak_type TEXT NOT NULL,
    current_count INTEGER DEFAULT 0,
    longest_count INTEGER DEFAULT 0,
    last_completion_date DATE,
    skip_days_used INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Task templates
CREATE TABLE task_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    difficulty INTEGER,
    estimated_duration INTEGER, -- minutes
    base_xp_reward INTEGER DEFAULT 10,
    tags TEXT -- JSON array
);

-- Performance indexes
CREATE INDEX idx_users_level ON users(level);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_active_streaks_user ON active_streaks(user_id) WHERE is_active = TRUE;
```

### Auto-calculation triggers

```sql
-- Update user level based on XP
CREATE TRIGGER update_user_level 
AFTER UPDATE OF experience_points ON users
BEGIN
    UPDATE users 
    SET level = CAST(1 + (NEW.experience_points / 100) AS INTEGER),
        experience_to_next_level = (100 * (1 + (NEW.experience_points / 100))) - NEW.experience_points
    WHERE id = NEW.id;
END;
```

### Seed data

```sql
-- Task categories
INSERT INTO task_templates (name, description, category, difficulty, estimated_duration, base_xp_reward) VALUES
('30-Minute Walk', 'Take a brisk walk outdoors', 'cardio', 6, 30, 25),
('Read for 1 Hour', 'Read educational material', 'learning', 5, 60, 40),
('Gym Workout', 'Complete gym session', 'strength', 7, 90, 75),
('Meditation', 'Practice mindfulness', 'wellness', 3, 15, 20),
('Pomodoro Block', '25-minute focused work', 'productivity', 5, 25, 60),
('Deep Work Session', '2-hour deep focus', 'productivity', 8, 120, 200);

-- Achievements
INSERT INTO achievements (name, description, requirements, experience_reward, rarity) VALUES
('First Steps', 'Complete your first task', '{"type": "task_count", "count": 1}', 50, 'common'),
('Week Warrior', 'Maintain a 7-day streak', '{"type": "streak", "count": 7}', 200, 'rare'),
('Centurion', 'Complete 100 tasks', '{"type": "task_count", "count": 100}', 1000, 'epic');
```

## 3. UI component hierarchy and state management

### Component tree structure

```typescript
// App.tsx - Main application shell
<App>
  <ThemeProvider theme={manhwaTheme}>
    <HashRouter>
      <Layout>
        <Sidebar>
          <Navigation />
          <UserStatus />
        </Sidebar>
        <Main>
          <Header />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Main>
      </Layout>
    </HashRouter>
  </ThemeProvider>
</App>
```

### State management with Zustand

```typescript
// store/gameStore.ts
import { create } from 'zustand';

interface GameState {
  user: {
    level: number;
    xp: number;
    health: number;
    energy: number;
    stats: {
      strength: number;
      intelligence: number;
      endurance: number;
      charisma: number;
      luck: number;
    };
  };
  tasks: {
    active: Task[];
    completed: Task[];
  };
  streaks: Streak[];
  
  // Actions
  addTask: (task: Task) => void;
  completeTask: (taskId: string) => void;
  gainXP: (amount: number) => void;
  updateEnergy: (amount: number) => void;
}

export const useGameStore = create<GameState>((set) => ({
  user: {
    level: 1,
    xp: 0,
    health: 100,
    energy: 100,
    stats: {
      strength: 10,
      intelligence: 10,
      endurance: 10,
      charisma: 10,
      luck: 10,
    },
  },
  tasks: { active: [], completed: [] },
  streaks: [],
  
  addTask: (task) =>
    set((state) => ({
      tasks: { ...state.tasks, active: [...state.tasks.active, task] },
    })),
    
  completeTask: (taskId) =>
    set((state) => {
      const task = state.tasks.active.find(t => t.id === taskId);
      if (task) {
        return {
          tasks: {
            active: state.tasks.active.filter(t => t.id !== taskId),
            completed: [...state.tasks.completed, { ...task, completedAt: new Date() }],
          },
        };
      }
      return state;
    }),
    
  gainXP: (amount) =>
    set((state) => ({
      user: { ...state.user, xp: state.user.xp + amount },
    })),
    
  updateEnergy: (amount) =>
    set((state) => ({
      user: {
        ...state.user,
        energy: Math.max(0, Math.min(100, state.user.energy + amount)),
      },
    })),
}));
```

### Navigation with keyboard shortcuts

```typescript
// hooks/useKeyboardShortcuts.ts
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'n':
            event.preventDefault();
            // Open new task modal
            break;
          case 'd':
            event.preventDefault();
            navigate('/');
            break;
          case 't':
            event.preventDefault();
            navigate('/tasks');
            break;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [navigate]);
};
```

## 4. Critical constants and formulas

### XP and progression formulas

```typescript
// constants/gameConstants.ts

// XP needed for next level
export const calculateXPNeeded = (level: number): number => {
  return Math.round(100 * Math.pow(level, 1.75));
};

// Task XP calculation with multipliers
export const calculateTaskXP = (
  baseXP: number,
  difficulty: number,
  streakDays: number,
  timeOfDay: number
): number => {
  const difficultyMultiplier = 1 + ((difficulty - 5) * 0.2);
  const streakMultiplier = getStreakMultiplier(streakDays);
  const timeMultiplier = getTimeMultiplier(timeOfDay);
  
  return Math.round(baseXP * difficultyMultiplier * streakMultiplier * timeMultiplier);
};

const getStreakMultiplier = (days: number): number => {
  if (days >= 61) return 2.0;
  if (days >= 31) return 1.75;
  if (days >= 15) return 1.5;
  if (days >= 8) return 1.25;
  return 1.0;
};

const getTimeMultiplier = (hour: number): number => {
  if (hour >= 6 && hour <= 10) return 1.25; // Morning bonus
  if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16)) return 1.15; // Deep work hours
  return 1.0;
};
```

### Difficulty and energy constants

```typescript
export const DIFFICULTY_CONFIG = {
  trivial: { range: [1, 2], xp: [10, 25], energy: 5 },
  easy: { range: [3, 4], xp: [30, 50], energy: 10 },
  medium: { range: [5, 6], xp: [60, 100], energy: 20 },
  hard: { range: [7, 8], xp: [120, 200], energy: 35 },
  epic: { range: [9, 10], xp: [250, 500], energy: 50 },
};

export const HEALTH_CONFIG = {
  missedDaily: -10,
  missedHabit: -5,
  criticalMissed: -20,
  maxHealth: 100,
};

export const ENERGY_CONFIG = {
  regenPerHour: 25, // 25% of max
  fullRegenHours: 4,
  sleepBonus: 50, // 50% extra if sleep tracked
  perTaskInterval: 2.4, // minutes per 1 energy
};
```

### Theme color schemes

```typescript
export const THEMES = {
  soloLeveling: {
    background: '#0A0E1A',
    primary: '#1E2A3A',
    accent: '#00D4FF',
    secondary: '#6366F1',
    text: '#E5E7EB',
    warning: '#EF4444',
  },
  secondLifeRanker: {
    background: '#121212',
    primary: '#2D1B69',
    accent: '#9D4EDD',
    secondary: '#FFD60A',
    text: '#F8F9FA',
    success: '#20C997',
  },
  towerOfGod: {
    background: '#1A1D29',
    primary: '#252A3F',
    accent: '#4ECDC4',
    secondary: '#FFE066',
    text: '#DEE2E6',
    power: '#7C3AED',
  },
};
```

## 5. Task template system

### Template structure and categories

```typescript
// types/templates.ts
interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  category: TaskCategory;
  difficulty: number;
  duration: number; // minutes
  xpReward: number;
  energyCost: number;
  statRewards: Partial<CharacterStats>;
  tags: string[];
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'cardio-30',
    name: '30-Minute Walk',
    description: 'Take a brisk walk outdoors',
    category: 'cardio',
    difficulty: 6,
    duration: 30,
    xpReward: 80,
    energyCost: 25,
    statRewards: { endurance: 1 },
    tags: ['outdoor', 'beginner'],
  },
  {
    id: 'strength-45',
    name: 'Strength Training',
    description: 'Complete gym workout',
    category: 'strength',
    difficulty: 7,
    duration: 45,
    xpReward: 120,
    energyCost: 35,
    statRewards: { strength: 1 },
    tags: ['gym', 'challenging'],
  },
  {
    id: 'pomodoro-25',
    name: 'Pomodoro Block',
    description: '25-minute focused work',
    category: 'productivity',
    difficulty: 5,
    duration: 25,
    xpReward: 60,
    energyCost: 15,
    statRewards: { intelligence: 1 },
    tags: ['focus', 'work'],
  },
  {
    id: 'meditation-15',
    name: 'Meditation Session',
    description: 'Practice mindfulness',
    category: 'wellness',
    difficulty: 4,
    duration: 15,
    xpReward: 45,
    energyCost: -10, // Restores energy
    statRewards: { charisma: 1 },
    tags: ['relaxation', 'mental'],
  },
];
```

### Auto-tracking integrations

```typescript
// services/autoTracking.ts
interface AutoTrackingService {
  steps?: { source: 'healthkit' | 'googlefit'; threshold: number };
  finance?: { source: 'plaid' | 'mint'; category: string };
  coding?: { source: 'github' | 'gitlab'; commits: number };
  reading?: { source: 'kindle' | 'goodreads'; minutes: number };
}

export const AUTO_TRACKING_CONFIG: AutoTrackingService = {
  steps: { source: 'healthkit', threshold: 10000 },
  finance: { source: 'plaid', category: 'savings' },
  coding: { source: 'github', commits: 5 },
  reading: { source: 'kindle', minutes: 30 },
};
```

## 6. Data visualization components

### Chart configuration with Visx

```typescript
// components/charts/XPProgressChart.tsx
import { AreaClosed, Line, Bar } from '@visx/shape';
import { scaleTime, scaleLinear } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';

export const XPProgressChart: FC<{ data: XPData[] }> = ({ data }) => {
  const xScale = scaleTime({
    domain: [minDate, maxDate],
    range: [0, width],
  });
  
  const yScale = scaleLinear({
    domain: [0, maxXP],
    range: [height, 0],
  });
  
  return (
    <svg width={width} height={height}>
      <AreaClosed
        data={data}
        x={(d) => xScale(d.date)}
        y={(d) => yScale(d.xp)}
        yScale={yScale}
        strokeWidth={2}
        stroke="#00D4FF"
        fill="url(#gradient)"
        curve={curveMonotoneX}
      />
      <AxisBottom scale={xScale} />
      <AxisLeft scale={yScale} />
    </svg>
  );
};
```

### Animated number displays

```typescript
// components/gaming/AnimatedXP.tsx
import CountUp from 'react-countup';
import { motion } from 'framer-motion';

export const AnimatedXP: FC<{ value: number; gained?: number }> = ({ value, gained }) => {
  return (
    <div className="relative">
      <CountUp 
        end={value} 
        duration={2.75} 
        separator="," 
        suffix=" XP"
        className="text-2xl font-bold"
      />
      {gained && (
        <motion.div
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={{ y: -50, opacity: 0, scale: 1.2 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute text-green-500 font-bold"
        >
          +{gained} XP
        </motion.div>
      )}
    </div>
  );
};
```

### Toggle and filter controls

```typescript
// components/controls/ViewToggle.tsx
export const ViewToggle: FC = () => {
  const [view, setView] = useState<'graph' | 'numbers'>('graph');
  
  return (
    <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
      <button
        onClick={() => setView('graph')}
        className={`px-4 py-2 rounded ${
          view === 'graph' ? 'bg-white shadow' : ''
        }`}
      >
        <BarChart3 size={20} />
      </button>
      <button
        onClick={() => setView('numbers')}
        className={`px-4 py-2 rounded ${
          view === 'numbers' ? 'bg-white shadow' : ''
        }`}
      >
        <Hash size={20} />
      </button>
    </div>
  );
};
```

### Export functionality

```typescript
// utils/export.ts
export const exportToCSV = (data: any[], filename: string): void => {
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(header => row[header]).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
```

## 7. Implementation roadmap

### Phase 1: Foundation (Week 1)
**Day 1-2: Project Setup**
- Initialize Tauri + React project
- Configure TypeScript and Tailwind
- Set up Git repository

**Day 3-4: Database Design**
- Implement SQLite schema
- Create migration system
- Add seed data

**Day 5-7: Core Infrastructure**
- Rust database commands
- React routing setup
- Zustand store configuration

### Phase 2: Core Features (Weeks 2-3)
**Week 2: Backend Development**
- CRUD operations for tasks
- XP calculation logic
- Achievement system
- Streak tracking

**Week 3: Frontend Components**
- Task management UI
- Progress bars and XP displays
- Dashboard layout
- Theme system

### Phase 3: Integration (Week 4)
**Day 22-24: System Integration**
- Connect frontend to backend
- Real-time state updates
- Data persistence

**Day 25-28: Polish and Testing**
- Unit tests for critical functions
- Performance optimization
- UI polish and animations

### MVP features vs nice-to-have

**MVP (4 weeks):**
- ✅ Basic task management
- ✅ XP and level system
- ✅ Simple achievements
- ✅ Dashboard with stats
- ✅ Theme switching

**Should-Have (2 weeks):**
- ⭐ Streak tracking with exceptions
- ⭐ Data visualization charts
- ⭐ Task templates
- ⭐ Export functionality

**Nice-to-Have (Later):**
- 🎯 Social features
- 🎯 Cloud sync
- 🎯 Advanced analytics
- 🎯 Plugin system
- 🎯 Mobile companion app

### Performance benchmarks

**Target Metrics:**
- App startup: < 2 seconds
- Database queries: < 50ms simple, < 200ms complex
- Memory usage: < 100MB baseline
- UI interactions: < 100ms response
- Animations: Maintain 60fps

### Testing strategy

```typescript
// Example test structure
// __tests__/xpCalculation.test.ts
describe('XP Calculation', () => {
  test('calculates XP with streak bonus', () => {
    const result = calculateTaskXP(100, 5, 10, 8);
    expect(result).toBe(125); // Base 100 × 1.25 streak
  });
});
```

### Development tools configuration

**VS Code Extensions:**
- rust-analyzer
- Tauri
- ES7+ React snippets
- Tailwind CSS IntelliSense

**Scripts in package.json:**
```json
{
  "scripts": {
    "dev": "vite",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "test": "vitest",
    "lint": "eslint src --ext ts,tsx"
  }
}
```

## Conclusion

This specification provides a complete technical foundation for building a sophisticated manhwa-style life gamification desktop application. The architecture leverages Tauri's native performance with React's component ecosystem, optimized for engaging gamification mechanics. The modular design allows for incremental development while maintaining code quality and performance targets. Start with the MVP features and expand based on user feedback, focusing on creating an engaging, performant experience that makes personal productivity feel like an epic adventure.