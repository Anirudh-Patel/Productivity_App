import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { 
  GameState, 
  User, 
  Task, 
  CreateTaskRequest, 
  UserAchievement, 
  Achievement,
  Streak,
  InventoryItem 
} from '../types';
import { logger, logUserAction, logPerformance } from '../utils/logger';
import { withErrorHandling } from '../utils/errorHandler';
import { PerformanceMonitor } from '../utils/performance';

export const useGameStore = create<GameState>((set, get) => ({
  user: null,
  tasks: {
    active: [],
    completed: [],
    loading: false,
  },
  achievements: {
    unlocked: [],
    available: [],
    loading: false,
  },
  inventory: {
    items: [],
    loading: false,
  },
  buffs: {
    active: [],
    loading: false,
  },
  streak: null,

  fetchUser: async () => {
    const startTime = Date.now();
    
    const result = await withErrorHandling(
      () => invoke('get_user'),
      { component: 'GameStore', action: 'fetchUser' }
    );
    
    const duration = Date.now() - startTime;
    logPerformance('fetchUser', duration, 'GameStore');
    
    if (result.error) {
      logger.error('Failed to fetch user', result.error, 'GameStore', 'fetchUser');
      throw result.error;
    }
    
    if (result.data) {
      set({ user: result.data });
      logger.debug('User fetched successfully', { userId: result.data.id }, 'GameStore');
    }
  },

  fetchTasks: async (status?: string) => {
    set(state => ({
      tasks: { ...state.tasks, loading: true }
    }));

    await PerformanceMonitor.measureAsync(
      `fetchTasks${status ? `_${status}` : ''}`,
      async () => {
        try {
          const tasks: Task[] = await invoke('get_tasks', { status });
          
          if (status === 'completed') {
            set(state => ({
              tasks: { ...state.tasks, completed: tasks, loading: false }
            }));
          } else if (status === 'active') {
            set(state => ({
              tasks: { ...state.tasks, active: tasks, loading: false }
            }));
          } else {
            // No status filter - separate active and completed
            const activeTasks = tasks.filter(t => t.status === 'active');
            const completedTasks = tasks.filter(t => t.status === 'completed');
            
            set(() => ({
              tasks: { 
                active: activeTasks,
                completed: completedTasks,
                loading: false 
              }
            }));
          }
        } catch (error) {
          console.error('Failed to fetch tasks:', error);
          set(state => ({
            tasks: { ...state.tasks, loading: false }
          }));
          throw error;
        }
      },
      500 // Log if fetch takes longer than 500ms
    );
  },

  createTask: async (taskData: CreateTaskRequest): Promise<Task> => {
    return await PerformanceMonitor.measureAsync(
      'createTask',
      async () => {
        try {
          const newTask: Task = await invoke('create_task', { taskData });
          
          // Add to active tasks
          set(state => ({
            tasks: {
              ...state.tasks,
              active: [newTask, ...state.tasks.active]
            }
          }));

          return newTask;
        } catch (error) {
          console.error('Failed to create task:', error);
          throw error;
        }
      },
      300 // Log if creation takes longer than 300ms
    );
  },

  completeTask: async (taskId: number) => {
    await PerformanceMonitor.measureAsync(
      `completeTask_store_${taskId}`,
      async () => {
        try {
          const completedTask: Task = await invoke('complete_task', { taskId });
          
          set(state => ({
            tasks: {
              ...state.tasks,
              active: state.tasks.active.filter(t => t.id !== taskId),
              completed: [completedTask, ...state.tasks.completed]
            }
          }));

          // Refresh user data to get updated XP/gold
          get().fetchUser();
          
          // Check for new achievements
          get().checkAchievements();
          
        } catch (error) {
          console.error('Failed to complete task:', error);
          throw error;
        }
      },
      400 // Log if completion takes longer than 400ms
    );
  },

  updateTaskProgress: async (taskId: number, progressAmount: number) => {
    try {
      const updatedTask: Task = await invoke('update_task_progress', { 
        taskId, 
        progressAmount 
      });
      
      set(state => {
        if (updatedTask.status === 'completed') {
          // Task was completed, move it to completed list
          return {
            tasks: {
              ...state.tasks,
              active: state.tasks.active.filter(t => t.id !== taskId),
              completed: [updatedTask, ...state.tasks.completed]
            }
          };
        } else {
          // Update the task in active list
          return {
            tasks: {
              ...state.tasks,
              active: state.tasks.active.map(t => 
                t.id === taskId ? updatedTask : t
              )
            }
          };
        }
      });

      // If task was completed, refresh user data
      if (updatedTask.status === 'completed') {
        get().fetchUser();
        get().checkAchievements();
      }
      
      return updatedTask;
    } catch (error) {
      console.error('Failed to update task progress:', error);
      throw error;
    }
  },

  fetchAchievements: async () => {
    set(state => ({
      achievements: { ...state.achievements, loading: true }
    }));

    try {
      const unlocked: UserAchievement[] = await invoke('get_user_achievements');
      
      set(state => ({
        achievements: { 
          ...state.achievements, 
          unlocked, 
          loading: false 
        }
      }));
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
      set(state => ({
        achievements: { ...state.achievements, loading: false }
      }));
    }
  },

  checkAchievements: async (): Promise<Achievement[]> => {
    try {
      const newAchievements: Achievement[] = await invoke('check_achievements');
      
      if (newAchievements.length > 0) {
        // Refresh achievements list
        get().fetchAchievements();
        
        // Show achievement notification (you can add this later)
        console.log('🏆 New achievements unlocked:', newAchievements);
      }
      
      return newAchievements;
    } catch (error) {
      console.error('Failed to check achievements:', error);
      return [];
    }
  },

  purchaseItem: async (itemId: string, price: number): Promise<User> => {
    try {
      const updatedUser: User = await invoke('purchase_item', { 
        itemId, 
        price: price as number 
      });
      
      // Update user state with new gold amount
      set({ user: updatedUser });
      
      // Refresh inventory to show new item
      get().fetchInventory();
      
      logger.info('Item purchased successfully', { itemId, price }, 'GameStore');
      return updatedUser;
    } catch (error) {
      console.error('Failed to purchase item:', error);
      throw error;
    }
  },

  fetchInventory: async () => {
    set(state => ({
      inventory: { ...state.inventory, loading: true }
    }));

    try {
      const items: InventoryItem[] = await invoke('get_user_inventory');
      
      set(state => ({
        inventory: { 
          items,
          loading: false 
        }
      }));
      
      logger.debug('Inventory fetched successfully', { itemCount: items.length }, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      set(state => ({
        inventory: { ...state.inventory, loading: false }
      }));
    }
  },

  useItem: async (itemId: string): Promise<User> => {
    try {
      const updatedUser: User = await invoke('use_inventory_item', { itemId });
      
      // Update user state
      set({ user: updatedUser });
      
      // Refresh inventory to show updated quantities
      get().fetchInventory();
      
      logger.info('Item used successfully', { itemId }, 'GameStore');
      return updatedUser;
    } catch (error) {
      console.error('Failed to use item:', error);
      throw error;
    }
  },

  getUserTitles: async (): Promise<string[]> => {
    try {
      const titles: string[] = await invoke('get_user_titles');
      logger.debug('User titles fetched successfully', { titleCount: titles.length }, 'GameStore');
      return titles;
    } catch (error) {
      console.error('Failed to fetch user titles:', error);
      throw error;
    }
  },

  equipTitle: async (title: string): Promise<User> => {
    try {
      const updatedUser: User = await invoke('equip_title', { title });
      
      // Update user state
      set({ user: updatedUser });
      
      logger.info('Title equipped successfully', { title }, 'GameStore');
      return updatedUser;
    } catch (error) {
      console.error('Failed to equip title:', error);
      throw error;
    }
  },

  unequipTitle: async (): Promise<User> => {
    try {
      const updatedUser: User = await invoke('unequip_title');
      
      // Update user state
      set({ user: updatedUser });
      
      logger.info('Title unequipped successfully', {}, 'GameStore');
      return updatedUser;
    } catch (error) {
      console.error('Failed to unequip title:', error);
      throw error;
    }
  },

  getRecommendedDifficulty: async (taskCategory: string): Promise<number> => {
    try {
      const difficulty: number = await invoke('get_recommended_difficulty', { taskCategory });
      logger.debug('Got recommended difficulty', { taskCategory, difficulty }, 'GameStore');
      return difficulty;
    } catch (error) {
      console.error('Failed to get recommended difficulty:', error);
      throw error;
    }
  },

  getActiveBuffs: async (): Promise<import('../types').Buff[]> => {
    set(state => ({
      buffs: { ...state.buffs, loading: true }
    }));

    try {
      const buffs: import('../types').Buff[] = await invoke('get_active_buffs');
      
      set(state => ({
        buffs: { 
          active: buffs,
          loading: false
        }
      }));
      
      logger.debug('Active buffs fetched successfully', { buffCount: buffs.length }, 'GameStore');
      return buffs;
    } catch (error) {
      console.error('Failed to fetch active buffs:', error);
      set(state => ({
        buffs: { ...state.buffs, loading: false }
      }));
      throw error;
    }
  },

  applyBuff: async (buffType: string, value: number, statType?: string, durationMinutes: number = 30): Promise<import('../types').Buff> => {
    try {
      const buff: import('../types').Buff = await invoke('apply_buff', { 
        buffType, 
        value, 
        statType, 
        durationMinutes 
      });
      
      // Refresh buffs list
      get().getActiveBuffs();
      
      logger.info('Buff applied successfully', { buffType, value, duration: durationMinutes }, 'GameStore');
      return buff;
    } catch (error) {
      console.error('Failed to apply buff:', error);
      throw error;
    }
  },
}));