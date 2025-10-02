# State Management Consolidation Plan

## Current State Analysis

### Problem: Duplicate State Management
The codebase has **overlapping state management** using both Zustand and Jotai for the same data:

#### Zustand Stores
1. **gameStore.ts** - Core game state (user, tasks, achievements, inventory)
2. **preferencesStore.ts** - User preferences and settings
3. **calendarStore.ts** - Calendar integration state
4. **notificationStore.ts** - In-app notifications
5. **avatarSlice.ts** - Avatar equipment state

#### Jotai Atoms
1. **atoms.ts** - DUPLICATES gameStore (user, tasks, achievements, inventory)
   - Also has simplified settings atoms that overlap with preferencesStore

### The Overlap
- **gameStore.ts** and **atoms.ts** manage the SAME data:
  - User profile (level, XP, gold)
  - Tasks (active, completed)
  - Achievements
  - Inventory
  - Buffs

This creates:
- Synchronization bugs
- Developer confusion
- Performance overhead
- Maintenance burden

## Recommended Solution

### Keep This Pattern
**Hybrid approach leveraging strengths of both libraries:**

#### Use Jotai For:
- **Core game state** that needs fine-grained reactivity
- **Derived/computed state** (XP progress, task stats)
- **Atomic updates** that prevent unnecessary re-renders

#### Use Zustand For:
- **Self-contained modules** (preferences, calendar, notifications)
- **Persistent settings** that don't need atomic reactivity
- **Complex nested state** (theme settings, UI preferences)

### Consolidation Actions

#### 1. Remove gameStore.ts ✅
- All functionality duplicated in atoms.ts
- Components should use Jotai atoms instead:
  ```typescript
  // Old (Zustand)
  const { user, tasks } = useGameStore();

  // New (Jotai)
  const user = useAtomValue(userAtom);
  const tasks = useAtomValue(tasksAtom);
  ```

#### 2. Remove Settings Atoms from atoms.ts ✅
Keep settings in preferencesStore.ts only:
- Remove: `themeAtom`, `soundEnabledAtom`, `notificationsEnabledAtom`
- Use: `usePreferencesStore()` for all settings

#### 3. Clarify Inventory Management
- **Single source of truth**: `inventoryItemsAtom` (Jotai)
- **Avatar equipment**: Read from inventory atom, manage equipped state locally
- Remove duplicate inventory fetching from gameStore and avatarSlice

#### 4. Final Architecture

```
Jotai (atoms.ts)
├── User State (level, XP, gold)
├── Tasks (active, completed)
├── Achievements
├── Inventory (all items)
├── Buffs
└── Derived states (progress, stats)

Zustand
├── preferencesStore.ts (all user settings)
├── calendarStore.ts (calendar integration)
├── notificationStore.ts (notification UI)
└── avatarSlice.ts (equipped items only)
```

## Implementation Steps

### Phase 1: Remove Duplicates ✅
1. Delete gameStore.ts
2. Remove settings atoms from atoms.ts
3. Update imports in affected components

### Phase 2: Refactor Components
Update components using deleted stores:
```typescript
// Components to update
- Dashboard/index.tsx
- Tasks/index.tsx
- Stats/index.tsx
- Shop/index.tsx
- Equipment/index.tsx
- Sidebar.tsx
```

### Phase 3: Test & Verify
1. Ensure data flows correctly
2. Check for sync issues
3. Verify persistence works

## Migration Example

### Before (Using gameStore)
```typescript
import { useGameStore } from '@/store/gameStore';

function Dashboard() {
  const { user, tasks, fetchUser, completeTask } = useGameStore();

  useEffect(() => {
    fetchUser();
  }, []);

  const handleComplete = (taskId) => {
    completeTask(taskId);
  };
}
```

### After (Using Jotai atoms)
```typescript
import { useAtomValue, useSetAtom } from 'jotai';
import { userAtom, tasksAtom, fetchUserAtom, completeTaskAtom } from '@/store/atoms';

function Dashboard() {
  const user = useAtomValue(userAtom);
  const tasks = useAtomValue(tasksAtom);
  const fetchUser = useSetAtom(fetchUserAtom);
  const completeTask = useSetAtom(completeTaskAtom);

  useEffect(() => {
    fetchUser();
  }, []);

  const handleComplete = (taskId) => {
    completeTask(taskId);
  };
}
```

## Benefits After Consolidation

1. **Clear separation of concerns**
2. **No duplicate state**
3. **Better performance** (Jotai's atomic updates)
4. **Easier debugging** (single source of truth)
5. **Cleaner codebase**

## Notes

- This is a BREAKING change for components
- Test thoroughly after migration
- Consider doing migration in stages
- Update documentation after completion