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
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  category: string;
  difficulty: number;
  base_experience_reward: number;
  gold_reward: number;
  due_date?: string;
  status: 'active' | 'completed' | 'failed' | 'archived';
  priority: number;
  created_at: string;
  completed_at?: string;
  task_type: 'standard' | 'goal' | 'recurring';
  goal_target?: number;
  goal_current?: number;
  goal_unit?: string;
  // Recurring quest fields
  recurrence_pattern?: RecurrencePattern;
  next_due_date?: string;
  current_streak?: number;
  best_streak?: number;
  total_completions?: number;
  // Quest chain fields
  chain_id?: string;
  chain_order?: number;
  is_chain_completed?: boolean;
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
  streak: Streak | null;
  
  // Actions
  fetchUser: () => Promise<void>;
  fetchTasks: (status?: string) => Promise<void>;
  createTask: (task: CreateTaskRequest) => Promise<Task>;
  completeTask: (taskId: number) => Promise<void>;
  updateTaskProgress: (taskId: number, progressAmount: number) => Promise<Task>;
  fetchAchievements: () => Promise<void>;
  checkAchievements: () => Promise<Achievement[]>;
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