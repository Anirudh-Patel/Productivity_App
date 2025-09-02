import { Task, User } from '../types';

export interface DifficultyStats {
  completionRate: number;
  averageCompletionTime: number;
  streakLength: number;
  failureRate: number;
}

export interface DifficultyRecommendation {
  suggestedDifficulty: number;
  reason: string;
  confidenceLevel: number; // 0-1
}

// Analyze user's performance patterns
export const analyzeUserPerformance = (
  user: User,
  completedTasks: Task[],
  failedTasks: Task[] = []
): DifficultyStats => {
  if (completedTasks.length === 0) {
    return {
      completionRate: 0,
      averageCompletionTime: 0,
      streakLength: 0,
      failureRate: 0
    };
  }

  const totalTasks = completedTasks.length + failedTasks.length;
  const completionRate = totalTasks > 0 ? completedTasks.length / totalTasks : 0;
  const failureRate = totalTasks > 0 ? failedTasks.length / totalTasks : 0;

  // Calculate average completion time (mock - would use real timestamps)
  const averageCompletionTime = completedTasks.reduce((sum, task) => {
    // Mock calculation - in reality would compare created_at vs completed_at
    return sum + (task.difficulty * 0.5); // Rough estimate
  }, 0) / completedTasks.length;

  // Calculate current streak (simplified)
  let streakLength = 0;
  const recentTasks = completedTasks.slice(-10); // Last 10 tasks
  for (const task of recentTasks.reverse()) {
    if (task.status === 'completed') {
      streakLength++;
    } else {
      break;
    }
  }

  return {
    completionRate,
    averageCompletionTime,
    streakLength,
    failureRate
  };
};

// Generate difficulty recommendation based on performance
export const generateDifficultyRecommendation = (
  currentDifficulty: number,
  stats: DifficultyStats,
  userLevel: number
): DifficultyRecommendation => {
  let suggestedDifficulty = currentDifficulty;
  let reason = '';
  let confidenceLevel = 0.7;

  // High completion rate with good streak - increase difficulty
  if (stats.completionRate > 0.8 && stats.streakLength >= 5) {
    suggestedDifficulty = Math.min(10, currentDifficulty + 1);
    reason = 'High success rate - ready for greater challenges!';
    confidenceLevel = 0.9;
  }
  // Very high completion rate - significant increase
  else if (stats.completionRate > 0.95 && stats.streakLength >= 10) {
    suggestedDifficulty = Math.min(10, currentDifficulty + 2);
    reason = 'Exceptional performance - time to level up significantly!';
    confidenceLevel = 0.95;
  }
  // Low completion rate - decrease difficulty
  else if (stats.completionRate < 0.4 && stats.failureRate > 0.5) {
    suggestedDifficulty = Math.max(1, currentDifficulty - 1);
    reason = 'Tasks seem too challenging - let\'s build confidence with easier quests';
    confidenceLevel = 0.8;
  }
  // Very low completion rate - significant decrease
  else if (stats.completionRate < 0.2) {
    suggestedDifficulty = Math.max(1, currentDifficulty - 2);
    reason = 'Let\'s step back and build momentum with simpler tasks';
    confidenceLevel = 0.9;
  }
  // Moderate performance with short tasks - slight increase
  else if (stats.completionRate > 0.6 && stats.averageCompletionTime < 2) {
    suggestedDifficulty = Math.min(10, currentDifficulty + 1);
    reason = 'Completing tasks quickly - ready for more complexity';
    confidenceLevel = 0.6;
  }
  // Long completion times - slight decrease
  else if (stats.averageCompletionTime > 5) {
    suggestedDifficulty = Math.max(1, currentDifficulty - 1);
    reason = 'Tasks taking longer than expected - let\'s optimize difficulty';
    confidenceLevel = 0.7;
  }
  // Balanced performance - maintain current level
  else {
    reason = 'Performance is well-balanced at current difficulty';
    confidenceLevel = 0.8;
  }

  // Level-based adjustments
  const levelBasedMax = Math.min(10, Math.floor(userLevel / 2) + 3);
  if (suggestedDifficulty > levelBasedMax) {
    suggestedDifficulty = levelBasedMax;
    reason += ' (adjusted for current level)';
    confidenceLevel = Math.max(0.5, confidenceLevel - 0.2);
  }

  return {
    suggestedDifficulty,
    reason,
    confidenceLevel
  };
};

// Calculate dynamic XP rewards based on performance
export const calculateDynamicReward = (
  baseDifficulty: number,
  actualPerformance: 'excellent' | 'good' | 'average' | 'poor',
  streakMultiplier: number = 1
): { xpReward: number; goldReward: number; bonusReason?: string } => {
  const baseXP = baseDifficulty * 10;
  const baseGold = baseDifficulty * 5;

  let xpMultiplier = 1;
  let goldMultiplier = 1;
  let bonusReason = '';

  switch (actualPerformance) {
    case 'excellent':
      xpMultiplier = 1.5;
      goldMultiplier = 1.3;
      bonusReason = 'Excellent performance bonus!';
      break;
    case 'good':
      xpMultiplier = 1.2;
      goldMultiplier = 1.1;
      bonusReason = 'Good performance bonus!';
      break;
    case 'average':
      xpMultiplier = 1;
      goldMultiplier = 1;
      break;
    case 'poor':
      xpMultiplier = 0.8;
      goldMultiplier = 0.9;
      bonusReason = 'Reduced rewards - but you still earned something!';
      break;
  }

  // Apply streak multiplier
  if (streakMultiplier > 1) {
    xpMultiplier *= streakMultiplier;
    goldMultiplier *= Math.min(1.5, streakMultiplier * 0.5);
    if (bonusReason) {
      bonusReason += ` Streak bonus: x${streakMultiplier.toFixed(1)}!`;
    } else {
      bonusReason = `Streak bonus: x${streakMultiplier.toFixed(1)}!`;
    }
  }

  return {
    xpReward: Math.round(baseXP * xpMultiplier),
    goldReward: Math.round(baseGold * goldMultiplier),
    bonusReason
  };
};

// Suggest optimal task categories based on performance
export const suggestOptimalCategories = (
  completedTasks: Task[]
): { category: string; successRate: number; averageDifficulty: number }[] => {
  const categoryStats = new Map<string, { completed: number; totalDifficulty: number }>();

  completedTasks.forEach(task => {
    const existing = categoryStats.get(task.category) || { completed: 0, totalDifficulty: 0 };
    categoryStats.set(task.category, {
      completed: existing.completed + 1,
      totalDifficulty: existing.totalDifficulty + task.difficulty
    });
  });

  return Array.from(categoryStats.entries())
    .map(([category, stats]) => ({
      category,
      successRate: stats.completed / (stats.completed), // Simplified - would need failed tasks too
      averageDifficulty: stats.totalDifficulty / stats.completed
    }))
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5); // Top 5 performing categories
};

// Auto-adjust task difficulty when creating new tasks
export const autoAdjustTaskDifficulty = (
  initialDifficulty: number,
  category: string,
  userStats: DifficultyStats,
  userLevel: number
): { adjustedDifficulty: number; adjustmentReason: string } => {
  const recommendation = generateDifficultyRecommendation(initialDifficulty, userStats, userLevel);
  
  let adjustedDifficulty = initialDifficulty;
  let adjustmentReason = '';

  // Apply small auto-adjustments based on recent performance
  if (recommendation.confidenceLevel > 0.8) {
    if (recommendation.suggestedDifficulty > initialDifficulty) {
      adjustedDifficulty = Math.min(initialDifficulty + 1, recommendation.suggestedDifficulty);
      adjustmentReason = 'Auto-adjusted up based on excellent recent performance';
    } else if (recommendation.suggestedDifficulty < initialDifficulty) {
      adjustedDifficulty = Math.max(initialDifficulty - 1, recommendation.suggestedDifficulty);
      adjustmentReason = 'Auto-adjusted down to optimize success rate';
    }
  }

  return { adjustedDifficulty, adjustmentReason };
};