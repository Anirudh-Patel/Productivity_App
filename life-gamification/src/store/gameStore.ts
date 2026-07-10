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
  InventoryItem,
  Project,
  CreateProjectRequest,
  TimeSession,
  ActiveTimer,
  TimeStats,
  NotificationPreferences,
  ScheduledNotification,
  NotificationHistory,
  CreateNotificationRequest,
  UpdateNotificationPreferencesRequest
} from '../types';
import { logger, logUserAction, logPerformance } from '../utils/logger';
import { withErrorHandling } from '../utils/errorHandler';
import { PerformanceMonitor } from '../utils/performance';
import { notificationService } from '../services/notificationService';
import { rewardSystem, rollReward, type Reward } from '../services/rewardService';
import { smartNotificationScheduler, scheduleTaskReminder } from '../services/smartNotificationScheduler';

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
  skills: {
    availablePoints: 0,
    unlockedSkills: [],
    loading: false,
  },
  projects: {
    all: [],
    loading: false,
  },
  timer: {
    active: null,
    sessions: [],
    stats: null,
    loading: false,
  },
  notifications: {
    preferences: null,
    scheduled: [],
    history: [],
    pending: [],
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

          // Schedule smart notifications for the task if it has a due date
          const currentUser = get().user;
          if (currentUser && taskData.due_date) {
            try {
              const dueDate = new Date(taskData.due_date);
              const complexity = taskData.difficulty ? 
                (taskData.difficulty <= 3 ? 'low' : taskData.difficulty <= 7 ? 'medium' : 'high') : 'medium';
              
              // Schedule reminder 1 hour before due date
              const reminderTime = new Date(dueDate.getTime() - 60 * 60 * 1000);
              
              await scheduleTaskReminder(
                currentUser.id,
                newTask.id,
                newTask.title,
                reminderTime,
                complexity,
                30 // estimated duration
              );
              
              console.log(`Scheduled smart reminder for task: ${newTask.title}`);
            } catch (error) {
              console.error('Failed to schedule task reminder:', error);
            }
          }

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
          const previousUser = get().user;
          
          // Get the task details BEFORE completing it so we have the XP amount
          const taskToComplete = [...get().tasks.active, ...get().tasks.completed].find(t => t.id === taskId);
          console.log('taskToComplete before completion:', taskToComplete);
          
          const completedTask: Task = await invoke('complete_task', { taskId });
          
          set(state => ({
            tasks: {
              ...state.tasks,
              active: state.tasks.active.filter(t => t.id !== taskId),
              completed: [completedTask, ...state.tasks.completed]
            }
          }));

          // Refresh user data to get updated XP/gold
          await get().fetchUser();
          
          // Roll for variable rewards
          const currentUser = get().user;
          let bonusRewards: Reward[] = [];
          if (currentUser) {
            // Calculate performance based on task difficulty
            const performance = taskToComplete?.difficulty ? (taskToComplete.difficulty / 5) : 1.0;
            
            // Roll 1-3 rewards based on task difficulty
            const rollCount = Math.min(3, Math.max(1, Math.floor((taskToComplete?.difficulty || 1) / 3)));
            for (let i = 0; i < rollCount; i++) {
              const reward = rollReward(currentUser.level, performance);
              bonusRewards.push(reward);
              
              // Apply the reward
              try {
                await rewardSystem.applyReward(reward, currentUser.id);
              } catch (error) {
                console.error('Failed to apply bonus reward:', error);
              }
            }
            
            // Show reward notifications
            for (const reward of bonusRewards) {
              if (reward.type === 'item' || reward.type === 'character_skin' || reward.type === 'secret_chapter') {
                notificationService.notifyItemReceived(
                  reward.name,
                  reward.rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
                );
              }
            }
          }
          
          // Check for new achievements
          const newAchievements = await get().checkAchievements();
          
          // Trigger notifications
          if (currentUser && previousUser) {
            // Use the original task's base experience reward (more reliable)
            const xpGained = taskToComplete?.base_experience_reward || completedTask.base_experience_reward || 0;
            
            // Add bonus XP from variable rewards
            const bonusXP = bonusRewards
              .filter(r => r.type === 'exp')
              .reduce((sum, r) => sum + (r.amount || 0), 0);
            
            const totalXP = xpGained + bonusXP;
            
            console.log('Total XP gained:', totalXP, '(base:', xpGained, ', bonus:', bonusXP, ')');
            
            // Notify task completion with rewards
            notificationService.notifyTaskCompletionWithRewards(
              completedTask.title,
              totalXP,
              newAchievements.map(achievement => ({
                name: achievement.name,
                description: achievement.description,
                rarity: achievement.rarity as 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
              }))
            );
            
            // Check for level up
            if (currentUser.level > previousUser.level) {
              notificationService.notifyLevelUp(currentUser.level, previousUser.level);
            }
          }
          
          // Refresh user data again if rewards were applied
          if (bonusRewards.length > 0) {
            await get().fetchUser();
          }
          
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
        
        // Show achievement popup for each new achievement
        for (const achievement of newAchievements) {
          try {
            await invoke('create_achievement_popup', { achievement });
          } catch (popupError) {
            console.error('Failed to create achievement popup:', popupError);
          }
        }
        
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
      
      // Trigger purchase notification
      notificationService.notifyItemReceived(itemId, 'common'); // You might want to get rarity from item data
      
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
      
      // Trigger buff notification
      notificationService.notifyBuffApplied(buffType, durationMinutes);
      
      logger.info('Buff applied successfully', { buffType, value, duration: durationMinutes }, 'GameStore');
      return buff;
    } catch (error) {
      console.error('Failed to apply buff:', error);
      throw error;
    }
  },

  fetchSkillPoints: async () => {
    set(state => ({
      skills: { ...state.skills, loading: true }
    }));

    try {
      // For now, calculate skill points based on user level
      const user = get().user;
      if (user) {
        const availablePoints = Math.max(0, user.level - 1); // 1 skill point per level after level 1
        
        set(state => ({
          skills: { 
            ...state.skills,
            availablePoints,
            loading: false
          }
        }));
      } else {
        set(state => ({
          skills: { ...state.skills, loading: false }
        }));
      }
    } catch (error) {
      console.error('Failed to fetch skill points:', error);
      set(state => ({
        skills: { ...state.skills, loading: false }
      }));
    }
  },

  fetchUnlockedSkills: async () => {
    try {
      // For now, return empty array since we don't have backend implementation
      // In the future, this would call: const skills = await invoke('get_unlocked_skills');
      const unlockedSkills: string[] = [];
      
      set(state => ({
        skills: {
          ...state.skills,
          unlockedSkills
        }
      }));
      
      logger.debug('Unlocked skills fetched successfully', { skillCount: unlockedSkills.length }, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch unlocked skills:', error);
      throw error;
    }
  },

  // ==================== PROJECT MANAGEMENT ====================

  fetchProjects: async (status?: string) => {
    set(state => ({
      projects: { ...state.projects, loading: true }
    }));

    try {
      const projects: Project[] = await invoke('get_projects', { status });

      set(() => ({
        projects: {
          all: projects,
          loading: false
        }
      }));

      logger.debug('Projects fetched successfully', { projectCount: projects.length }, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      set(state => ({
        projects: { ...state.projects, loading: false }
      }));
      throw error;
    }
  },

  unlockSkill: async (skillId: string): Promise<User> => {
    try {
      // For now, simulate skill unlock by spending skill points
      // In the future, this would call: const updatedUser = await invoke('unlock_skill', { skillId });
      
      const currentState = get();
      const user = currentState.user;
      const skills = currentState.skills;
      
      if (!user) {
        throw new Error('User not found');
      }

      if (skills.availablePoints <= 0) {
        throw new Error('Not enough skill points');
      }

      // Mock implementation: Add skill to unlocked list and decrease skill points
      set(state => ({
        skills: {
          ...state.skills,
          availablePoints: state.skills.availablePoints - 1,
          unlockedSkills: [...state.skills.unlockedSkills, skillId]
        }
      }));
      
      logger.info('Skill unlocked successfully', { skillId }, 'GameStore');
      return user;
    } catch (error) {
      console.error('Failed to unlock skill:', error);
      throw error;
    }
  },

  createProject: async (projectData: CreateProjectRequest): Promise<Project> => {
    try {
      const project: Project = await invoke('create_project', { projectData });

      // Refresh projects list
      await get().fetchProjects();

      logger.info('Project created successfully', { projectName: project.name }, 'GameStore');
      logUserAction('create_project', { projectId: project.id, name: project.name });

      notificationService.notifySuccess(`Project "${project.name}" created!`);

      return project;
    } catch (error) {
      console.error('Failed to create project:', error);
      notificationService.notifyError('Failed to create project');
      throw error;
    }
  },

  updateProject: async (projectId: number, projectData: CreateProjectRequest): Promise<Project> => {
    try {
      const project: Project = await invoke('update_project', { projectId, projectData });

      // Refresh projects list
      await get().fetchProjects();

      logger.info('Project updated successfully', { projectId, name: project.name }, 'GameStore');
      logUserAction('update_project', { projectId, name: project.name });

      notificationService.notifySuccess(`Project "${project.name}" updated!`);

      return project;
    } catch (error) {
      console.error('Failed to update project:', error);
      notificationService.notifyError('Failed to update project');
      throw error;
    }
  },

  deleteProject: async (projectId: number) => {
    try {
      await invoke('delete_project', { projectId });

      // Refresh projects list
      await get().fetchProjects();
      // Refresh tasks to show unassigned tasks
      await get().fetchTasks();

      logger.info('Project deleted successfully', { projectId }, 'GameStore');
      logUserAction('delete_project', { projectId });

      notificationService.notifySuccess('Project deleted successfully');
    } catch (error) {
      console.error('Failed to delete project:', error);
      notificationService.notifyError('Failed to delete project');
      throw error;
    }
  },

  assignTaskToProject: async (taskId: number, projectId: number | null) => {
    try {
      await invoke('assign_task_to_project', { taskId, projectId });

      // Refresh both tasks and projects to update counts
      await get().fetchTasks();
      await get().fetchProjects();

      logger.info('Task assigned to project', { taskId, projectId }, 'GameStore');
      logUserAction('assign_task_to_project', { taskId, projectId });

      notificationService.notifySuccess(
        projectId ? 'Task assigned to project' : 'Task removed from project'
      );
    } catch (error) {
      console.error('Failed to assign task to project:', error);
      notificationService.notifyError('Failed to assign task');
      throw error;
    }
  },

  // ==================== TIMER ACTIONS ====================

  startTimer: async (taskId: number, sessionType?: 'focus' | 'break' | 'pomodoro'): Promise<ActiveTimer> => {
    set(state => ({ timer: { ...state.timer, loading: true } }));
    try {
      const timer: ActiveTimer = await invoke('start_timer', { taskId, sessionType });
      set(state => ({
        timer: {
          ...state.timer,
          active: timer,
          loading: false
        }
      }));

      logger.info('Timer started', { taskId, sessionType }, 'GameStore');
      logUserAction('start_timer', { taskId, sessionType });
      notificationService.notifySuccess(`Timer started for ${sessionType || 'focus'} session`);

      return timer;
    } catch (error) {
      console.error('Failed to start timer:', error);
      set(state => ({ timer: { ...state.timer, loading: false } }));
      notificationService.notifyError(error instanceof Error ? error.message : 'Failed to start timer');
      throw error;
    }
  },

  pauseTimer: async (): Promise<ActiveTimer> => {
    set(state => ({ timer: { ...state.timer, loading: true } }));
    try {
      const timer: ActiveTimer = await invoke('pause_timer');
      set(state => ({
        timer: {
          ...state.timer,
          active: timer,
          loading: false
        }
      }));

      logger.info('Timer paused', {}, 'GameStore');
      logUserAction('pause_timer', {});
      notificationService.notifySuccess('Timer paused');

      return timer;
    } catch (error) {
      console.error('Failed to pause timer:', error);
      set(state => ({ timer: { ...state.timer, loading: false } }));
      notificationService.notifyError(error instanceof Error ? error.message : 'Failed to pause timer');
      throw error;
    }
  },

  stopTimer: async (notes?: string): Promise<TimeSession> => {
    set(state => ({ timer: { ...state.timer, loading: true } }));
    try {
      const session: TimeSession = await invoke('stop_timer', { notes });
      set(state => ({
        timer: {
          ...state.timer,
          active: null,
          sessions: [session, ...state.timer.sessions],
          loading: false
        }
      }));

      // Refresh tasks to update time spent
      await get().fetchTasks();

      const durationMinutes = session.duration_seconds ? Math.round(session.duration_seconds / 60) : 0;
      logger.info('Timer stopped', { sessionId: session.id, durationMinutes }, 'GameStore');
      logUserAction('stop_timer', { sessionId: session.id, durationMinutes });
      notificationService.notifySuccess(`Session completed! ${durationMinutes} minutes logged`);

      return session;
    } catch (error) {
      console.error('Failed to stop timer:', error);
      set(state => ({ timer: { ...state.timer, loading: false } }));
      notificationService.notifyError(error instanceof Error ? error.message : 'Failed to stop timer');
      throw error;
    }
  },

  getActiveTimer: async (): Promise<ActiveTimer | null> => {
    try {
      const timer: ActiveTimer | null = await invoke('get_active_timer');
      set(state => ({ timer: { ...state.timer, active: timer } }));
      return timer;
    } catch (error) {
      console.error('Failed to get active timer:', error);
      throw error;
    }
  },

  fetchTimeSessions: async (taskId?: number, limit?: number) => {
    set(state => ({ timer: { ...state.timer, loading: true } }));
    try {
      const sessions: TimeSession[] = await invoke('get_time_sessions', { taskId, limit });
      set(state => ({
        timer: {
          ...state.timer,
          sessions,
          loading: false
        }
      }));
      logger.debug('Time sessions fetched', { count: sessions.length }, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch time sessions:', error);
      set(state => ({ timer: { ...state.timer, loading: false } }));
      throw error;
    }
  },

  fetchTimeStats: async (taskId?: number) => {
    set(state => ({ timer: { ...state.timer, loading: true } }));
    try {
      const stats: TimeStats = await invoke('get_time_stats', { taskId });
      set(state => ({
        timer: {
          ...state.timer,
          stats,
          loading: false
        }
      }));
      logger.debug('Time stats fetched', stats, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch time stats:', error);
      set(state => ({ timer: { ...state.timer, loading: false } }));
      throw error;
    }
  },

  updateEstimatedTime: async (taskId: number, estimatedMinutes: number) => {
    try {
      await invoke('update_estimated_time', { taskId, estimatedMinutes });

      // Refresh tasks to show updated estimate
      await get().fetchTasks();

      logger.info('Estimated time updated', { taskId, estimatedMinutes }, 'GameStore');
      logUserAction('update_estimated_time', { taskId, estimatedMinutes });
      notificationService.notifySuccess(`Estimated time set to ${estimatedMinutes} minutes`);
    } catch (error) {
      console.error('Failed to update estimated time:', error);
      notificationService.notifyError('Failed to update estimated time');
      throw error;
    }
  },

  // ==================== NOTIFICATION ACTIONS ====================

  fetchNotificationPreferences: async () => {
    set(state => ({ notifications: { ...state.notifications, loading: true } }));
    try {
      const preferences: NotificationPreferences = await invoke('get_notification_preferences');
      set(state => ({
        notifications: {
          ...state.notifications,
          preferences,
          loading: false
        }
      }));
      logger.debug('Notification preferences fetched', {}, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch notification preferences:', error);
      set(state => ({ notifications: { ...state.notifications, loading: false } }));
      throw error;
    }
  },

  updateNotificationPreferences: async (prefs: UpdateNotificationPreferencesRequest) => {
    set(state => ({ notifications: { ...state.notifications, loading: true } }));
    try {
      const updatedPreferences: NotificationPreferences = await invoke('update_notification_preferences', { prefs });
      set(state => ({
        notifications: {
          ...state.notifications,
          preferences: updatedPreferences,
          loading: false
        }
      }));

      logger.info('Notification preferences updated', prefs, 'GameStore');
      logUserAction('update_notification_preferences', prefs);
      notificationService.notifySuccess('Notification preferences updated');
    } catch (error) {
      console.error('Failed to update notification preferences:', error);
      set(state => ({ notifications: { ...state.notifications, loading: false } }));
      notificationService.notifyError('Failed to update notification preferences');
      throw error;
    }
  },

  scheduleNotification: async (notification: CreateNotificationRequest): Promise<ScheduledNotification> => {
    try {
      const scheduledNotification: ScheduledNotification = await invoke('schedule_notification', {
        notificationData: notification
      });

      // Refresh scheduled notifications
      await get().fetchScheduledNotifications('pending');

      logger.info('Notification scheduled', { type: notification.notification_type }, 'GameStore');
      logUserAction('schedule_notification', { type: notification.notification_type });

      return scheduledNotification;
    } catch (error) {
      console.error('Failed to schedule notification:', error);
      notificationService.notifyError('Failed to schedule notification');
      throw error;
    }
  },

  cancelNotification: async (notificationId: number) => {
    try {
      await invoke('cancel_notification', { notificationId });

      // Refresh scheduled notifications
      await get().fetchScheduledNotifications();

      logger.info('Notification cancelled', { notificationId }, 'GameStore');
      logUserAction('cancel_notification', { notificationId });
      notificationService.notifySuccess('Notification cancelled');
    } catch (error) {
      console.error('Failed to cancel notification:', error);
      notificationService.notifyError('Failed to cancel notification');
      throw error;
    }
  },

  snoozeNotification: async (notificationId: number, snoozeMinutes: number) => {
    try {
      await invoke('snooze_notification', { notificationId, snoozeMinutes });

      // Refresh scheduled notifications
      await get().fetchScheduledNotifications();

      logger.info('Notification snoozed', { notificationId, snoozeMinutes }, 'GameStore');
      logUserAction('snooze_notification', { notificationId, snoozeMinutes });
      notificationService.notifySuccess(`Notification snoozed for ${snoozeMinutes} minutes`);
    } catch (error) {
      console.error('Failed to snooze notification:', error);
      notificationService.notifyError('Failed to snooze notification');
      throw error;
    }
  },

  markNotificationActioned: async (historyId: number, action: 'dismissed' | 'snoozed' | 'completed' | 'opened') => {
    try {
      await invoke('mark_notification_actioned', { historyId, action });

      // Refresh notification history
      await get().fetchNotificationHistory();

      logger.info('Notification action marked', { historyId, action }, 'GameStore');
      logUserAction('mark_notification_actioned', { historyId, action });
    } catch (error) {
      console.error('Failed to mark notification action:', error);
      throw error;
    }
  },

  markNotificationSent: async (notificationId: number) => {
    try {
      await invoke('mark_notification_sent', { notificationId });
      logger.info('Notification marked as sent', { notificationId }, 'GameStore');
    } catch (error) {
      console.error('Failed to mark notification sent:', error);
      throw error;
    }
  },

  fetchScheduledNotifications: async (status?: 'pending' | 'sent' | 'cancelled' | 'snoozed') => {
    set(state => ({ notifications: { ...state.notifications, loading: true } }));
    try {
      const notifications: ScheduledNotification[] = await invoke('get_scheduled_notifications', { status });
      set(state => ({
        notifications: {
          ...state.notifications,
          scheduled: notifications,
          loading: false
        }
      }));
      logger.debug('Scheduled notifications fetched', { count: notifications.length }, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch scheduled notifications:', error);
      set(state => ({ notifications: { ...state.notifications, loading: false } }));
      throw error;
    }
  },

  fetchNotificationHistory: async (limit?: number) => {
    set(state => ({ notifications: { ...state.notifications, loading: true } }));
    try {
      const history: NotificationHistory[] = await invoke('get_notification_history', { limit });
      set(state => ({
        notifications: {
          ...state.notifications,
          history,
          loading: false
        }
      }));
      logger.debug('Notification history fetched', { count: history.length }, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch notification history:', error);
      set(state => ({ notifications: { ...state.notifications, loading: false } }));
      throw error;
    }
  },

  fetchPendingNotifications: async () => {
    set(state => ({ notifications: { ...state.notifications, loading: true } }));
    try {
      const pending: ScheduledNotification[] = await invoke('get_pending_notifications');
      set(state => ({
        notifications: {
          ...state.notifications,
          pending,
          loading: false
        }
      }));
      logger.debug('Pending notifications fetched', { count: pending.length }, 'GameStore');
    } catch (error) {
      console.error('Failed to fetch pending notifications:', error);
      set(state => ({ notifications: { ...state.notifications, loading: false } }));
      throw error;
    }
  },
}));