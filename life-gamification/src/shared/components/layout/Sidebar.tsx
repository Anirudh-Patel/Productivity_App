import { NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { 
  Home, 
  CheckSquare, 
  BarChart3, 
  ShoppingBag, 
  Settings,
  Swords,
  Trophy
} from 'lucide-react'
import { useGameStore } from '../../../store/gameStore'

const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/tasks', label: 'Quests', icon: CheckSquare },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/shop', label: 'Shop', icon: ShoppingBag },
  { path: '/settings', label: 'Settings', icon: Settings },
]

const Sidebar = () => {
  const { user, fetchUser } = useGameStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const userLevel = user?.level || 1;
  const currentXP = user?.experience_points || 0;
  const xpToNext = user?.experience_to_next_level || 100;
  const currentHP = user?.current_health || 100;
  const maxHP = user?.max_health || 100;

  const xpPercent = Math.max(0, Math.min(100, (currentXP / (currentXP + xpToNext)) * 100));
  const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));

  return (
    <aside className="w-64 bg-solo-primary border-r border-gray-800">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <Swords className="w-8 h-8 text-solo-accent" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-solo-accent to-solo-secondary bg-clip-text text-transparent">
            Life Quest
          </h1>
        </div>

        {/* User Status */}
        <div className="mb-8 p-4 bg-solo-bg rounded-lg border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-solo-accent to-solo-secondary flex items-center justify-center">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Level</p>
              <p className="text-lg font-bold">{userLevel}</p>
            </div>
          </div>
          
          {/* XP Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>XP</span>
              <span>{currentXP} / {currentXP + xpToNext}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-solo-accent to-solo-secondary transition-all duration-500"
                style={{ width: `${xpPercent}%` }}
              />
            </div>
          </div>

          {/* Health Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>HP</span>
              <span>{currentHP} / {maxHP}</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
                style={{ width: `${hpPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-solo-accent/20 text-solo-accent'
                    : 'hover:bg-solo-bg text-gray-400 hover:text-solo-text'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar