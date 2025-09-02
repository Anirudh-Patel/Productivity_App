import { RecurrencePattern, Task } from '../types';
import { addDays, addWeeks, addMonths, format, isSameDay, isAfter } from 'date-fns';

export const calculateNextDueDate = (pattern: RecurrencePattern, lastCompletedDate?: Date): Date => {
  const baseDate = lastCompletedDate || new Date();
  
  switch (pattern.frequency) {
    case 'daily':
      return addDays(baseDate, pattern.interval);
    
    case 'weekly':
      const nextWeek = addWeeks(baseDate, pattern.interval);
      // If weekdays are specified, find the next occurrence
      if (pattern.weekdays && pattern.weekdays.length > 0) {
        const today = nextWeek.getDay();
        const nextWeekday = pattern.weekdays.find(day => day >= today) ?? pattern.weekdays[0];
        const daysToAdd = nextWeekday >= today ? nextWeekday - today : 7 - today + nextWeekday;
        return addDays(nextWeek, daysToAdd);
      }
      return nextWeek;
    
    case 'monthly':
      const nextMonth = addMonths(baseDate, pattern.interval);
      if (pattern.month_day) {
        nextMonth.setDate(pattern.month_day);
      }
      return nextMonth;
    
    case 'custom':
      // For custom patterns, just add the interval in days
      return addDays(baseDate, pattern.interval);
    
    default:
      return addDays(baseDate, 1);
  }
};

export const isQuestDueToday = (task: Task): boolean => {
  if (!task.next_due_date) return false;
  const dueDate = new Date(task.next_due_date);
  return isSameDay(dueDate, new Date()) || isAfter(new Date(), dueDate);
};

export const generateRecurringQuestTitle = (baseTitle: string, currentStreak: number = 0): string => {
  const streakSuffix = currentStreak > 0 ? ` (${currentStreak} day streak!)` : '';
  return `${baseTitle}${streakSuffix}`;
};

export const calculateStreakBonus = (currentStreak: number): number => {
  // Bonus XP increases with streak length
  if (currentStreak < 3) return 0;
  if (currentStreak < 7) return 5;
  if (currentStreak < 14) return 10;
  if (currentStreak < 30) return 20;
  return 30; // Max bonus for 30+ day streaks
};

export const getRecurringQuestIcon = (pattern: RecurrencePattern): string => {
  switch (pattern.frequency) {
    case 'daily': return '📅';
    case 'weekly': return '📄';
    case 'monthly': return '🗓️';
    case 'custom': return '🔄';
    default: return '🔄';
  }
};

export const formatRecurrencePattern = (pattern: RecurrencePattern): string => {
  switch (pattern.frequency) {
    case 'daily':
      return pattern.interval === 1 ? 'Every day' : `Every ${pattern.interval} days`;
    
    case 'weekly':
      if (pattern.weekdays && pattern.weekdays.length > 0) {
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = pattern.weekdays.map(day => dayNames[day]).join(', ');
        return `Every week on ${selectedDays}`;
      }
      return pattern.interval === 1 ? 'Every week' : `Every ${pattern.interval} weeks`;
    
    case 'monthly':
      if (pattern.month_day) {
        return `Every month on day ${pattern.month_day}`;
      }
      return pattern.interval === 1 ? 'Every month' : `Every ${pattern.interval} months`;
    
    case 'custom':
      return `Every ${pattern.interval} days (custom)`;
    
    default:
      return 'Unknown pattern';
  }
};

export const createDefaultRecurrencePatterns = (): Record<string, RecurrencePattern> => ({
  daily: {
    frequency: 'daily',
    interval: 1
  },
  weekdays: {
    frequency: 'weekly',
    interval: 1,
    weekdays: [1, 2, 3, 4, 5] // Monday through Friday
  },
  weekly: {
    frequency: 'weekly',
    interval: 1
  },
  biweekly: {
    frequency: 'weekly',
    interval: 2
  },
  monthly: {
    frequency: 'monthly',
    interval: 1
  }
});

// Mock function to simulate backend quest renewal
export const renewRecurringQuest = (task: Task): Task => {
  if (task.task_type !== 'recurring' || !task.recurrence_pattern) {
    return task;
  }

  const nextDueDate = calculateNextDueDate(task.recurrence_pattern, new Date());
  
  return {
    ...task,
    id: task.id + Math.floor(Math.random() * 1000), // Generate new ID for renewed quest
    status: 'active' as const,
    next_due_date: format(nextDueDate, 'yyyy-MM-dd'),
    completed_at: undefined,
    // Reset goal progress if it's a goal-based recurring quest
    goal_current: task.task_type === 'goal' ? 0 : task.goal_current,
  };
};