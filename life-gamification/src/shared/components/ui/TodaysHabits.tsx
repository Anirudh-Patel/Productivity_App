import { useState, useEffect } from 'react';
import { Flame, CheckCircle2, Circle, Calendar } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import { invoke } from '@tauri-apps/api/core';
import type { Task } from '../../../types';

interface TodaysHabitsProps {
  onTaskCompleted?: () => void;
}

export const TodaysHabits = ({ onTaskCompleted }: TodaysHabitsProps) => {
  const { tasks, completeTask, fetchTasks } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [generatingInstances, setGeneratingInstances] = useState(false);

  // Filter for today's recurring task instances. The store keeps tasks split
  // into active/completed lists; today's habits can live in either.
  const today = new Date().toISOString().split('T')[0];
  const todaysHabits = [...tasks.active, ...tasks.completed].filter(
    (task: Task) =>
      (task as any).parent_recurring_task_id != null &&
      (task as any).instance_date === today
  );

  // Generate recurring instances on mount
  useEffect(() => {
    const generateInstances = async () => {
      setGeneratingInstances(true);
      try {
        await invoke('generate_recurring_instances');
        await fetchTasks();
      } catch (error) {
        console.error('Failed to generate recurring instances:', error);
      } finally {
        setGeneratingInstances(false);
      }
    };

    generateInstances();
  }, []);

  const handleCompleteHabit = async (taskId: number) => {
    setLoading(true);
    try {
      await completeTask(taskId);
      await fetchTasks();
      onTaskCompleted?.();
    } catch (error) {
      console.error('Failed to complete habit:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 30) return 'text-purple-500';
    if (streak >= 7) return 'text-orange-500';
    return 'text-gray-400';
  };

  const getStreakMultiplier = (streak: number) => {
    if (streak >= 30) return '3x XP';
    if (streak >= 7) return '2x XP';
    return '';
  };

  if (generatingInstances) {
    return (
      <div className="bg-theme-primary rounded-lg p-6 border-2 border-gray-700">
        <div className="flex items-center gap-2 text-gray-400">
          <Calendar className="w-5 h-5 animate-pulse" />
          <span>Generating today's habits...</span>
        </div>
      </div>
    );
  }

  if (todaysHabits.length === 0) {
    return (
      <div className="bg-theme-primary rounded-lg p-6 border-2 border-gray-700">
        <h3 className="text-lg font-bold text-theme-fg mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Today's Habits
        </h3>
        <p className="text-gray-400 text-sm">
          No recurring habits for today. Create a recurring task to build consistency!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-theme-primary rounded-lg p-6 border-2 border-gray-700">
      <h3 className="text-lg font-bold text-theme-fg mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        Today's Habits
        <span className="text-sm font-normal text-gray-400 ml-auto">
          {todaysHabits.filter(h => h.status === 'completed').length}/{todaysHabits.length} completed
        </span>
      </h3>

      <div className="space-y-3">
        {todaysHabits.map((habit) => {
          const streak = habit.current_streak || 0;
          const longestStreak = habit.longest_streak || 0;
          const multiplier = getStreakMultiplier(streak);
          const isCompleted = habit.status === 'completed';

          return (
            <div
              key={habit.id}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                isCompleted
                  ? 'bg-green-900/20 border-green-700'
                  : 'bg-theme-bg border-gray-700 hover:border-theme-accent'
              }`}
            >
              {/* Completion button */}
              <button
                onClick={() => !isCompleted && handleCompleteHabit(habit.id)}
                disabled={loading || isCompleted}
                className={`flex-shrink-0 transition-colors ${
                  isCompleted
                    ? 'text-green-500 cursor-default'
                    : 'text-gray-500 hover:text-theme-accent cursor-pointer'
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Circle className="w-6 h-6" />
                )}
              </button>

              {/* Habit info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4
                    className={`font-medium truncate ${
                      isCompleted ? 'text-gray-500 line-through' : 'text-theme-fg'
                    }`}
                  >
                    {habit.title}
                  </h4>
                  {multiplier && (
                    <span className="text-xs bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded">
                      {multiplier}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{habit.category}</p>
              </div>

              {/* Streak indicator */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Flame className={`w-4 h-4 ${getStreakColor(streak)}`} />
                <div className="text-right">
                  <div className={`text-sm font-bold ${getStreakColor(streak)}`}>
                    {streak}
                  </div>
                  {longestStreak > streak && (
                    <div className="text-[10px] text-gray-500">
                      Best: {longestStreak}
                    </div>
                  )}
                </div>
              </div>

              {/* XP reward */}
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-bold text-blue-400">
                  +{habit.base_experience_reward}
                </div>
                <div className="text-[10px] text-gray-500">XP</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Streak legend */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-orange-500" />
            <span>7+ days = 2x XP</span>
          </div>
          <div className="flex items-center gap-1">
            <Flame className="w-3 h-3 text-purple-500" />
            <span>30+ days = 3x XP</span>
          </div>
        </div>
      </div>
    </div>
  );
};
