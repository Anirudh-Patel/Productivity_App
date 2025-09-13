import { ReactNode, useEffect, useRef } from 'react';
import { useNotificationService } from '../services/notificationService';
import { useGameStore } from '../store/gameStore';
import useNotificationStore, { 
  createTaskCompletionNotification, 
  createLevelUpNotification, 
  createAchievementNotification, 
  createSystemNotification 
} from '../store/notificationStore';

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const notificationService = useNotificationService();
  const { user } = useGameStore();
  const { addNotification, notifications } = useNotificationStore();
  const demoNotificationsAdded = useRef(false);

  // Initialize notification service and set up global listeners
  useEffect(() => {
    // The notification service is automatically initialized by the useNotificationService hook
    console.log('Notification service initialized');
    
    // Add some demo notifications if none exist and we haven't added them before (for testing purposes)
    if (notifications.length === 0 && !demoNotificationsAdded.current) {
      demoNotificationsAdded.current = true;
      
      setTimeout(() => {
        addNotification(createSystemNotification(
          'Welcome to Life Gamification! 🎮', 
          'Your productivity journey starts here. Complete tasks to gain XP and level up!',
          'normal'
        ));
        
        setTimeout(() => {
          addNotification(createTaskCompletionNotification('Morning Exercise', 50));
        }, 2000);
        
        setTimeout(() => {
          addNotification(createAchievementNotification(
            'First Steps', 
            'Complete your first task and begin your journey to productivity mastery',
            'common'
          ));
        }, 4000);
        
        setTimeout(() => {
          addNotification(createLevelUpNotification(2, 1));
        }, 6000);
      }, 1000);
    }
    
    // You could add global event listeners here if needed
    // For example, listening to window events or other global state changes
    
    return () => {
      // Cleanup if needed
    };
  }, [notificationService, addNotification]);

  // Monitor user level changes to trigger level up notifications
  useEffect(() => {
    if (user?.level && user.previous_level && user.level > user.previous_level) {
      notificationService.notifyLevelUp(user.level, user.previous_level);
    }
  }, [user?.level, user?.previous_level, notificationService]);

  return <>{children}</>;
};