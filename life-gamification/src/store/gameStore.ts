import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { 
  GameState, 
  User, 
  Task, 
  CreateTaskRequest, 
  UserAchievement, 
  Achievement,
  Streak 
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
}));