import { Calendar, Target, TrendingUp, Award, Brain, Zap, BarChart3 } from 'lucide-react'
import { useRenderPerformance } from '../../utils/performance'
import { useGameStore } from '../../store/gameStore'
import { analyzeUserPerformance, generateDifficultyRecommendation } from '../../utils/difficultyAdjustment'
import { FadeIn } from '../../shared/components/ui/AnimatedComponents'
import { XPProgressChart, TaskCategoryChart, ActivityHeatmap } from '../../shared/components/ui/Charts'

const Dashboard = () => {
  // Performance monitoring
  useRenderPerformance('Dashboard', process.env.NODE_ENV === 'development');
  
  const { user, tasks } = useGameStore();
  
  // Analyze user performance for dynamic difficulty
  const userStats = analyzeUserPerformance(
    user || {} as any,
    tasks.completed,
    [] // Would need failed tasks from store
  );
  
  const difficultyRecommendation = generateDifficultyRecommendation(
    5, // Current average difficulty
    userStats,
    user?.level || 1
  );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">Track your progress and conquer your daily quests</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Target className="w-6 h-6" />}
          label="Today's Quests"
          value="0 / 5"
          color="text-blue-500"
          bgColor="bg-blue-500/20"
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6" />}
          label="XP Today"
          value="0"
          color="text-green-500"
          bgColor="bg-green-500/20"
        />
        <StatCard
          icon={<Award className="w-6 h-6" />}
          label="Achievements"
          value="0 / 50"
          color="text-purple-500"
          bgColor="bg-purple-500/20"
        />
        <StatCard
          icon={<Calendar className="w-6 h-6" />}
          label="Active Days"
          value="0"
          color="text-orange-500"
          bgColor="bg-orange-500/20"
        />
      </div>

      {/* Dynamic Difficulty Insights */}
      <FadeIn delay={400}>
        <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-500" />
            Performance Insights
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Stats */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-300">Your Performance</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Completion Rate</span>
                  <span className="text-sm font-medium text-green-400">
                    {(userStats.completionRate * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Current Streak</span>
                  <span className="text-sm font-medium text-yellow-400">
                    {userStats.streakLength} tasks
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Tasks Completed</span>
                  <span className="text-sm font-medium text-blue-400">
                    {tasks.completed.length}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Difficulty Recommendation */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-300">Smart Recommendations</h3>
              <div className="p-3 bg-theme-bg rounded-lg border border-gray-700">
                <div className="flex items-start gap-2 mb-2">
                  <Zap className="w-4 h-4 text-theme-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-theme-accent mb-1">
                      Suggested Difficulty: Level {difficultyRecommendation.suggestedDifficulty}
                    </div>
                    <div className="text-xs text-gray-400">
                      {difficultyRecommendation.reason}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div 
                      className="bg-theme-accent h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${difficultyRecommendation.confidenceLevel * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {(difficultyRecommendation.confidenceLevel * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Today's Progress */}
      <FadeIn delay={300}>
        <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Target className="w-6 h-6 text-theme-accent" />
            Today's Progress
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Quests */}
            <div>
              <h3 className="font-medium text-gray-300 mb-3">Active Quests</h3>
              {tasks.active.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active quests</p>
                  <p className="text-xs mt-1">Create your first quest to get started!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tasks.active.slice(0, 5).map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-theme-bg rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="text-xs text-gray-400 capitalize flex items-center gap-2">
                          <span>{task.category}</span>
                          <span>•</span>
                          <span>Level {task.difficulty}</span>
                          {task.task_type === 'goal' && task.goal_target && (
                            <>
                              <span>•</span>
                              <span>{task.goal_current || 0}/{task.goal_target}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-green-400">
                        +{task.base_experience_reward} XP
                      </div>
                    </div>
                  ))}
                  {tasks.active.length > 5 && (
                    <div className="text-center py-2">
                      <span className="text-xs text-gray-500">
                        +{tasks.active.length - 5} more quests
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Level Progress */}
            <div>
              <h3 className="font-medium text-gray-300 mb-3">Level Progress</h3>
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-theme-accent mb-1">
                    {user?.level || 1}
                  </div>
                  <p className="text-sm text-gray-400">Current Level</p>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-400">XP Progress</span>
                    <span className="text-theme-accent">
                      {user?.experience_points?.toLocaleString() || 0} XP
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-3">
                    <div 
                      className="bg-theme-accent h-3 rounded-full transition-all duration-500" 
                      style={{ 
                        width: user?.experience_to_next_level 
                          ? `${Math.min(100, ((user.experience_points % 1000) / (user.experience_to_next_level || 1000)) * 100)}%`
                          : '0%'
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Level {user?.level || 1}</span>
                    <span>
                      {user?.experience_to_next_level 
                        ? `${user.experience_to_next_level - (user.experience_points % 1000)} XP to next level`
                        : 'Max level reached'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 bg-theme-bg rounded-lg">
                    <div className="text-lg font-semibold text-yellow-400">{user?.gold || 0}</div>
                    <div className="text-xs text-gray-400">Gold</div>
                  </div>
                  <div className="text-center p-2 bg-theme-bg rounded-lg">
                    <div className="text-lg font-semibold text-green-400">
                      {tasks.completed.filter(task => {
                        const today = new Date().toDateString();
                        return task.completed_at && new Date(task.completed_at).toDateString() === today;
                      }).length}
                    </div>
                    <div className="text-xs text-gray-400">Today</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Active Buffs & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={400}>
          <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Active Effects
            </h3>
            
            {/* This would show active buffs when implemented */}
            <div className="text-center py-8 text-gray-400">
              <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active buffs</p>
              <p className="text-sm mt-2">Use consumables from your inventory to gain temporary boosts!</p>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={500}>
          <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              Smart Insights
            </h3>
            
            <div className="space-y-3">
              <div className="p-3 bg-theme-bg rounded-lg border border-gray-700">
                <div className="flex items-start gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-theme-accent mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-theme-accent mb-1">
                      Suggested Difficulty: Level {difficultyRecommendation.suggestedDifficulty}
                    </div>
                    <div className="text-xs text-gray-400">
                      {difficultyRecommendation.reason}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div 
                      className="bg-theme-accent h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${difficultyRecommendation.confidenceLevel * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">
                    {(difficultyRecommendation.confidenceLevel * 100).toFixed(0)}% confidence
                  </span>
                </div>
              </div>

              {tasks.active.length === 0 && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-blue-400 text-sm">
                    <Target className="w-4 h-4" />
                    <span>Ready to start your day? Create your first quest!</span>
                  </div>
                </div>
              )}

              {tasks.active.length > 3 && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-400 text-sm">
                    <Award className="w-4 h-4" />
                    <span>You have {tasks.active.length} active quests. Consider focusing on completing some before adding more.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  bgColor: string
}

const StatCard = ({ icon, label, value, color, bgColor }: StatCardProps) => {
  return (
    <div className="bg-theme-primary rounded-lg border border-gray-800 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`${bgColor} ${color} p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  )
}

export default Dashboard