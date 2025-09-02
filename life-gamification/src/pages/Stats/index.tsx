import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar, Award, Target, Zap } from 'lucide-react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell 
} from 'recharts';
import { useGameStore } from '../../store/gameStore';
import { useRenderPerformance } from '../../utils/performance';
import { FadeIn } from '../../shared/components/ui/AnimatedComponents';

// Generate realistic progress data based on completed tasks
const generateProgressData = (completedTasks: any[], timeRange: '7d' | '30d' | '90d') => {
  const days = [];
  const today = new Date();
  const numDays = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
  
  for (let i = numDays - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Calculate tasks completed on this day (mock for now)
    const tasksForDay = Math.floor(Math.random() * 6);
    const xpForDay = tasksForDay * (25 + Math.floor(Math.random() * 30));
    
    days.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      fullDate: date.toISOString().split('T')[0],
      xp: xpForDay,
      tasksCompleted: tasksForDay,
      avgDifficulty: tasksForDay > 0 ? Math.floor(Math.random() * 5) + 3 : 0
    });
  }
  
  return days;
};

const generateCategoryData = (completedTasks: any[]) => {
  // Count tasks by category (mock categories for now)
  const categories = ['work', 'health', 'learning', 'personal', 'general'];
  const categoryCounts = categories.map(category => ({
    name: category.charAt(0).toUpperCase() + category.slice(1),
    value: Math.floor(Math.random() * 30) + 10,
    color: {
      work: '#3B82F6',
      health: '#10B981', 
      learning: '#8B5CF6',
      personal: '#F59E0B',
      general: '#EF4444'
    }[category] || '#6B7280'
  }));
  
  return categoryCounts;
};

const generateDifficultyBreakdown = (completedTasks: any[]) => {
  return [
    { difficulty: 'Easy (1-3)', count: Math.floor(Math.random() * 20) + 10, color: '#10B981' },
    { difficulty: 'Medium (4-6)', count: Math.floor(Math.random() * 15) + 8, color: '#F59E0B' },
    { difficulty: 'Hard (7-10)', count: Math.floor(Math.random() * 8) + 3, color: '#EF4444' },
  ];
};

const Stats = () => {
  useRenderPerformance('Stats', process.env.NODE_ENV === 'development');
  
  const { user, tasks, achievements } = useGameStore();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [progressData, setProgressData] = useState(() => generateProgressData(tasks.completed, timeRange));
  const [categoryData] = useState(() => generateCategoryData(tasks.completed));
  const [difficultyData] = useState(() => generateDifficultyBreakdown(tasks.completed));

  // Recalculate data when time range changes
  useEffect(() => {
    setProgressData(generateProgressData(tasks.completed, timeRange));
  }, [timeRange, tasks.completed]);

  // Calculate real statistics
  const totalXPThisWeek = progressData.slice(-7).reduce((sum, day) => sum + day.xp, 0);
  const completedTasksThisWeek = progressData.slice(-7).reduce((sum, day) => sum + day.tasksCompleted, 0);
  const averageDifficulty = tasks.completed.length > 0 
    ? (tasks.completed.reduce((sum, task) => sum + (task.difficulty || 5), 0) / tasks.completed.length).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Statistics</h1>
          <p className="text-gray-400">Analyze your progress and performance</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range as any)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                timeRange === range
                  ? 'bg-solo-accent/20 text-solo-accent border border-solo-accent/30'
                  : 'bg-solo-primary text-gray-400 hover:text-solo-text border border-gray-800'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <FadeIn delay={0}>
          <StatCard
            icon={<TrendingUp className="w-6 h-6" />}
            label="Total XP"
            value={user?.experience_points?.toLocaleString() || '0'}
            color="text-blue-500"
            bgColor="bg-blue-500/20"
            change={`+${totalXPThisWeek} this week`}
          />
        </FadeIn>
        <FadeIn delay={100}>
          <StatCard
            icon={<Target className="w-6 h-6" />}
            label="Quests Completed"
            value={tasks.completed.length.toString()}
            color="text-green-500"
            bgColor="bg-green-500/20"
            change={`+${completedTasksThisWeek} this week`}
          />
        </FadeIn>
        <FadeIn delay={200}>
          <StatCard
            icon={<Zap className="w-6 h-6" />}
            label="Current Level"
            value={user?.level?.toString() || '1'}
            color="text-purple-500"
            bgColor="bg-purple-500/20"
            change={`Avg difficulty: ${averageDifficulty}`}
          />
        </FadeIn>
        <FadeIn delay={300}>
          <StatCard
            icon={<Award className="w-6 h-6" />}
            label="Achievements"
            value="12 / 50"
            color="text-orange-500"
            bgColor="bg-orange-500/20"
            change={`${achievements?.unlocked?.length || 0} unlocked`}
          />
        </FadeIn>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* XP Progress Chart */}
        <FadeIn delay={400}>
          <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              XP Progress
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={progressData}>
                  <defs>
                    <linearGradient id="xpGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="xp"
                    stroke="#3B82F6"
                    fillOpacity={1}
                    fill="url(#xpGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>

        {/* Category Distribution */}
        <FadeIn delay={500}>
          <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              Quest Categories
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              {categoryData.map((category) => (
                <div key={category.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-sm text-gray-400">{category.name} ({category.value}%)</span>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Difficulty Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FadeIn delay={550}>
          <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-red-500" />
              Difficulty Breakdown
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={difficultyData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    type="number"
                    stroke="#9CA3AF"
                    fontSize={12}
                  />
                  <YAxis 
                    type="category"
                    dataKey="difficulty"
                    stroke="#9CA3AF"
                    fontSize={12}
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#F9FAFB'
                    }}
                  />
                  <Bar dataKey="count" fill={(entry) => entry.color} radius={[0, 4, 4, 0]}>
                    {difficultyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </FadeIn>

        {/* Performance Insights */}
        <FadeIn delay={600}>
          <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-cyan-500" />
              Performance Insights
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Completion Rate</span>
                <span className="text-green-400 font-semibold">
                  {tasks.completed.length > 0 && tasks.active.length > 0
                    ? `${Math.round((tasks.completed.length / (tasks.completed.length + tasks.active.length)) * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Most Productive Day</span>
                <span className="text-blue-400 font-semibold">
                  {progressData.reduce((max, day) => day.tasksCompleted > max.tasksCompleted ? day : max, progressData[0])?.date || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Total Hours Estimated</span>
                <span className="text-purple-400 font-semibold">
                  {Math.round(tasks.completed.length * 1.5 + tasks.active.length * 1.2)}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">XP per Task Average</span>
                <span className="text-yellow-400 font-semibold">
                  {tasks.completed.length > 0 
                    ? Math.round((user?.experience_points || 0) / tasks.completed.length)
                    : 0} XP
                </span>
              </div>
            </div>
            
            {/* Mini progress bars */}
            <div className="mt-6 space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">Level Progress</span>
                  <span className="text-solo-accent">
                    {user?.experience_to_next_level ? 
                      `${user.experience_points - (user.level - 1) * 1000}/${user.experience_to_next_level}` 
                      : '0/1000'}
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-solo-accent h-2 rounded-full transition-all duration-500" 
                    style={{ 
                      width: user?.experience_to_next_level 
                        ? `${((user.experience_points - (user.level - 1) * 1000) / user.experience_to_next_level) * 100}%`
                        : '0%'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Daily Activity Chart */}
      <FadeIn delay={600}>
        <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-green-500" />
            Daily Activity
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progressData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#F9FAFB'
                  }}
                />
                <Bar 
                  dataKey="tasksCompleted" 
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </FadeIn>

      {/* Achievement Timeline */}
      <FadeIn delay={700}>
        <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-orange-500" />
            Recent Achievements
          </h3>
          <div className="space-y-4">
            {[
              { title: "First Steps", description: "Complete your first quest", date: "2 days ago", icon: "🏆" },
              { title: "Goal Crusher", description: "Complete a goal-based quest", date: "1 day ago", icon: "🎯" },
              { title: "Consistency King", description: "Complete quests 3 days in a row", date: "6 hours ago", icon: "👑" },
            ].map((achievement, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-solo-bg rounded-lg border border-gray-700">
                <div className="text-2xl">{achievement.icon}</div>
                <div className="flex-1">
                  <h4 className="font-medium text-solo-text">{achievement.title}</h4>
                  <p className="text-sm text-gray-400">{achievement.description}</p>
                </div>
                <div className="text-xs text-gray-500">
                  {achievement.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* Streak Visualization */}
      <FadeIn delay={800}>
        <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" />
            Quest Streak
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Current Streak */}
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-500 mb-2">7</div>
              <p className="text-gray-400">Current Streak</p>
              <p className="text-xs text-gray-500 mt-1">Keep it up!</p>
            </div>
            
            {/* Streak Calendar */}
            <div>
              <p className="text-sm text-gray-400 mb-3">Last 14 days</p>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 14 }).map((_, i) => {
                  const hasActivity = Math.random() > 0.2; // Mock activity
                  return (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded border ${
                        hasActivity 
                          ? 'bg-green-500/30 border-green-500/50' 
                          : 'bg-gray-700/30 border-gray-700'
                      }`}
                      title={`Day ${i + 1}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Less</span>
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

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
    <div className="bg-solo-primary rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <div className={color}>{icon}</div>
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-gray-400 text-sm">{label}</p>
        {change && (
          <p className="text-xs text-green-400 mt-1">{change}</p>
        )}
      </div>
    </div>
  );
};

export default Stats