import { Calendar, Target, TrendingUp, Award, Brain, Zap } from 'lucide-react'
import { useRenderPerformance } from '../../utils/performance'
import { useGameStore } from '../../store/gameStore'
import { analyzeUserPerformance, generateDifficultyRecommendation } from '../../utils/difficultyAdjustment'
import { FadeIn } from '../../shared/components/ui/AnimatedComponents'

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

      {/* Today's Quests */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Today's Quests</h2>
        <div className="text-center py-12 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active quests yet</p>
          <p className="text-sm mt-2">Start by creating your first quest!</p>
        </div>
      </div>

      {/* Recent Achievements */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Achievements</h2>
        <div className="text-center py-12 text-gray-400">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No achievements unlocked yet</p>
          <p className="text-sm mt-2">Complete quests to earn achievements!</p>
        </div>
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