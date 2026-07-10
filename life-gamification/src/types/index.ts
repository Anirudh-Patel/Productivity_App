// Recurring quest types
export interface RecurrencePattern {
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number; // e.g., every 2 days, every 3 weeks
  weekdays?: number[]; // For weekly: [0,1,2,3,4,5,6] where 0 = Sunday
  month_day?: number; // For monthly: day of month (1-31)
  end_date?: string; // Optional end date
  max_completions?: number; // Optional completion limit
}

// Quest chain types
export interface QuestChain {
  id: string;
  title: string;
  description: string;
  theme: string;
  total_quests: number;
  completed_quests: number;
  is_completed: boolean;
  story_text?: string;
  unlock_requirements?: {
    level?: number;
    completed_chains?: string[];
    achievements?: number[];
  };
}

// Quest template types
export interface QuestTemplate {
  id: string;
  name: string;
  category: string;
  difficulty: number;
  title_template: string;
  description_template: string;
  variables?: Record<string, string[]>; // Variable options for customization
  default_duration?: number; // In minutes
  tags: string[];
}

// Database types matching Rust structs
export interface User {
  id: number;
  username: string;
  level: number;
  experience_points: number;
  experience_to_next_level: number;
  strength: number;
  intelligence: number;
  endurance: number;
  charisma: number;
  luck: number;
  current_health: number;
  max_health: number;
  gold: number;
  theme_preference: string;
  active_title?: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  base_experience_reward: number;
  gold_reward: number;
  due_date?: string;
  status: 'active' | 'completed' | 'failed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  completed_at?: string;
  task_type: 'simple' | 'goal' | 'recurring';
  goal_target?: number;
  goal_current?: number;
  goal_unit?: string;
  tags?: string[];
  // Recurring quest fields
  recurrence_pattern?: string | RecurrencePattern;
  next_due_date?: string;
  current_streak?: number;
  best_streak?: number;
  total_completions?: number;
  // Quest chain fields
  chain_id?: string;
  chain_order?: number;
  is_chain_completed?: boolean;
  // Additional properties for advanced task management
  experience?: number; // Legacy support
  // Project grouping
  project_id?: number;
  // Time tracking
  estimated_time_minutes?: number;
  total_time_spent_seconds?: number;
  last_worked_at?: string;
  // Notification reminders
  reminder_enabled?: boolean;
  reminder_minutes_before?: number;
  custom_reminder_times?: string;
  last_reminder_sent_at?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  category?: string;
  difficulty?: number;
  due_date?: string;
  priority?: number;
  task_type?: 'standard' | 'goal' | 'recurring';
  goal_target?: number;
  goal_unit?: string;
  // Recurring quest fields
  recurrence_pattern?: RecurrencePattern;
  // Quest chain fields
  chain_id?: string;
  chain_order?: number;
  // Project grouping
  project_id?: number;
}

export interface Achievement {
  id: number;
  name: string;
  description: string;
  icon: string;
  requirements_type: string;
  requirements_value: number;
  experience_reward: number;
  gold_reward: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export interface UserAchievement {
  id: number;
  user_id: number;
  achievement_id: number;
  achievement: Achievement;
  unlocked_at: string;
}

export interface Streak {
  id: number;
  user_id: number;
  streak_type: string;
  current_count: number;
  longest_count: number;
  last_completion_date?: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  item_type: 'consumable' | 'title' | 'upgrade';
  effect?: string;
  quantity: number;
  max_stack: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: string;
  obtained_at: string;
}

export interface Buff {
  id: string;
  name: string;
  buff_type: string;
  value: number;
  stat_type?: string;
  duration_minutes: number;
  applied_at: string;
  expires_at: string;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  color: string; // Hex color code
  icon: string; // Emoji icon
  status: 'active' | 'completed' | 'archived';
  due_date?: string;
  priority: number;
  total_tasks: number;
  completed_tasks: number;
  total_xp_earned: number;
  created_at: string;
  completed_at?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  due_date?: string;
  priority?: number;
}

export interface TimeSession {
  id: number;
  task_id: number;
  user_id: number;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
  session_type: 'focus' | 'break' | 'manual' | 'pomodoro';
  is_completed: boolean;
  notes?: string;
  tags?: string;
  created_at: string;
}

export interface ActiveTimer {
  id: number;
  task_id: number;
  user_id: number;
  session_id: number;
  start_time: string;
  is_paused: boolean;
  paused_at?: string;
  total_paused_seconds: number;
  created_at: string;
}

export interface TimeStats {
  total_seconds: number;
  total_sessions: number;
  focus_seconds: number;
  break_seconds: number;
  pomodoro_sessions: number;
}

export interface NotificationPreferences {
  id: number;
  user_id: number;
  due_reminders_enabled: boolean;
  reminder_minutes_before: number;
  overdue_alerts_enabled: boolean;
  recurring_reminders_enabled: boolean;
  daily_agenda_enabled: boolean;
  daily_agenda_time: string;
  weekly_planning_enabled: boolean;
  weekly_planning_time: string;
  achievement_notifications_enabled: boolean;
  streak_notifications_enabled: boolean;
  timer_notifications_enabled: boolean;
  timer_reminder_minutes: number;
  quiet_hours_enabled: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  sound_enabled: boolean;
  priority_filter: string;
  created_at: string;
  updated_at: string;
}

export interface ScheduledNotification {
  id: number;
  user_id: number;
  task_id?: number;
  notification_type: 'due_soon' | 'due_tomorrow' | 'overdue' | 'recurring_created' | 'task_starting' | 'daily_agenda' | 'weekly_planning' | 'achievement' | 'streak_risk' | 'timer_reminder';
  title: string;
  message: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'cancelled' | 'snoozed';
  snoozed_until?: string;
  snooze_count: number;
  priority: 'low' | 'medium' | 'high';
  action_url?: string;
  created_at: string;
  sent_at?: string;
}

export interface NotificationHistory {
  id: number;
  user_id: number;
  task_id?: number;
  scheduled_notification_id?: number;
  notification_type: string;
  title: string;
  message: string;
  sent_at: string;
  action_taken?: 'dismissed' | 'snoozed' | 'completed' | 'opened' | 'none';
  action_taken_at?: string;
  priority?: string;
  created_at: string;
}

export interface CreateNotificationRequest {
  task_id?: number;
  notification_type: string;
  title: string;
  message: string;
  scheduled_for: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface UpdateNotificationPreferencesRequest {
  due_reminders_enabled?: boolean;
  reminder_minutes_before?: number;
  overdue_alerts_enabled?: boolean;
  recurring_reminders_enabled?: boolean;
  daily_agenda_enabled?: boolean;
  daily_agenda_time?: string;
  weekly_planning_enabled?: boolean;
  weekly_planning_time?: string;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  sound_enabled?: boolean;
}

// UI State types
export interface GameState {
  user: User | null;
  tasks: {
    active: Task[];
    completed: Task[];
    loading: boolean;
  };
  achievements: {
    unlocked: UserAchievement[];
    available: Achievement[];
    loading: boolean;
  };
  inventory: {
    items: InventoryItem[];
    loading: boolean;
  };
  buffs: {
    active: Buff[];
    loading: boolean;
  };
  skills: {
    availablePoints: number;
    unlockedSkills: string[];
    loading: boolean;
  };
  projects: {
    all: Project[];
    loading: boolean;
  };
  timer: {
    active: ActiveTimer | null;
    sessions: TimeSession[];
    stats: TimeStats | null;
    loading: boolean;
  };
  notifications: {
    preferences: NotificationPreferences | null;
    scheduled: ScheduledNotification[];
    history: NotificationHistory[];
    pending: ScheduledNotification[];
    loading: boolean;
  };
  streak: Streak | null;

  // Actions
  fetchUser: () => Promise<void>;
  fetchTasks: (status?: string) => Promise<void>;
  createTask: (task: CreateTaskRequest) => Promise<Task>;
  completeTask: (taskId: number) => Promise<void>;
  updateTaskProgress: (taskId: number, progressAmount: number) => Promise<Task>;
  fetchAchievements: () => Promise<void>;
  checkAchievements: () => Promise<Achievement[]>;
  purchaseItem: (itemId: string, price: number) => Promise<User>;
  fetchInventory: () => Promise<void>;
  useItem: (itemId: string) => Promise<User>;
  getUserTitles: () => Promise<string[]>;
  equipTitle: (title: string) => Promise<User>;
  unequipTitle: () => Promise<User>;
  getRecommendedDifficulty: (taskCategory: string) => Promise<number>;
  getActiveBuffs: () => Promise<Buff[]>;
  applyBuff: (buffType: string, value: number, statType?: string, durationMinutes?: number) => Promise<Buff>;
  fetchSkillPoints: () => Promise<void>;
  fetchUnlockedSkills: () => Promise<void>;
  unlockSkill: (skillId: string) => Promise<User>;
  // Project actions
  fetchProjects: (status?: string) => Promise<void>;
  createProject: (project: CreateProjectRequest) => Promise<Project>;
  updateProject: (projectId: number, project: CreateProjectRequest) => Promise<Project>;
  deleteProject: (projectId: number) => Promise<void>;
  assignTaskToProject: (taskId: number, projectId: number | null) => Promise<void>;
  // Timer actions
  startTimer: (taskId: number, sessionType?: 'focus' | 'break' | 'pomodoro') => Promise<ActiveTimer>;
  pauseTimer: () => Promise<ActiveTimer>;
  stopTimer: (notes?: string) => Promise<TimeSession>;
  getActiveTimer: () => Promise<ActiveTimer | null>;
  fetchTimeSessions: (taskId?: number, limit?: number) => Promise<void>;
  fetchTimeStats: (taskId?: number) => Promise<void>;
  updateEstimatedTime: (taskId: number, estimatedMinutes: number) => Promise<void>;
  // Notification actions
  fetchNotificationPreferences: () => Promise<void>;
  updateNotificationPreferences: (prefs: UpdateNotificationPreferencesRequest) => Promise<void>;
  scheduleNotification: (notification: CreateNotificationRequest) => Promise<ScheduledNotification>;
  cancelNotification: (notificationId: number) => Promise<void>;
  snoozeNotification: (notificationId: number, snoozeMinutes: number) => Promise<void>;
  markNotificationActioned: (historyId: number, action: 'dismissed' | 'snoozed' | 'completed' | 'opened') => Promise<void>;
  markNotificationSent: (notificationId: number) => Promise<void>;
  fetchScheduledNotifications: (status?: 'pending' | 'sent' | 'cancelled' | 'snoozed') => Promise<void>;
  fetchNotificationHistory: (limit?: number) => Promise<void>;
  fetchPendingNotifications: () => Promise<void>;
}

export const DIFFICULTY_LEVELS = {
  1: { label: 'Trivial', color: 'text-gray-400', xp: '10-15' },
  2: { label: 'Very Easy', color: 'text-green-400', xp: '15-20' },
  3: { label: 'Easy', color: 'text-green-500', xp: '20-25' },
  4: { label: 'Medium-Easy', color: 'text-yellow-400', xp: '25-30' },
  5: { label: 'Medium', color: 'text-yellow-500', xp: '30-35' },
  6: { label: 'Medium-Hard', color: 'text-orange-400', xp: '35-40' },
  7: { label: 'Hard', color: 'text-orange-500', xp: '40-45' },
  8: { label: 'Very Hard', color: 'text-red-400', xp: '45-50' },
  9: { label: 'Extreme', color: 'text-red-500', xp: '50-55' },
  10: { label: 'Legendary', color: 'text-purple-500', xp: '55+' },
} as const;

export const RARITY_COLORS = {
  common: 'text-gray-300',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
} as const;