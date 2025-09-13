import { useState, useEffect } from 'react';
import { Trophy, Star, Crown, Target, Zap, Award, ChevronRight, Lock } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import { FadeIn } from './AnimatedComponents';

interface AchievementProgress {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  icon: any;
  color: string;
  progress: number;
  maxProgress: number;
  unlocked: boolean;
  hint?: string;
}

const AchievementTracker = () => {
  const { user, tasks, achievements } = useGameStore();
  const [nearbyAchievements, setNearbyAchievements] = useState<AchievementProgress[]>([]);
  const [recentAchievements, setRecentAchievements] = useState<AchievementProgress[]>([]);

  useEffect(() => {
    // Calculate progress for various achievements
    const calculateAchievementProgress = () => {
      const totalCompleted = tasks.completed.length;
      const todayCompleted = tasks.completed.filter(task => {
        const today = new Date().toDateString();
        return task.completed_at && new Date(task.completed_at).toDateString() === today;
      }).length;
      const currentLevel = user?.level || 1;
      const currentStreak = user?.streak_count || 0;

      // Mock achievements with real progress calculations
      const mockAchievements: AchievementProgress[] = [
        {
          id: 'first_steps',
          name: 'First Steps',
          description: 'Complete your first quest',
          category: 'progression',
          rarity: 'common',
          icon: Target,
          color: 'text-green-400',
          progress: Math.min(1, totalCompleted),
          maxProgress: 1,
          unlocked: totalCompleted >= 1,
          hint: totalCompleted === 0 ? 'Complete any task to unlock!' : undefined
        },
        {
          id: 'daily_warrior',
          name: 'Daily Warrior',
          description: 'Complete 5 quests in a single day',
          category: 'daily',
          rarity: 'uncommon',
          icon: Zap,
          color: 'text-blue-400',
          progress: Math.min(5, todayCompleted),
          maxProgress: 5,
          unlocked: todayCompleted >= 5,
          hint: todayCompleted < 5 ? `Complete ${5 - todayCompleted} more today!` : undefined
        },
        {
          id: 'quest_master',
          name: 'Quest Master',
          description: 'Complete 50 total quests',
          category: 'milestone',
          rarity: 'rare',
          icon: Award,
          color: 'text-purple-400',
          progress: Math.min(50, totalCompleted),
          maxProgress: 50,
          unlocked: totalCompleted >= 50,
          hint: totalCompleted < 50 ? `${50 - totalCompleted} more to go!` : undefined
        },
        {
          id: 'streak_legend',
          name: 'Streak Legend',
          description: 'Maintain a 30-day streak',
          category: 'consistency',
          rarity: 'epic',
          icon: Crown,
          color: 'text-yellow-400',
          progress: Math.min(30, currentStreak),
          maxProgress: 30,
          unlocked: currentStreak >= 30,
          hint: currentStreak < 30 ? `Keep the streak alive! ${30 - currentStreak} days to go` : undefined
        },
        {
          id: 'level_master',
          name: 'Ascension',
          description: 'Reach level 25',
          category: 'leveling',
          rarity: 'legendary',
          icon: Star,
          color: 'text-orange-400',
          progress: Math.min(25, currentLevel),
          maxProgress: 25,
          unlocked: currentLevel >= 25,
          hint: currentLevel < 25 ? `${25 - currentLevel} levels remaining` : undefined
        }
      ];

      // Separate into nearby (close to completion) and recently unlocked
      const nearby = mockAchievements
        .filter(achievement => !achievement.unlocked && achievement.progress > 0)
        .sort((a, b) => (b.progress / b.maxProgress) - (a.progress / a.maxProgress))
        .slice(0, 3);

      const recent = achievements.unlocked
        .slice(-3)
        .reverse()
        .map(ach => ({
          id: ach.achievement_id.toString(),
          name: ach.name || 'Achievement Unlocked',
          description: ach.description || 'You did something awesome!',
          category: 'unlocked',
          rarity: 'common' as const,
          icon: Trophy,
          color: 'text-theme-accent',
          progress: 1,
          maxProgress: 1,
          unlocked: true
        }));

      setNearbyAchievements(nearby);
      setRecentAchievements(recent);
    };

    calculateAchievementProgress();
  }, [tasks, user, achievements.unlocked]);

  const getRarityStyle = (rarity: string) => {
    switch (rarity) {
      case 'legendary':
        return 'from-yellow-500 to-orange-500';
      case 'epic':
        return 'from-purple-500 to-pink-500';
      case 'rare':
        return 'from-blue-500 to-cyan-500';
      case 'uncommon':
        return 'from-green-500 to-teal-500';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const AchievementCard = ({ achievement, showProgress = true }: { 
    achievement: AchievementProgress; 
    showProgress?: boolean;
  }) => {
    const Icon = achievement.icon;
    const progressPercentage = (achievement.progress / achievement.maxProgress) * 100;

    return (
      <div className={`relative p-4 rounded-lg border transition-all duration-300 ${
        achievement.unlocked 
          ? `bg-gradient-to-r ${getRarityStyle(achievement.rarity)} text-white shadow-lg`
          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
      }`}>
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              achievement.unlocked 
                ? 'bg-white/20'
                : 'bg-gray-700'
            }`}>
              {achievement.unlocked ? (
                <Icon className="w-5 h-5" />
              ) : (
                <Lock className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div>
              <h3 className={`font-semibold text-sm ${
                achievement.unlocked ? 'text-white' : 'text-gray-200'
              }`}>
                {achievement.name}
              </h3>
              <p className={`text-xs ${
                achievement.unlocked ? 'text-white/80' : 'text-gray-400'
              } line-clamp-2`}>
                {achievement.description}
              </p>
            </div>
          </div>
          
          <div className={`text-xs px-2 py-1 rounded-full ${
            achievement.unlocked 
              ? 'bg-white/20 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}>
            {achievement.rarity.toUpperCase()}
          </div>
        </div>

        {showProgress && !achievement.unlocked && (
          <>
            <div className="mb-2">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-gray-400">Progress</span>
                <span className={achievement.color}>
                  {achievement.progress}/{achievement.maxProgress}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div 
                  className={`h-full bg-gradient-to-r ${getRarityStyle(achievement.rarity)} transition-all duration-500`}
                  style={{ width: `${progressPercentage}%` }}
                >
                  {progressPercentage > 80 && (
                    <div className="h-full bg-gradient-to-r from-white/30 to-transparent animate-pulse" />
                  )}
                </div>
              </div>
            </div>
            
            {achievement.hint && (
              <div className="text-xs text-gray-400 italic">
                💡 {achievement.hint}
              </div>
            )}
          </>
        )}

        {achievement.unlocked && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
            <Crown className="w-3 h-3 text-yellow-900" />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Nearly Complete Achievements */}
      <FadeIn>
        <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              Almost There
            </h2>
            <div className="text-xs text-gray-400">
              Close to completion
            </div>
          </div>

          {nearbyAchievements.length > 0 ? (
            <div className="space-y-3">
              {nearbyAchievements.map((achievement) => (
                <AchievementCard key={achievement.id} achievement={achievement} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400">
              <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Keep working on your quests!</p>
              <p className="text-xs mt-1">Achievements will appear here as you make progress</p>
            </div>
          )}
        </div>
      </FadeIn>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <FadeIn delay={200}>
          <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="w-5 h-5 text-theme-accent" />
                Recent Victories
              </h2>
              <button className="text-xs text-theme-accent hover:underline flex items-center gap-1">
                View All
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {recentAchievements.map((achievement) => (
                <AchievementCard 
                  key={achievement.id} 
                  achievement={achievement} 
                  showProgress={false}
                />
              ))}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
};

export default AchievementTracker;