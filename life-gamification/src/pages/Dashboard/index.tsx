import { useEffect } from 'react'
import { Target, TrendingUp, Brain, Zap, BarChart3, User, MapPin, Activity } from 'lucide-react'
import { useRenderPerformance } from '../../utils/performance'
import { useGameStore } from '../../store/gameStore'
import { useCharacterSkinStore } from '../../store/characterSkinStore'
import { analyzeUserPerformance, generateDifficultyRecommendation } from '../../utils/difficultyAdjustment'
import { FadeIn } from '../../shared/components/ui/AnimatedComponents'
import { LayeredSprite } from '../../shared/components/ui/LayeredSprite'
import QuickStartWidget from '../../shared/components/ui/QuickStartWidget'
import AchievementTracker from '../../shared/components/ui/AchievementTracker'
import NotificationDemo from '../../shared/components/ui/NotificationDemo'
import { TodaysHabits } from '../../shared/components/ui/TodaysHabits'
import { UpcomingEventsWidget } from '../../shared/components/ui/UpcomingEventsWidget'

const Dashboard = () => {
  // Performance monitoring
  useRenderPerformance('Dashboard', process.env.NODE_ENV === 'development');
  
  const { user, tasks } = useGameStore();

  // Character skin (display preference) for the dashboard avatar card.
  const skins = useCharacterSkinStore((s) => s.skins);
  const selectedId = useCharacterSkinStore((s) => s.selectedId);
  const gear = useCharacterSkinStore((s) => s.gear);
  const equippedGear = useCharacterSkinStore((s) => s.equippedGear);
  const loadManifest = useCharacterSkinStore((s) => s.loadManifest);
  const selectedSkin = selectedId ? skins.find((s) => s.id === selectedId) ?? null : null;
  const equippedGearItems = selectedSkin
    ? gear.filter((g) => equippedGear[g.slot] === g.id)
    : [];

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);


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
      {/* Header Section with Welcome Message */}
      <FadeIn>
        <div className="bg-gradient-to-r from-theme-primary via-gray-800 to-theme-primary rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Selected character skin avatar — only shown when a skin is chosen */}
              {selectedSkin && (
                <div className="flex flex-col items-center gap-1 rounded-lg border border-gray-700 bg-theme-bg/60 px-3 py-2 shrink-0">
                  <LayeredSprite skin={selectedSkin} gear={equippedGearItems} scale={2} />
                  <span className="text-[10px] text-gray-400 max-w-[6rem] truncate">
                    Lv {user?.level || 1}
                  </span>
                </div>
              )}
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                <User className="w-8 h-8 text-theme-accent" />
                Welcome back, {user?.username || 'Adventurer'}!
              </h1>
              <p className="text-gray-400 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Ready to embark on today's epic quests? Level {user?.level || 1} • {user?.gold || 0} Gold
              </p>
            </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-theme-accent">{user?.experience_points || 0} XP</div>
              <div className="text-sm text-gray-400">Total Experience</div>
            </div>
          </div>
          
          {/* Quick level progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Level Progress</span>
              <span className="text-theme-accent">
                {user?.experience_to_next_level 
                  ? `${user.experience_to_next_level} XP to Level ${(user.level || 1) + 1}`
                  : 'Max level reached'}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-theme-accent to-blue-400 h-2 rounded-full transition-all duration-500" 
                style={{ 
                  width: user?.experience_to_next_level 
                    ? `${Math.min(100, (1 - (user.experience_to_next_level / 1000)) * 100)}%`
                    : '100%'
                }}
              />
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Today's Habits Widget */}
      <FadeIn delay={200}>
        <TodaysHabits />
      </FadeIn>

      {/* Upcoming Events Widget */}
      <FadeIn delay={300}>
        <UpcomingEventsWidget maxEvents={5} />
      </FadeIn>

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

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Quick Actions */}
        <div className="xl:col-span-1 space-y-6">
          <QuickStartWidget />
          
          {/* Active Quests Summary */}
          <FadeIn delay={300}>
            <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-theme-accent" />
                Active Quests
              </h3>
              
              {tasks.active.length === 0 ? (
                <div className="text-center py-6 text-gray-400">
                  <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active quests</p>
                  <p className="text-xs mt-1">Use Quick Start above!</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {tasks.active.slice(0, 4).map((task) => (
                    <div key={task.id} className="flex items-center justify-between p-3 bg-theme-bg rounded-lg hover:bg-gray-800/70 transition-colors">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{task.title}</div>
                        <div className="text-xs text-gray-400 capitalize flex items-center gap-2">
                          <span>{task.category}</span>
                          <span>•</span>
                          <span>Level {task.difficulty}</span>
                        </div>
                      </div>
                      <div className="text-xs text-green-400 font-medium">
                        +{task.base_experience_reward} XP
                      </div>
                    </div>
                  ))}
                  {tasks.active.length > 4 && (
                    <div className="text-center py-2">
                      <button className="text-xs text-theme-accent hover:underline">
                        +{tasks.active.length - 4} more quests
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </FadeIn>
        </div>
        
        {/* Right Column - Analytics and Achievements */}
        <div className="xl:col-span-2 space-y-6">
          <AchievementTracker />
        </div>
      </div>

      {/* AI Insights Section */}
      <FadeIn delay={400}>
        <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-500" />
            AI Insights & Recommendations
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Difficulty Recommendation */}
            <div className="p-4 bg-theme-bg rounded-lg border border-gray-700">
              <div className="flex items-start gap-2 mb-3">
                <TrendingUp className="w-5 h-5 text-theme-accent mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-theme-accent mb-1">
                    Optimal Difficulty: Level {difficultyRecommendation.suggestedDifficulty}
                  </div>
                  <div className="text-xs text-gray-400">
                    {difficultyRecommendation.reason}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div 
                    className="bg-theme-accent h-2 rounded-full transition-all duration-500"
                    style={{ width: `${difficultyRecommendation.confidenceLevel * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {(difficultyRecommendation.confidenceLevel * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Performance Analysis */}
            <div className="p-4 bg-theme-bg rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-5 h-5 text-green-400" />
                <span className="text-sm font-medium text-green-400">Performance</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Completion Rate</span>
                  <span className="text-green-400">{(userStats.completionRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Current Streak</span>
                  <span className="text-yellow-400">{userStats.streakLength}</span>
                </div>
              </div>
            </div>

            {/* Smart Suggestions */}
            <div className="p-4 bg-theme-bg rounded-lg border border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-yellow-400" />
                <span className="text-sm font-medium text-yellow-400">Suggestions</span>
              </div>
              <div className="space-y-2">
                {tasks.active.length === 0 && (
                  <div className="text-xs text-blue-400">
                    🚀 Ready to start? Try a Quick Start quest!
                  </div>
                )}
                {tasks.active.length > 5 && (
                  <div className="text-xs text-orange-400">
                    ⚡ Focus mode: Complete active quests before adding more
                  </div>
                )}
                {userStats.completionRate > 0.8 && (
                  <div className="text-xs text-green-400">
                    🔥 You're on fire! Consider increasing difficulty
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
      
      {/* Notification Demo - Development Only */}
      {process.env.NODE_ENV === 'development' && (
        <FadeIn delay={600}>
          <NotificationDemo />
        </FadeIn>
      )}
    </div>
  )
}

export default Dashboard