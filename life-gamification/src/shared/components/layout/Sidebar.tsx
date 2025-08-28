import { NavLink } from 'react-router-dom'
import { 
  Home, 
  CheckSquare, 
  BarChart3, 
  ShoppingBag, 
  Settings,
  Swords,
  Trophy
} from 'lucide-react'

const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/tasks', label: 'Quests', icon: CheckSquare },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/shop', label: 'Shop', icon: ShoppingBag },
  { path: '/settings', label: 'Settings', icon: Settings },
]

const Sidebar = () => {
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
              <p className="text-lg font-bold">1</p>
            </div>
          </div>
          
          {/* XP Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>XP</span>
              <span>0 / 100</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-solo-accent to-solo-secondary transition-all duration-500"
                style={{ width: '0%' }}
              />
            </div>
          </div>

          {/* Health Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>HP</span>
              <span>100 / 100</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-500"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Energy Bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Energy</span>
              <span>100 / 100</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-yellow-500 to-yellow-400 transition-all duration-500"
                style={{ width: '100%' }}
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