import { NavLink } from 'react-router-dom'
import { useEffect } from 'react'
import { 
  Home, 
  CheckSquare, 
  BarChart3, 
  ShoppingBag, 
  Settings,
  Swords,
  Shield
} from 'lucide-react'
import { useGameStore } from '../../../store/gameStore'
import { SkeletonProgressBar, SkeletonText } from '../../components/ui/Skeleton'
import { AnimatedProgressBar } from '../../components/ui/AnimatedComponents'
import { AvatarCanvas } from '../../../features/avatar/components/AvatarCanvas/AvatarCanvas'
import { useAvatarStore } from '../../../store/slices/avatarSlice'

// Utility function to format large numbers with shorthand
const formatNumber = (num: number): string => {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 10000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

const navItems = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/tasks', label: 'Quests', icon: CheckSquare },
  { path: '/stats', label: 'Stats', icon: BarChart3 },
  { path: '/equipment', label: 'Equipment', icon: Shield },
  { path: '/shop', label: 'Shop', icon: ShoppingBag },
  { path: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean;
}

const Sidebar = ({ collapsed = false }: SidebarProps) => {
  const { user, fetchUser } = useGameStore();
  const { loadUserEquipment } = useAvatarStore();

  useEffect(() => {
    fetchUser();
    if (user?.id) {
      loadUserEquipment(user.id);
    }
  }, [fetchUser, loadUserEquipment, user?.id]);

  const userLevel = user?.level || 1;
  const currentXP = user?.experience_points || 0;
  const xpToNext = user?.experience_to_next_level || 100;
  const currentHP = user?.current_health || 100;
  const maxHP = user?.max_health || 100;

  const xpPercent = Math.max(0, Math.min(100, (currentXP / (currentXP + xpToNext)) * 100));
  const hpPercent = Math.max(0, Math.min(100, (currentHP / maxHP) * 100));

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} bg-theme-primary border-r border-gray-800 transition-all duration-300 relative`}>
      <div className={`${collapsed ? 'p-4' : 'p-6'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'} mb-8`}>
          <Swords className="w-8 h-8 text-theme-accent" />
          {!collapsed && (
            <h1 className="text-xl font-bold bg-gradient-to-r from-solo-accent to-solo-secondary bg-clip-text text-transparent">
              Life Quest
            </h1>
          )}
        </div>

        {/* User Status with Avatar */}
        {!collapsed && (
        <div className="mb-8 p-6 bg-theme-bg rounded-lg border border-gray-800">
          {!user ? (
            // Loading skeleton
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-32 h-32 rounded-lg bg-gray-800 animate-pulse" />
                <div className="space-y-1">
                  <SkeletonText lines={1} className="w-16" />
                  <SkeletonText lines={1} className="w-8" />
                </div>
              </div>
              <SkeletonProgressBar />
              <SkeletonProgressBar />
            </div>
          ) : (
            // Actual content
            <>
              {/* Avatar Display - Positioned absolutely at exact coordinates */}
              <div style={{
                position: 'absolute',
                left: '23px',
                top: '89px',
                width: '208px',
                height: '294px'
              }}>
                <div className="rounded-lg border-2 border-solo-accent/30 overflow-hidden flex items-center justify-center w-full h-full p-0.5">
                  <div className="rounded flex items-center justify-center w-full h-full" style={{
                    background: 'linear-gradient(to bottom, #E74C3C, #8E44AD)'
                  }}>
                    <AvatarCanvas width={100} height={120} zoom={1.8} />
                  </div>
                </div>
                {/* Level badge */}
                <div className="absolute -top-1 -right-1 bg-gradient-to-br from-solo-accent to-solo-secondary text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-theme-bg">
                  {userLevel}
                </div>
              </div>
              
              {/* Content below avatar - positioned to start right after the box */}
              <div style={{ marginTop: '295px', padding: '0 24px' }}>
                {/* Level and Name */}
                <div className="text-center mb-3">
                  <p className="text-sm text-gray-400">Level {userLevel}</p>
                  <p className="text-lg font-bold text-solo-accent">Adventurer</p>
                </div>
                
                {/* Cosmetic Title Section */}
                <div className="text-center mb-4">
                  <p className="text-xs text-gray-500">Title</p>
                  <p className="text-sm font-semibold text-purple-400">Dragon Slayer</p>
                </div>
                
                {/* XP Bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                    <span className="flex-shrink-0">XP</span>
                    <span className="text-right">{formatNumber(currentXP)} / {formatNumber(currentXP + xpToNext)}</span>
                  </div>
                  <AnimatedProgressBar
                    progress={xpPercent}
                    duration={1000}
                  />
                </div>

                {/* Health Bar */}
                <div className="mb-3">
                  <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                    <span className="flex-shrink-0">Health</span>
                    <span className="text-right">{formatNumber(currentHP)} / {formatNumber(maxHP)}</span>
                  </div>
                  <AnimatedProgressBar
                    progress={hpPercent}
                    color="bg-gradient-to-r from-red-500 to-red-400"
                    duration={800}
                  />
                </div>
              </div>
            </>
          )}
        </div>
        )}

        {/* Navigation */}
        <nav className="space-y-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center ${collapsed ? 'justify-center px-3' : 'gap-3 px-4'} py-3 rounded-lg transition-all duration-200 hover:scale-105 ${
                  isActive
                    ? 'bg-solo-accent/20 text-theme-accent shadow-lg shadow-solo-accent/25'
                    : 'hover:bg-theme-bg text-gray-400 hover:text-theme-fg hover:shadow-md'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>
      </div>
    </aside>
  )
}

export default Sidebar