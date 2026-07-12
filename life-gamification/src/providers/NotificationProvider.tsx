import { ReactNode, useEffect, useRef, useState } from 'react';
import { useNotificationService } from '../services/notificationService';
import { useGameStore } from '../store/gameStore';
import useNotificationStore, { 
  createTaskCompletionNotification, 
  createLevelUpNotification, 
  createAchievementNotification, 
  createSystemNotification 
} from '../store/notificationStore';
import { SoloLevelUpAnimation, SystemNotification } from '../shared/components/ui/SoloLevelingAnimations';
import { useNotificationDelivery } from '../hooks/useNotificationDelivery';

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const notificationService = useNotificationService();
  // Poll for due scheduled reminders and deliver them (OS notification with
  // in-app fallback). See src/hooks/useNotificationDelivery.ts.
  useNotificationDelivery();
  const { user } = useGameStore();
  const { addNotification, notifications } = useNotificationStore();
  const demoNotificationsAdded = useRef(false);
  const [levelUpAnimation, setLevelUpAnimation] = useState<{ visible: boolean; level: number }>({
    visible: false,
    level: 1
  });
  const [systemNotification, setSystemNotification] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'success' | 'quest';
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info'
  });

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

  // Monitor user level changes to trigger level up notifications.
  // The backend doesn't send a previous level, so track it locally.
  const previousLevelRef = useRef<number | null>(null);
  useEffect(() => {
    const previousLevel = previousLevelRef.current;
    if (user?.level == null) return;

    if (previousLevel !== null && user.level > previousLevel) {
      // Show Solo Leveling style level up animation
      setLevelUpAnimation({ visible: true, level: user.level });

      // Also show regular notification
      notificationService.notifyLevelUp(user.level, previousLevel);

      // Hide animation after 3 seconds
      setTimeout(() => {
        setLevelUpAnimation(prev => ({ ...prev, visible: false }));
      }, 3000);
    }

    previousLevelRef.current = user.level;
  }, [user?.level, notificationService]);
  
  // Listen for quest completions or system messages
  useEffect(() => {
    // Example: Show system notification for new quests
    const checkForNewQuests = () => {
      const hasNewQuest = Math.random() > 0.95; // 5% chance for demo
      if (hasNewQuest) {
        setSystemNotification({
          visible: true,
          title: 'New Quest Available!',
          message: 'A new daily quest has been added to your journal.',
          type: 'quest'
        });
        
        setTimeout(() => {
          setSystemNotification(prev => ({ ...prev, visible: false }));
        }, 5000);
      }
    };
    
    const interval = setInterval(checkForNewQuests, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {children}
      <SoloLevelUpAnimation 
        isVisible={levelUpAnimation.visible}
        newLevel={levelUpAnimation.level}
        onComplete={() => setLevelUpAnimation(prev => ({ ...prev, visible: false }))}
      />
      <SystemNotification
        isVisible={systemNotification.visible}
        title={systemNotification.title}
        message={systemNotification.message}
        type={systemNotification.type}
        onClose={() => setSystemNotification(prev => ({ ...prev, visible: false }))}
      />
    </>
  );
};