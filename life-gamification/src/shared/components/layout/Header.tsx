import { Bell, Zap, Coins, Gem } from 'lucide-react'
import { useGameStore } from '../../../store/gameStore'

const Header = () => {
  const { user } = useGameStore();

  const gold = user?.gold || 0;
  const gems = user?.gems || 0;

  return (
    <header className="h-16 bg-solo-primary border-b border-gray-800 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold">Welcome back, Adventurer!</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Currencies */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="font-semibold">{gold.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Gem className="w-5 h-5 text-purple-500" />
            <span className="font-semibold">{gems.toLocaleString()}</span>
          </div>
        </div>

        {/* Streak Counter */}
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 rounded-lg border border-orange-500/30">
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-orange-500">0 Day Streak</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-solo-bg rounded-lg transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}

export default Header