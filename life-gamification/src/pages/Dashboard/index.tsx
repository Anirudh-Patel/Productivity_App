import { Calendar, Target, TrendingUp, Award } from 'lucide-react'
import { useRenderPerformance } from '../../utils/performance'

const Dashboard = () => {
  // Performance monitoring
  useRenderPerformance('Dashboard', process.env.NODE_ENV === 'development');
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

      {/* Today's Quests */}
      <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
        <h2 className="text-xl font-semibold mb-4">Today's Quests</h2>
        <div className="text-center py-12 text-gray-400">
          <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No active quests yet</p>
          <p className="text-sm mt-2">Start by creating your first quest!</p>
        </div>
      </div>

      {/* Recent Achievements */}
      <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
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
    <div className="bg-solo-primary rounded-lg border border-gray-800 p-4">
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