import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Notification {
  id: string
  type: 'task_completed' | 'xp_gained' | 'level_up' | 'achievement_unlocked' | 'item_received' | 'buff_applied' | 'quest_chain_completed' | 'system' | 'info'
  title: string
  message: string
  timestamp: number
  read: boolean
  priority: 'low' | 'normal' | 'high' | 'urgent'
  icon?: string
  color?: string
  actionUrl?: string
  actionLabel?: string
  data?: {
    xpAmount?: number
    level?: number
    achievementRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
    itemRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
    taskId?: number
  }
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  isDropdownOpen: boolean
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void
  markAsRead: (notificationId: string) => void
  markAllAsRead: () => void
  deleteNotification: (notificationId: string) => void
  clearAllNotifications: () => void
  toggleDropdown: () => void
  setDropdownOpen: (open: boolean) => void
  
  // Batch operations
  addMultipleNotifications: (notifications: Array<Omit<Notification, 'id' | 'timestamp' | 'read'>>) => void
  deleteOldNotifications: (daysOld?: number) => void
  
  // Utility methods
  getUnreadNotifications: () => Notification[]
  getNotificationsByType: (type: Notification['type']) => Notification[]
  getRecentNotifications: (limit?: number) => Notification[]
}

const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],
      unreadCount: 0,
      isDropdownOpen: false,
      
      addNotification: (notificationData) => {
        const notification: Notification = {
          ...notificationData,
          id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          read: false
        }
        
        set((state) => ({
          notifications: [notification, ...state.notifications],
          unreadCount: state.unreadCount + 1
        }))
      },
      
      markAsRead: (notificationId) => {
        set((state) => {
          const notifications = state.notifications.map(notification =>
            notification.id === notificationId && !notification.read
              ? { ...notification, read: true }
              : notification
          )
          
          const unreadCount = notifications.filter(n => !n.read).length
          
          return { notifications, unreadCount }
        })
      },
      
      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map(notification => ({
            ...notification,
            read: true
          })),
          unreadCount: 0
        }))
      },
      
      deleteNotification: (notificationId) => {
        set((state) => {
          const notification = state.notifications.find(n => n.id === notificationId)
          const notifications = state.notifications.filter(n => n.id !== notificationId)
          const unreadCount = notification && !notification.read 
            ? state.unreadCount - 1 
            : state.unreadCount
          
          return { notifications, unreadCount }
        })
      },
      
      clearAllNotifications: () => {
        set({
          notifications: [],
          unreadCount: 0
        })
      },
      
      toggleDropdown: () => {
        set((state) => ({
          isDropdownOpen: !state.isDropdownOpen
        }))
      },
      
      setDropdownOpen: (open) => {
        set({ isDropdownOpen: open })
      },
      
      addMultipleNotifications: (notificationsData) => {
        const notifications = notificationsData.map(data => ({
          ...data,
          id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          read: false
        }))
        
        set((state) => ({
          notifications: [...notifications, ...state.notifications],
          unreadCount: state.unreadCount + notifications.length
        }))
      },
      
      deleteOldNotifications: (daysOld = 7) => {
        const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000)
        
        set((state) => {
          const oldNotifications = state.notifications.filter(n => n.timestamp < cutoffTime)
          const notifications = state.notifications.filter(n => n.timestamp >= cutoffTime)
          const deletedUnread = oldNotifications.filter(n => !n.read).length
          
          return {
            notifications,
            unreadCount: state.unreadCount - deletedUnread
          }
        })
      },
      
      // Utility methods
      getUnreadNotifications: () => {
        return get().notifications.filter(n => !n.read)
      },
      
      getNotificationsByType: (type) => {
        return get().notifications.filter(n => n.type === type)
      },
      
      getRecentNotifications: (limit = 10) => {
        return get().notifications
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit)
      }
    }),
    {
      name: 'notifications-storage',
      partialize: (state) => ({
        notifications: state.notifications.slice(0, 100), // Keep only last 100 notifications
        unreadCount: state.unreadCount
      }),
      version: 1
    }
  )
)

// Utility functions for creating specific notification types
export const createTaskCompletionNotification = (taskName: string, xpGained: number): Omit<Notification, 'id' | 'timestamp' | 'read'> => ({
  type: 'task_completed',
  title: 'Quest Completed! 🎯',
  message: `Completed "${taskName}" and gained ${xpGained} XP`,
  priority: 'normal',
  icon: '✅',
  color: 'green',
  data: { xpAmount: xpGained }
})

export const createLevelUpNotification = (newLevel: number, _previousLevel: number): Omit<Notification, 'id' | 'timestamp' | 'read'> => ({
  type: 'level_up',
  title: 'Level Up! 🆙',
  message: `Congratulations! You've reached level ${newLevel}`,
  priority: 'high',
  icon: '🌟',
  color: 'gold',
  data: { level: newLevel }
})

export const createAchievementNotification = (name: string, description: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common'): Omit<Notification, 'id' | 'timestamp' | 'read'> => {
  const rarityConfig = {
    common: { icon: '🏅', color: 'gray' },
    uncommon: { icon: '🥉', color: 'green' },
    rare: { icon: '🥈', color: 'blue' },
    epic: { icon: '🥇', color: 'purple' },
    legendary: { icon: '👑', color: 'gold' }
  }
  
  const config = rarityConfig[rarity]
  
  return {
    type: 'achievement_unlocked',
    title: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Achievement! ${config.icon}`,
    message: `Unlocked "${name}": ${description}`,
    priority: rarity === 'legendary' ? 'urgent' : rarity === 'epic' ? 'high' : 'normal',
    icon: config.icon,
    color: config.color,
    data: { achievementRarity: rarity }
  }
}

export const createItemReceivedNotification = (itemName: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common'): Omit<Notification, 'id' | 'timestamp' | 'read'> => {
  const rarityConfig = {
    common: { icon: '📦', color: 'gray' },
    uncommon: { icon: '🎁', color: 'green' },
    rare: { icon: '💎', color: 'blue' },
    epic: { icon: '🏆', color: 'purple' },
    legendary: { icon: '⭐', color: 'gold' }
  }
  
  const config = rarityConfig[rarity]
  
  return {
    type: 'item_received',
    title: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} Item! ${config.icon}`,
    message: `Received: ${itemName}`,
    priority: rarity === 'legendary' ? 'urgent' : rarity === 'epic' ? 'high' : 'normal',
    icon: config.icon,
    color: config.color,
    data: { itemRarity: rarity }
  }
}

export const createSystemNotification = (title: string, message: string, priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'): Omit<Notification, 'id' | 'timestamp' | 'read'> => ({
  type: 'system',
  title,
  message,
  priority,
  icon: '⚙️',
  color: 'blue'
})

export default useNotificationStore