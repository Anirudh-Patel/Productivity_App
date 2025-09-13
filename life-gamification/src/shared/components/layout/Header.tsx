import { Zap, Coins, Menu } from 'lucide-react'
import { useGameStore } from '../../../store/gameStore'
import NotificationsDropdown from '../ui/NotificationsDropdown'

interface HeaderProps {
  onToggleSidebar?: () => void;
}

const Header = ({ onToggleSidebar }: HeaderProps) => {
  const { user } = useGameStore();

  const gold = user?.gold || 0;

  return (
    <header className="h-16 bg-theme-primary border-b border-gray-800 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-2 hover:bg-theme-bg rounded-lg transition-colors md:hidden"
            title="Toggle sidebar (Ctrl + \)"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        <h2 className="text-xl font-semibold">Welcome back, Adventurer!</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Currency */}
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold">{gold.toLocaleString()}</span>
        </div>

        {/* Streak Counter */}
        <div className="flex items-center gap-2 px-3 py-1 bg-orange-500/20 rounded-lg border border-orange-500/30">
          <Zap className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-orange-500">0 Day Streak</span>
        </div>

        {/* Notifications */}
        <NotificationsDropdown />
      </div>
    </header>
  )
}

export default Header