import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { User, Task, Achievement, UserAchievement, InventoryItem, Buff, CreateTaskRequest } from '../types';
import { notificationService } from '../services/notificationService';

// Query keys for cache management
export const queryKeys = {
  user: ['user'],
  tasks: ['tasks'],
  achievements: ['achievements'],
  inventory: ['inventory'],
  buffs: ['buffs'],
  stats: ['stats'],
  calendar: ['calendar']
} as const;

// ==================== USER QUERIES ====================

export const useUser = () => {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => invoke('get_user') as Promise<User>,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000)
  });
};

export const useUserStats = () => {
  const { data: user } = useUser();
  
  return useQuery({
    queryKey: [...queryKeys.user, 'stats'],
    queryFn: async () => {
      const stats = await invoke('get_user_detailed_stats') as any;
      return stats;
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minute
  });
};

// ==================== TASK QUERIES ====================

export const useTasks = () => {
  return useQuery({
    queryKey: queryKeys.tasks,
    queryFn: () => invoke('get_tasks') as Promise<Task[]>,
    staleTime: 10 * 1000, // 10 seconds
    refetchOnWindowFocus: true,
    select: (tasks) => ({
      all: tasks,
      active: tasks.filter(t => t.status === 'active' || t.status === 'in_progress'),
      completed: tasks.filter(t => t.status === 'completed')
    })
  });
};

export const useTaskById = (taskId: number | undefined) => {
  return useQuery({
    queryKey: [...queryKeys.tasks, taskId],
    queryFn: () => invoke('get_task_by_id', { taskId }) as Promise<Task>,
    enabled: !!taskId,
    staleTime: 30 * 1000
  });
};

export const useTaskStats = () => {
  const { data: tasks } = useTasks();
  
  return useQuery({
    queryKey: [...queryKeys.stats, 'tasks'],
    queryFn: async () => {
      const stats = await invoke('get_task_statistics') as any;
      return stats;
    },
    enabled: !!tasks,
    staleTime: 60 * 1000
  });
};

// ==================== TASK MUTATIONS ====================

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (taskData: CreateTaskRequest) => invoke('create_task', { taskData }) as Promise<Task>,
    onMutate: async (newTask) => {
      // Cancel outgoing task queries
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      
      // Snapshot previous value
      const previousTasks = queryClient.getQueryData(queryKeys.tasks);
      
      // Optimistically update cache
      queryClient.setQueryData(queryKeys.tasks, (old: Task[] = []) => {
        const optimisticTask: Task = {
          id: Date.now(), // Temporary ID
          user_id: 1,
          title: newTask.title,
          description: newTask.description || null,
          category: newTask.category || 'general',
          difficulty: newTask.difficulty || 5,
          base_experience_reward: (newTask.difficulty || 5) * 10,
          gold_reward: (newTask.difficulty || 5) * 2,
          due_date: newTask.due_date || null,
          status: 'active',
          priority: newTask.priority || 1,
          created_at: new Date().toISOString(),
          completed_at: null,
          task_type: newTask.task_type || 'standard',
          goal_target: newTask.goal_target || null,
          goal_current: null,
          goal_unit: newTask.goal_unit || null
        };
        return [optimisticTask, ...old];
      });
      
      return { previousTasks };
    },
    onError: (err, newTask, context) => {
      // Rollback on error
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks, context.previousTasks);
      }
      notificationService.notifySystem('Error', 'Failed to create task');
    },
    onSuccess: (data) => {
      notificationService.notifyTaskCreated(data.title);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks });
    }
  });
};

export const useCompleteTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (taskId: number) => invoke('complete_task', { taskId }) as Promise<Task>,
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks });
      
      const previousTasks = queryClient.getQueryData(queryKeys.tasks);
      
      // Optimistically move task to completed
      queryClient.setQueryData(queryKeys.tasks, (old: Task[] = []) => {
        return old.map(task => 
          task.id === taskId 
            ? { ...task, status: 'completed', completed_at: new Date().toISOString() }
            : task
        );
      });
      
      return { previousTasks };
    },
    onSuccess: (completedTask) => {
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: queryKeys.achievements });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
      
      notificationService.notifyTaskCompleted(completedTask.title, completedTask.base_experience_reward);
    },
    onError: (err, taskId, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKeys.tasks, context.previousTasks);
      }
      notificationService.notifySystem('Error', 'Failed to complete task');
    }
  });
};

export const useUpdateTaskProgress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ taskId, progressAmount }: { taskId: number; progressAmount: number }) => 
      invoke('update_task_progress', { taskId, progressAmount }) as Promise<Task>,
    onSuccess: (updatedTask) => {
      // Update task in cache
      queryClient.setQueryData(queryKeys.tasks, (old: Task[] = []) => {
        return old.map(task => task.id === updatedTask.id ? updatedTask : task);
      });
      
      if (updatedTask.status === 'completed') {
        queryClient.invalidateQueries({ queryKey: queryKeys.user });
        queryClient.invalidateQueries({ queryKey: queryKeys.achievements });
      }
    }
  });
};

// ==================== ACHIEVEMENT QUERIES ====================

export const useAchievements = () => {
  return useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () => invoke('get_user_achievements') as Promise<UserAchievement[]>,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false
  });
};

export const useCheckAchievements = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => invoke('check_achievements') as Promise<Achievement[]>,
    onSuccess: (newAchievements) => {
      if (newAchievements.length > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.achievements });
        
        newAchievements.forEach(achievement => {
          notificationService.notifyAchievement(
            achievement.name,
            achievement.description,
            achievement.rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
          );
        });
      }
    }
  });
};

// ==================== INVENTORY QUERIES ====================

export const useInventory = () => {
  return useQuery({
    queryKey: queryKeys.inventory,
    queryFn: () => invoke('get_user_inventory') as Promise<InventoryItem[]>,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    select: (items) => ({
      all: items,
      byCategory: items.reduce((acc, item) => {
        const category = item.category || 'misc';
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
      }, {} as Record<string, InventoryItem[]>),
      totalValue: items.reduce((total, item) => total + (item.value || 0) * item.quantity, 0)
    })
  });
};

export const usePurchaseItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ itemId, price }: { itemId: string; price: number }) => 
      invoke('purchase_item', { itemId, price }) as Promise<User>,
    onSuccess: (updatedUser, { itemId }) => {
      queryClient.setQueryData(queryKeys.user, updatedUser);
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      
      notificationService.notifyItemPurchased(itemId);
    },
    onError: () => {
      notificationService.notifySystem('Error', 'Failed to purchase item');
    }
  });
};

export const useUseItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (itemId: string) => invoke('use_inventory_item', { itemId }) as Promise<User>,
    onSuccess: (updatedUser, itemId) => {
      queryClient.setQueryData(queryKeys.user, updatedUser);
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory });
      queryClient.invalidateQueries({ queryKey: queryKeys.buffs });
      
      notificationService.notifyItemUsed(itemId);
    }
  });
};

// ==================== BUFF QUERIES ====================

export const useBuffs = () => {
  return useQuery({
    queryKey: queryKeys.buffs,
    queryFn: () => invoke('get_active_buffs') as Promise<Buff[]>,
    staleTime: 15 * 1000, // 15 seconds
    refetchInterval: 30 * 1000, // Auto-refetch every 30 seconds
    select: (buffs) => ({
      all: buffs,
      effects: buffs.reduce((acc, buff) => {
        if (buff.buff_type === 'xp_multiplier') {
          acc.xpMultiplier *= buff.value;
        } else if (buff.buff_type === 'gold_multiplier') {
          acc.goldMultiplier *= buff.value;
        } else if (buff.buff_type === 'stat' && buff.stat_type) {
          acc.statBoosts[buff.stat_type] = (acc.statBoosts[buff.stat_type] || 0) + buff.value;
        }
        return acc;
      }, {
        xpMultiplier: 1,
        goldMultiplier: 1,
        statBoosts: {} as Record<string, number>
      })
    })
  });
};

// ==================== CALENDAR QUERIES ====================

export const useCalendarEvents = () => {
  return useQuery({
    queryKey: queryKeys.calendar,
    queryFn: () => invoke('get_calendar_events') as Promise<any[]>,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });
};

// ==================== STATS QUERIES ====================

export const useDailyStats = () => {
  return useQuery({
    queryKey: [...queryKeys.stats, 'daily'],
    queryFn: () => invoke('get_daily_stats') as Promise<any>,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 5 * 60 * 1000 // Auto-refetch every 5 minutes
  });
};

export const useUpdateDailyStats = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tasksIncrement, xpIncrement, goldIncrement }: {
      tasksIncrement: number;
      xpIncrement: number;
      goldIncrement: number;
    }) => invoke('update_daily_stats', { tasksIncrement, xpIncrement, goldIncrement }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...queryKeys.stats, 'daily'] });
    }
  });
};

// ==================== BACKUP QUERIES ====================

export const useBackups = () => {
  return useQuery({
    queryKey: ['backups'],
    queryFn: () => invoke('list_available_backups') as Promise<string[]>,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false
  });
};

export const useCreateBackup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => invoke('create_backup') as Promise<string>,
    onSuccess: (backupPath) => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      notificationService.notifySystem('Backup Created', `Backup saved: ${backupPath}`);
    },
    onError: () => {
      notificationService.notifySystem('Backup Failed', 'Failed to create backup');
    }
  });
};

export const useRestoreBackup = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (backupPath: string) => invoke('restore_from_backup', { backupPath }) as Promise<void>,
    onSuccess: () => {
      // Invalidate all queries after restore
      queryClient.invalidateQueries();
      notificationService.notifySystem('Restore Complete', 'Database restored successfully');
    },
    onError: () => {
      notificationService.notifySystem('Restore Failed', 'Failed to restore from backup');
    }
  });
};