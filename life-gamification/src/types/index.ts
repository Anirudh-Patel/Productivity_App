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
  current_energy: number;
  max_energy: number;
  gold: number;
  gems: number;
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
  energy_cost: number;
  created_at: string;
  completed_at?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  category?: string;
  difficulty?: number;
  due_date?: string;
  priority?: number;
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
  fetchAchievements: () => Promise<void>;
  checkAchievements: () => Promise<Achievement[]>;
}

export const DIFFICULTY_LEVELS = {
  1: { label: 'Trivial', color: 'text-gray-400', xp: '10-15', energy: 5 },
  2: { label: 'Very Easy', color: 'text-green-400', xp: '15-20', energy: 8 },
  3: { label: 'Easy', color: 'text-green-500', xp: '20-25', energy: 12 },
  4: { label: 'Medium-Easy', color: 'text-yellow-400', xp: '25-30', energy: 15 },
  5: { label: 'Medium', color: 'text-yellow-500', xp: '30-35', energy: 20 },
  6: { label: 'Medium-Hard', color: 'text-orange-400', xp: '35-40', energy: 25 },
  7: { label: 'Hard', color: 'text-orange-500', xp: '40-45', energy: 30 },
  8: { label: 'Very Hard', color: 'text-red-400', xp: '45-50', energy: 35 },
  9: { label: 'Extreme', color: 'text-red-500', xp: '50-55', energy: 40 },
  10: { label: 'Legendary', color: 'text-purple-500', xp: '55+', energy: 50 },
} as const;

export const RARITY_COLORS = {
  common: 'text-gray-300',
  uncommon: 'text-green-400',
  rare: 'text-blue-400',
  epic: 'text-purple-400',
  legendary: 'text-orange-400',
} as const;