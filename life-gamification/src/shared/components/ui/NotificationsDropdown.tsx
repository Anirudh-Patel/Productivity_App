import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  Clock,
  Star,
  Trophy,
  Zap,
  Gift,
  Settings,
  Filter,
  ChevronDown
} from 'lucide-react'
import useNotificationStore, { Notification } from '../../../store/notificationStore'
import { formatDistanceToNow } from 'date-fns'

interface NotificationsDropdownProps {
  className?: string
}

const NotificationsDropdown = ({ className = '' }: NotificationsDropdownProps) => {
  const {
    notifications,
    unreadCount,
    isDropdownOpen,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    toggleDropdown,
    setDropdownOpen,
    getRecentNotifications
  } = useNotificationStore()

  const [filter, setFilter] = useState<'all' | 'unread' | 'task' | 'achievement' | 'system'>('all')
  const [showFilters, setShowFilters] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [setDropdownOpen])

  const getFilteredNotifications = () => {
    let filtered = getRecentNotifications(20)
    
    switch (filter) {
      case 'unread':
        return filtered.filter(n => !n.read)
      case 'task':
        return filtered.filter(n => n.type === 'task_completed' || n.type === 'xp_gained')
      case 'achievement':
        return filtered.filter(n => n.type === 'achievement_unlocked' || n.type === 'level_up')
      case 'system':
        return filtered.filter(n => n.type === 'system' || n.type === 'info')
      default:
        return filtered
    }
  }

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id)
    }
    
    // Handle action URL if present
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
    }
  }

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'urgent': return 'border-red-500'
      case 'high': return 'border-yellow-500'
      case 'normal': return 'border-blue-500'
      case 'low': return 'border-gray-500'
      default: return 'border-gray-600'
    }
  }

  const getTypeIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_completed': return <Check className="w-4 h-4" />
      case 'xp_gained': return <Zap className="w-4 h-4" />
      case 'level_up': return <Trophy className="w-4 h-4" />
      case 'achievement_unlocked': return <Star className="w-4 h-4" />
      case 'item_received': return <Gift className="w-4 h-4" />
      case 'buff_applied': return <Zap className="w-4 h-4" />
      case 'quest_chain_completed': return <Trophy className="w-4 h-4" />
      case 'system': return <Settings className="w-4 h-4" />
      default: return <Bell className="w-4 h-4" />
    }
  }

  const filteredNotifications = getFilteredNotifications()

  return (
    <div className={`relative ${className}`}>
      {/* Notification Bell Button */}
      <button
        ref={buttonRef}
        onClick={toggleDropdown}
        className="relative p-2 hover:bg-theme-bg rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isDropdownOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40 md:hidden"
              onClick={() => setDropdownOpen(false)}
            />
            
            {/* Dropdown Panel */}
            <motion.div
              ref={dropdownRef}
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-theme-primary border border-gray-700 rounded-xl shadow-2xl z-50 max-h-[80vh] flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-white">Notifications</h3>
                  <button
                    onClick={() => setDropdownOpen(false)}
                    className="p-1 hover:bg-gray-700 rounded-lg transition-colors md:hidden"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Filter Bar */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                  >
                    <Filter className="w-3 h-3" />
                    Filter
                    <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm transition-colors"
                    >
                      <CheckCheck className="w-3 h-3" />
                      Mark All Read
                    </button>
                  )}
                  
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-500 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear All
                    </button>
                  )}
                </div>

                {/* Filter Options */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="mt-2 flex flex-wrap gap-1 overflow-hidden"
                    >
                      {[
                        { key: 'all', label: 'All' },
                        { key: 'unread', label: 'Unread' },
                        { key: 'task', label: 'Tasks' },
                        { key: 'achievement', label: 'Achievements' },
                        { key: 'system', label: 'System' }
                      ].map(({ key, label }) => (
                        <button
                          key={key}
                          onClick={() => setFilter(key as any)}
                          className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                            filter === key
                              ? 'bg-theme-accent text-white'
                              : 'bg-gray-700 hover:bg-gray-600'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="p-6 text-center text-gray-400">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
                    </p>
                    {filter !== 'all' && (
                      <button
                        onClick={() => setFilter('all')}
                        className="mt-1 text-xs text-theme-accent hover:underline"
                      >
                        Show all notifications
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-700">
                    {filteredNotifications.map((notification, index) => (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-3 hover:bg-gray-800/50 cursor-pointer transition-colors border-l-2 ${
                          notification.read ? 'border-transparent' : getPriorityColor(notification.priority)
                        }`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div className="flex gap-3">
                          {/* Icon */}
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                            notification.read ? 'bg-gray-700' : 'bg-theme-accent/20'
                          }`}>
                            {notification.icon || getTypeIcon(notification.type)}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className={`text-sm font-medium truncate ${
                                  notification.read ? 'text-gray-300' : 'text-white'
                                }`}>
                                  {notification.title}
                                </h4>
                                <p className={`text-xs mt-1 line-clamp-2 ${
                                  notification.read ? 'text-gray-400' : 'text-gray-300'
                                }`}>
                                  {notification.message}
                                </p>
                                
                                <div className="flex items-center gap-2 mt-2">
                                  <div className="flex items-center gap-1 text-xs text-gray-500">
                                    <Clock className="w-3 h-3" />
                                    {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                  </div>
                                  
                                  {!notification.read && (
                                    <div className="w-2 h-2 bg-theme-accent rounded-full" />
                                  )}
                                </div>
                              </div>
                              
                              {/* Actions */}
                              <div className="flex items-center gap-1">
                                {!notification.read && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      markAsRead(notification.id)
                                    }}
                                    className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
                                    title="Mark as read"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNotification(notification.id)
                                  }}
                                  className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-red-400"
                                  title="Delete notification"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {notifications.length > 20 && (
                <div className="p-3 border-t border-gray-700 text-center">
                  <p className="text-xs text-gray-400">
                    Showing latest 20 notifications
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default NotificationsDropdown