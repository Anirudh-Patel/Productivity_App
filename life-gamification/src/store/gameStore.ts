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
    try {
      const user: User = await invoke('get_user');
      set({ user });
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  },

  fetchTasks: async (status?: string) => {
    set(state => ({
      tasks: { ...state.tasks, loading: true }
    }));

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
        
        set(state => ({
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
    }
  },

  createTask: async (taskData: CreateTaskRequest): Promise<Task> => {
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

  completeTask: async (taskId: number) => {
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