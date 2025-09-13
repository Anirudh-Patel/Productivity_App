import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, Zap, Target, Clock, Flame, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useGameStore } from '../../../store/gameStore';
import { FadeIn } from './AnimatedComponents';

interface LiveStatsWidgetProps {
  className?: string;
}

interface DailyStats {
  tasksCompleted: number;
  xpEarned: number;
  streakDays: number;
  averageTime: number;
  productivityScore: number;
  trending: 'up' | 'down' | 'stable';
}

interface BackendDailyStats {
  id: number | null;
  user_id: number;
  date: string;
  tasks_completed: number;
  xp_earned: number;
  gold_earned: number;
  productivity_score: number;
}

const LiveStatsWidget = ({ className = '' }: LiveStatsWidgetProps) => {
  const { user, tasks } = useGameStore();
  const navigate = useNavigate();
  const [dailyStats, setDailyStats] = useState<DailyStats>({
    tasksCompleted: 0,
    xpEarned: 0,
    streakDays: 0,
    averageTime: 0,
    productivityScore: 0,
    trending: 'stable'
  });
  const [isAnimating, setIsAnimating] = useState(false);

  // Fetch daily stats from backend
  useEffect(() => {
    const fetchDailyStats = async () => {
      try {
        const backendStats: BackendDailyStats = await invoke('get_daily_stats');
        console.log('LiveStatsWidget fetched daily stats:', backendStats);
        
        // Calculate streak (simplified - would need backend support for accurate calculation)
        const streakDays = user?.streak_count || 0;
        
        // Calculate average completion time (mock for now)
        const averageTime = backendStats.tasks_completed > 0 ? Math.random() * 60 + 30 : 0;
        
        // Determine trending direction
        const trending = backendStats.productivity_score > 70 ? 'up' : backendStats.productivity_score < 30 ? 'down' : 'stable';

        const newStats: DailyStats = {
          tasksCompleted: backendStats.tasks_completed,
          xpEarned: backendStats.xp_earned,
          streakDays,
          averageTime,
          productivityScore: backendStats.productivity_score,
          trending
        };

        console.log('LiveStatsWidget converted stats:', newStats);
        setDailyStats(newStats);
      } catch (error) {
        console.error('Failed to fetch daily stats:', error);
      }
    };

    fetchDailyStats();
    
    // Update stats every 30 seconds
    const interval = setInterval(fetchDailyStats, 30000);
    
    return () => {
      clearInterval(interval);
    };
  }, [user]);

  // Trigger animation when stats change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 600);
    return () => clearTimeout(timer);
  }, [dailyStats]);

  const StatItem = ({ 
    icon: Icon, 
    label, 
    value, 
    color, 
    trend, 
    animate = false 
  }: { 
    icon: any; 
    label: string; 
    value: string | number; 
    color: string; 
    trend?: 'up' | 'down' | 'stable'; 
    animate?: boolean;
  }) => (
    <div className={`relative p-4 rounded-lg bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 ${
      animate && isAnimating ? 'animate-pulse' : ''
    } hover:border-gray-600 transition-all duration-300`}>
      <div className="flex items-center justify-between mb-2">
        <Icon className={`w-5 h-5 ${color}`} />
        {trend && (
          <div className={`flex items-center ${
            trend === 'up' ? 'text-green-400' : 
            trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend === 'stable' && <Activity className="w-3 h-3" />}
          </div>
        )}
      </div>
      <div className={`text-2xl font-bold ${color} ${animate && isAnimating ? 'scale-110' : ''} transition-transform duration-300`}>
        {value}
      </div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
      
      {/* Animated background pulse for high values */}
      {animate && dailyStats.productivityScore > 80 && (
        <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/10 to-orange-400/10 rounded-lg animate-pulse" />
      )}
    </div>
  );

  const getProductivityColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStreakColor = (days: number) => {
    if (days >= 30) return 'text-purple-400';
    if (days >= 14) return 'text-blue-400';
    if (days >= 7) return 'text-green-400';
    if (days >= 3) return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <FadeIn className={className}>
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="w-6 h-6 text-theme-accent" />
            Live Performance
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            Real-time
          </div>
        </div>
        
        {/* Debug info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mb-4 p-2 bg-gray-800/50 rounded text-xs">
            <div>Backend Daily Stats System</div>
            <div>Today: {new Date().toDateString()}</div>
            <div>Last fetch: {Date.now()}</div>
            <div>Stats: T:{dailyStats.tasksCompleted}, XP:{dailyStats.xpEarned}, Score:{dailyStats.productivityScore.toFixed(1)}</div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatItem
            icon={Target}
            label="Today's Quests"
            value={dailyStats.tasksCompleted}
            color="text-blue-400"
            trend={dailyStats.trending}
            animate={true}
          />
          
          <StatItem
            icon={Star}
            label="XP Earned"
            value={dailyStats.xpEarned}
            color="text-yellow-400"
            animate={true}
          />
          
          <StatItem
            icon={Flame}
            label="Streak Days"
            value={dailyStats.streakDays}
            color={getStreakColor(dailyStats.streakDays)}
            trend={dailyStats.streakDays > 0 ? 'up' : 'stable'}
          />
          
          <StatItem
            icon={Clock}
            label="Avg. Time"
            value={`${dailyStats.averageTime.toFixed(0)}m`}
            color="text-purple-400"
          />
        </div>

        {/* Productivity Score Progress Bar */}
        <div className="mt-6 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className={`w-5 h-5 ${getProductivityColor(dailyStats.productivityScore)}`} />
              <span className="font-medium">Productivity Score</span>
            </div>
            <span className={`text-lg font-bold ${getProductivityColor(dailyStats.productivityScore)}`}>
              {dailyStats.productivityScore.toFixed(0)}%
            </span>
          </div>
          
          <div className="relative w-full bg-gray-700 rounded-full h-3 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${
                dailyStats.productivityScore >= 80 ? 'bg-gradient-to-r from-green-400 to-green-500' :
                dailyStats.productivityScore >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' :
                dailyStats.productivityScore >= 40 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                'bg-gradient-to-r from-red-400 to-red-500'
              } ${isAnimating ? 'animate-pulse' : ''}`}
              style={{ width: `${Math.min(100, dailyStats.productivityScore)}%` }}
            >
              {dailyStats.productivityScore > 80 && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent animate-pulse" />
              )}
            </div>
          </div>
          
          {/* Score interpretation */}
          <div className="mt-2 text-xs text-gray-400">
            {dailyStats.productivityScore >= 80 && "🔥 On fire! Incredible productivity!"}
            {dailyStats.productivityScore >= 60 && dailyStats.productivityScore < 80 && "✨ Great momentum! Keep it up!"}
            {dailyStats.productivityScore >= 40 && dailyStats.productivityScore < 60 && "📈 Building momentum..."}
            {dailyStats.productivityScore < 40 && "🌱 Every journey begins with a single step"}
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 flex gap-2">
          <button 
            onClick={() => navigate('/stats')}
            className="flex-1 bg-theme-accent/10 hover:bg-theme-accent/20 text-theme-accent px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View Detailed Stats
          </button>
          <button className="flex-1 bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors">
            Export Data
          </button>
        </div>
      </div>
    </FadeIn>
  );
};

export default LiveStatsWidget;