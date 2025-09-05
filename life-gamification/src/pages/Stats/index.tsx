import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, Award, Target, Zap, Clock } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useRenderPerformance } from '../../utils/performance';
import { FadeIn, StaggeredList } from '../../shared/components/ui/AnimatedComponents';
import { 
  XPProgressChart, 
  TaskCategoryChart, 
  ActivityHeatmap, 
  DifficultyDistributionChart 
} from '../../shared/components/ui/Charts';
import { analyzeUserPerformance } from '../../utils/difficultyAdjustment';

// Helper function to get tasks within time range
const getTasksInTimeRange = (tasks: any[], timeRange: '7d' | '30d' | '90d' | 'all') => {
  if (timeRange === 'all') return tasks;
  
  const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return tasks.filter(task => {
    if (!task.completed_at) return false;
    return new Date(task.completed_at) >= cutoffDate;
  });
};

const Stats = () => {
  useRenderPerformance('Stats', process.env.NODE_ENV === 'development');
  
  const { user, tasks, achievements, fetchTasks, fetchAchievements } = useGameStore();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    fetchTasks();
    fetchAchievements();
  }, [fetchTasks, fetchAchievements]);

  const userStats = analyzeUserPerformance(
    user || {} as any,
    tasks.completed,
    []
  );

  const getTimeRangeInDays = () => {
    switch (timeRange) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
      case 'all': return 365;
      default: return 30;
    }
  };

  const completedTasksInRange = getTasksInTimeRange(tasks.completed, timeRange);
  
  const totalXPEarned = completedTasksInRange.reduce(
    (sum, task) => sum + task.base_experience_reward, 
    0
  );
  
  const totalGoldEarned = completedTasksInRange.reduce(
    (sum, task) => sum + task.gold_reward, 
    0
  );

  const averageDifficulty = completedTasksInRange.length > 0 
    ? completedTasksInRange.reduce((sum, task) => sum + task.difficulty, 0) / completedTasksInRange.length
    : 0;

  const categories = [...new Set(completedTasksInRange.map(task => task.category))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Statistics</h1>
          <p className="text-gray-400">Analyze your progress and performance</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {[
            { key: '7d', label: '7 Days' },
            { key: '30d', label: '30 Days' },
            { key: '90d', label: '90 Days' },
            { key: 'all', label: 'All Time' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTimeRange(key as any)}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                timeRange === key
                  ? 'bg-theme-accent text-white'
                  : 'bg-theme-primary text-gray-400 hover:text-theme-fg border border-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <FadeIn>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Target className="w-6 h-6" />}
            label="Quests Completed"
            value={completedTasksInRange.length.toString()}
            color="text-blue-500"
            bgColor="bg-blue-500/20"
            change={timeRange !== 'all' ? `In ${timeRange}` : 'All time'}
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Total XP Earned"
            value={totalXPEarned.toLocaleString()}
            color="text-green-500"
            bgColor="bg-green-500/20"
            change={timeRange !== 'all' ? `In ${timeRange}` : 'All time'}
          />
          <StatCard
            icon={<Award className="w-6 h-6" />}
            label="Gold Earned"
            value={totalGoldEarned.toLocaleString()}
            color="text-yellow-500"
            bgColor="bg-yellow-500/20"
            change={timeRange !== 'all' ? `In ${timeRange}` : 'All time'}
          />
          <StatCard
            icon={<BarChart3 className="w-6 h-6" />}
            label="Avg Difficulty"
            value={averageDifficulty.toFixed(1)}
            color="text-purple-500"
            bgColor="bg-purple-500/20"
            change={`Level ${Math.round(averageDifficulty)}`}
          />
        </div>
      </FadeIn>

      {/* Performance Overview */}
      <FadeIn delay={200}>
        <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-theme-accent" />
            Performance Overview
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <h3 className="font-medium text-gray-300">Completion Metrics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Overall Completion Rate</span>
                  <span className="text-sm font-medium text-green-400">
                    {(userStats.completionRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Active Streak</span>
                  <span className="text-sm font-medium text-yellow-400">
                    {userStats.streakLength} tasks
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Categories Explored</span>
                  <span className="text-sm font-medium text-blue-400">
                    {categories.length}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-medium text-gray-300">Productivity Insights</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">XP per Quest</span>
                  <span className="text-sm font-medium text-green-400">
                    {completedTasksInRange.length > 0 
                      ? Math.round(totalXPEarned / completedTasksInRange.length)
                      : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Gold per Quest</span>
                  <span className="text-sm font-medium text-yellow-400">
                    {completedTasksInRange.length > 0 
                      ? Math.round(totalGoldEarned / completedTasksInRange.length)
                      : 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Daily Average</span>
                  <span className="text-sm font-medium text-purple-400">
                    {timeRange !== 'all' 
                      ? (completedTasksInRange.length / getTimeRangeInDays()).toFixed(1)
                      : 'N/A'} tasks/day
                  </span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-medium text-gray-300">Achievement Progress</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Unlocked</span>
                  <span className="text-sm font-medium text-purple-400">
                    {achievements.unlocked.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Current Level</span>
                  <span className="text-sm font-medium text-blue-400">
                    {user?.level || 1}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Total XP</span>
                  <span className="text-sm font-medium text-green-400">
                    {user?.experience_points?.toLocaleString() || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={300}>
          <XPProgressChart 
            tasks={completedTasksInRange} 
            user={user}
            days={getTimeRangeInDays()}
          />
        </FadeIn>
        
        <FadeIn delay={400}>
          <TaskCategoryChart tasks={completedTasksInRange} />
        </FadeIn>
        
        <FadeIn delay={500}>
          <DifficultyDistributionChart tasks={completedTasksInRange} />
        </FadeIn>
        
        <FadeIn delay={600}>
          <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-theme-accent" />
              Recent Activity
            </h3>
            
            {completedTasksInRange.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No completed quests in this time range</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {completedTasksInRange
                  .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
                  .slice(0, 10)
                  .map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-theme-bg rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="text-xs text-gray-400 capitalize">
                          {task.category} • Level {task.difficulty}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-green-400">+{task.base_experience_reward} XP</div>
                        <div className="text-xs text-gray-400">
                          {new Date(task.completed_at!).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </FadeIn>
      </div>

      {/* Activity Heatmap */}
      <FadeIn delay={400}>
        <ActivityHeatmap 
          tasks={tasks.completed}
          days={getTimeRangeInDays()}
        />
      </FadeIn>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  bgColor: string;
  change?: string;
}

const StatCard = ({ icon, label, value, color, bgColor, change }: StatCardProps) => {
  return (
    <div className="bg-theme-primary rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change && (
            <p className="text-xs text-theme-accent mt-1">{change}</p>
          )}
        </div>
        <div className={`${bgColor} ${color} p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default Stats