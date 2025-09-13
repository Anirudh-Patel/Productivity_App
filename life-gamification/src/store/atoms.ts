import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { invoke } from '@tauri-apps/api/core';
import type { User, Task, Achievement, UserAchievement, InventoryItem, Buff } from '../types';

// ==================== USER ATOMS ====================
export const userAtom = atom<User | null>(null);
export const userLoadingAtom = atom(false);

// Derived atoms for user stats
export const userLevelAtom = atom((get) => get(userAtom)?.level || 1);
export const userXPAtom = atom((get) => get(userAtom)?.experience_points || 0);
export const userGoldAtom = atom((get) => get(userAtom)?.gold || 0);
export const userHealthAtom = atom((get) => ({
  current: get(userAtom)?.current_health || 100,
  max: get(userAtom)?.max_health || 100
}));

// XP progress calculation
export const xpProgressAtom = atom((get) => {
  const user = get(userAtom);
  if (!user) return { current: 0, next: 100, percentage: 0 };
  
  return {
    current: user.experience_points,
    next: user.experience_to_next_level,
    percentage: (user.experience_points / user.experience_to_next_level) * 100
  };
});

// User stats breakdown
export const userStatsAtom = atom((get) => {
  const user = get(userAtom);
  if (!user) return { strength: 0, intelligence: 0, endurance: 0, charisma: 0, luck: 0 };
  
  return {
    strength: user.strength,
    intelligence: user.intelligence,
    endurance: user.endurance,
    charisma: user.charisma,
    luck: user.luck
  };
});

// ==================== TASK ATOMS ====================
export const tasksLoadingAtom = atom(false);
export const activeTasksAtom = atom<Task[]>([]);
export const completedTasksAtom = atom<Task[]>([]);

// Derived task statistics
export const taskStatsAtom = atom((get) => {
  const active = get(activeTasksAtom);
  const completed = get(completedTasksAtom);
  
  return {
    total: active.length + completed.length,
    active: active.length,
    completed: completed.length,
    completionRate: completed.length / (active.length + completed.length) * 100 || 0
  };
});

// Tasks by difficulty
export const tasksByDifficultyAtom = atom((get) => {
  const active = get(activeTasksAtom);
  
  return {
    easy: active.filter(t => t.difficulty <= 3).length,
    medium: active.filter(t => t.difficulty > 3 && t.difficulty <= 7).length,
    hard: active.filter(t => t.difficulty > 7).length
  };
});

// Overdue tasks
export const overdueTasksAtom = atom((get) => {
  const active = get(activeTasksAtom);
  const now = new Date();
  
  return active.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    return dueDate < now;
  });
});

// ==================== ACHIEVEMENT ATOMS ====================
export const achievementsLoadingAtom = atom(false);
export const unlockedAchievementsAtom = atom<UserAchievement[]>([]);
export const availableAchievementsAtom = atom<Achievement[]>([]);

// Achievement statistics
export const achievementStatsAtom = atom((get) => {
  const unlocked = get(unlockedAchievementsAtom);
  const available = get(availableAchievementsAtom);
  
  const rarityCount = unlocked.reduce((acc, ua) => {
    const rarity = ua.achievement.rarity;
    acc[rarity] = (acc[rarity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    total: available.length,
    unlocked: unlocked.length,
    completionRate: (unlocked.length / available.length) * 100 || 0,
    byRarity: rarityCount
  };
});

// Recent achievements (last 7 days)
export const recentAchievementsAtom = atom((get) => {
  const unlocked = get(unlockedAchievementsAtom);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  return unlocked.filter(ua => new Date(ua.unlocked_at) >= sevenDaysAgo);
});

// ==================== INVENTORY ATOMS ====================
export const inventoryLoadingAtom = atom(false);
export const inventoryItemsAtom = atom<InventoryItem[]>([]);

// Inventory by category
export const inventoryByCategoryAtom = atom((get) => {
  const items = get(inventoryItemsAtom);
  
  return items.reduce((acc, item) => {
    const category = item.category || 'misc';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);
});

// Total inventory value
export const inventoryValueAtom = atom((get) => {
  const items = get(inventoryItemsAtom);
  return items.reduce((total, item) => total + (item.value || 0) * item.quantity, 0);
});

// ==================== BUFFS ATOMS ====================
export const buffsLoadingAtom = atom(false);
export const activeBuffsAtom = atom<Buff[]>([]);

// Buff effects summary
export const buffEffectsAtom = atom((get) => {
  const buffs = get(activeBuffsAtom);
  
  const effects = {
    xpMultiplier: 1,
    goldMultiplier: 1,
    statBoosts: {} as Record<string, number>
  };
  
  buffs.forEach(buff => {
    if (buff.buff_type === 'xp_multiplier') {
      effects.xpMultiplier *= buff.value;
    } else if (buff.buff_type === 'gold_multiplier') {
      effects.goldMultiplier *= buff.value;
    } else if (buff.buff_type === 'stat' && buff.stat_type) {
      effects.statBoosts[buff.stat_type] = (effects.statBoosts[buff.stat_type] || 0) + buff.value;
    }
  });
  
  return effects;
});

// ==================== SETTINGS ATOMS ====================
export const themeAtom = atomWithStorage<'light' | 'dark' | 'auto'>('theme', 'dark');
export const soundEnabledAtom = atomWithStorage('soundEnabled', true);
export const notificationsEnabledAtom = atomWithStorage('notificationsEnabled', true);
export const autoSaveEnabledAtom = atomWithStorage('autoSaveEnabled', true);

// Performance settings
export const performanceSettingsAtom = atomWithStorage('performanceSettings', {
  animationsEnabled: true,
  particleEffects: true,
  backgroundEffects: true,
  reducedMotion: false
});

// ==================== ACTION ATOMS (Write-only) ====================

// Fetch user data
export const fetchUserAtom = atom(
  null,
  async (get, set) => {
    set(userLoadingAtom, true);
    try {
      const user: User = await invoke('get_user');
      set(userAtom, user);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    } finally {
      set(userLoadingAtom, false);
    }
  }
);

// Fetch tasks
export const fetchTasksAtom = atom(
  null,
  async (get, set) => {
    set(tasksLoadingAtom, true);
    try {
      const tasks: Task[] = await invoke('get_tasks');
      const active = tasks.filter(t => t.status === 'active' || t.status === 'in_progress');
      const completed = tasks.filter(t => t.status === 'completed');
      
      set(activeTasksAtom, active);
      set(completedTasksAtom, completed);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      set(tasksLoadingAtom, false);
    }
  }
);

// Complete task
export const completeTaskAtom = atom(
  null,
  async (get, set, taskId: number) => {
    try {
      const completedTask: Task = await invoke('complete_task', { taskId });
      
      // Update task lists
      const currentActive = get(activeTasksAtom);
      const currentCompleted = get(completedTasksAtom);
      
      set(activeTasksAtom, currentActive.filter(t => t.id !== taskId));
      set(completedTasksAtom, [completedTask, ...currentCompleted]);
      
      // Refresh user data for XP/level changes
      const fetchUser = get(fetchUserAtom);
      await set(fetchUser);
      
      // Check for achievements
      const checkAchievements = get(checkAchievementsAtom);
      await set(checkAchievements);
      
      return completedTask;
    } catch (error) {
      console.error('Failed to complete task:', error);
      throw error;
    }
  }
);

// Create task
export const createTaskAtom = atom(
  null,
  async (get, set, taskData: any) => {
    try {
      const newTask: Task = await invoke('create_task', { taskData });
      
      const currentActive = get(activeTasksAtom);
      set(activeTasksAtom, [newTask, ...currentActive]);
      
      return newTask;
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }
);

// Fetch achievements
export const fetchAchievementsAtom = atom(
  null,
  async (get, set) => {
    set(achievementsLoadingAtom, true);
    try {
      const unlocked: UserAchievement[] = await invoke('get_user_achievements');
      set(unlockedAchievementsAtom, unlocked);
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    } finally {
      set(achievementsLoadingAtom, false);
    }
  }
);

// Check for new achievements
export const checkAchievementsAtom = atom(
  null,
  async (get, set) => {
    try {
      const newAchievements: Achievement[] = await invoke('check_achievements');
      
      if (newAchievements.length > 0) {
        // Refresh achievements list
        const fetchAchievements = get(fetchAchievementsAtom);
        await set(fetchAchievements);
        
        // You could trigger notifications here
        console.log('🏆 New achievements unlocked:', newAchievements);
      }
      
      return newAchievements;
    } catch (error) {
      console.error('Failed to check achievements:', error);
      return [];
    }
  }
);

// Fetch inventory
export const fetchInventoryAtom = atom(
  null,
  async (get, set) => {
    set(inventoryLoadingAtom, true);
    try {
      const items: InventoryItem[] = await invoke('get_user_inventory');
      set(inventoryItemsAtom, items);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
    } finally {
      set(inventoryLoadingAtom, false);
    }
  }
);

// Use inventory item
export const useInventoryItemAtom = atom(
  null,
  async (get, set, itemId: string) => {
    try {
      const updatedUser: User = await invoke('use_inventory_item', { itemId });
      set(userAtom, updatedUser);
      
      // Refresh inventory to show updated quantities
      const fetchInventory = get(fetchInventoryAtom);
      await set(fetchInventory);
      
      return updatedUser;
    } catch (error) {
      console.error('Failed to use item:', error);
      throw error;
    }
  }
);

// Purchase item
export const purchaseItemAtom = atom(
  null,
  async (get, set, itemId: string, price: number) => {
    try {
      const updatedUser: User = await invoke('purchase_item', { itemId, price });
      set(userAtom, updatedUser);
      
      // Refresh inventory to show new item
      const fetchInventory = get(fetchInventoryAtom);
      await set(fetchInventory);
      
      return updatedUser;
    } catch (error) {
      console.error('Failed to purchase item:', error);
      throw error;
    }
  }
);

// Fetch active buffs
export const fetchBuffsAtom = atom(
  null,
  async (get, set) => {
    set(buffsLoadingAtom, true);
    try {
      const buffs: Buff[] = await invoke('get_active_buffs');
      set(activeBuffsAtom, buffs);
    } catch (error) {
      console.error('Failed to fetch buffs:', error);
    } finally {
      set(buffsLoadingAtom, false);
    }
  }
);

// ==================== COMPOSITE ATOMS ====================

// Dashboard data (combines multiple atoms)
export const dashboardDataAtom = atom((get) => {
  const user = get(userAtom);
  const taskStats = get(taskStatsAtom);
  const achievementStats = get(achievementStatsAtom);
  const recentAchievements = get(recentAchievementsAtom);
  const overdueTasksCount = get(overdueTasksAtom).length;
  const buffEffects = get(buffEffectsAtom);
  
  return {
    user,
    taskStats,
    achievementStats,
    recentAchievements,
    overdueTasksCount,
    buffEffects,
    isLoading: get(userLoadingAtom) || get(tasksLoadingAtom) || get(achievementsLoadingAtom)
  };
});

// Game state summary
export const gameStateSummaryAtom = atom((get) => {
  const user = get(userAtom);
  const activeTasks = get(activeTasksAtom);
  const completedTasks = get(completedTasksAtom);
  const achievements = get(unlockedAchievementsAtom);
  const inventory = get(inventoryItemsAtom);
  const buffs = get(activeBuffsAtom);
  
  return {
    level: user?.level || 1,
    xp: user?.experience_points || 0,
    gold: user?.gold || 0,
    health: {
      current: user?.current_health || 100,
      max: user?.max_health || 100
    },
    stats: {
      strength: user?.strength || 0,
      intelligence: user?.intelligence || 0,
      endurance: user?.endurance || 0,
      charisma: user?.charisma || 0,
      luck: user?.luck || 0
    },
    tasks: {
      active: activeTasks.length,
      completed: completedTasks.length,
      total: activeTasks.length + completedTasks.length
    },
    achievements: achievements.length,
    inventory: inventory.length,
    activeBuffs: buffs.length
  };
});