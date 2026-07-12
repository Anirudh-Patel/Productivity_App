import { useToast } from '../shared/components/ui/Toast';
import useNotificationStore, { 
  createTaskCompletionNotification, 
  createLevelUpNotification, 
  createAchievementNotification, 
  createItemReceivedNotification,
  createSystemNotification 
} from '../store/notificationStore';

export interface GameEvent {
  type: 'task_completed' | 'xp_gained' | 'level_up' | 'achievement_unlocked' | 'item_received' | 'buff_applied' | 'quest_chain_completed';
  data: {
    taskName?: string;
    xpAmount?: number;
    newLevel?: number;
    previousLevel?: number;
    achievementName?: string;
    achievementDescription?: string;
    achievementRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    itemName?: string;
    itemRarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
    buffName?: string;
    buffDuration?: number;
    questChainName?: string;
    questChainReward?: string;
  };
}

class NotificationService {
  private toastContext: ReturnType<typeof useToast> | null = null;

  setToastContext(context: ReturnType<typeof useToast>) {
    this.toastContext = context;
  }

  private addToNotificationStore(type: GameEvent['type'] | 'system', title: string, message: string, data?: any) {
    // Get the store instance - this will work because the component using the service will be inside the provider
    const { addNotification } = useNotificationStore.getState();
    
    switch (type) {
      case 'task_completed':
        addNotification(createTaskCompletionNotification(data?.taskName || 'Task', data?.xpAmount || 0));
        break;
      case 'level_up':
        addNotification(createLevelUpNotification(data?.newLevel || 1, data?.previousLevel || 0));
        break;
      case 'achievement_unlocked':
        addNotification(createAchievementNotification(title, message, data?.rarity || 'common'));
        break;
      case 'item_received':
        addNotification(createItemReceivedNotification(data?.itemName || 'Item', data?.rarity || 'common'));
        break;
      default:
        addNotification(createSystemNotification(title, message));
        break;
    }
  }

  triggerGameEvent(event: GameEvent) {
    if (!this.toastContext) {
      console.warn('Toast context not set for NotificationService');
      return;
    }

    const { type, data } = event;

    switch (type) {
      case 'task_completed':
        this.toastContext.success(
          'Quest Completed!',
          data.taskName ? `Completed "${data.taskName}"` : 'Great job on finishing your quest!',
          4000
        );
        this.addToNotificationStore(type, 'Quest Completed!', data.taskName ? `Completed "${data.taskName}" and gained ${data.xpAmount || 0} XP` : 'Great job on finishing your quest!', data);
        break;

      case 'xp_gained':
        if (data.xpAmount) {
          this.toastContext.xpGain(
            data.xpAmount,
            data.taskName ? `From "${data.taskName}"` : 'Quest reward'
          );
        }
        break;

      case 'level_up':
        if (data.newLevel && data.previousLevel) {
          this.toastContext.levelUp(data.newLevel, data.previousLevel);
          this.addToNotificationStore(type, 'Level Up!', `Congratulations! You've reached level ${data.newLevel}`, data);
          
          // Also show a success toast for the level up rewards
          setTimeout(() => {
            this.toastContext?.success(
              'New Abilities Unlocked!',
              `Reached Level ${data.newLevel}! Check your stats for new capabilities.`,
              6000
            );
          }, 2000);
        }
        break;

      case 'achievement_unlocked':
        if (data.achievementName) {
          this.toastContext.achievement(
            data.achievementName,
            data.achievementDescription || 'Achievement unlocked!',
            data.achievementRarity || 'common'
          );
          this.addToNotificationStore(type, data.achievementName, data.achievementDescription || 'Achievement unlocked!', { rarity: data.achievementRarity });
        }
        break;

      case 'item_received':
        if (data.itemName) {
          this.toastContext.rareDrop(
            data.itemName,
            data.itemRarity || 'common'
          );
          this.addToNotificationStore(type, 'Item Received!', `Received: ${data.itemName}`, { itemName: data.itemName, rarity: data.itemRarity });
        }
        break;

      case 'buff_applied':
        if (data.buffName) {
          this.toastContext.info(
            'Buff Active!',
            `${data.buffName} ${data.buffDuration ? `(${data.buffDuration}m)` : 'activated'}`,
            4000
          );
          this.addToNotificationStore('system', 'Buff Active!', `${data.buffName} ${data.buffDuration ? `(${data.buffDuration}m)` : 'activated'}`);
        }
        break;

      case 'quest_chain_completed':
        if (data.questChainName) {
          this.toastContext.achievement(
            'Quest Chain Complete!',
            `Finished "${data.questChainName}"${data.questChainReward ? ` - ${data.questChainReward}` : ''}`,
            'rare',
            8000
          );
          this.addToNotificationStore('achievement_unlocked', 'Quest Chain Complete!', `Finished "${data.questChainName}"${data.questChainReward ? ` - ${data.questChainReward}` : ''}`, { rarity: 'rare' });
        }
        break;

      default:
        console.warn('Unknown game event type:', type);
    }
  }

  // Specialized methods for common notifications
  notifyTaskCompleted(taskName: string, xpGained: number) {
    this.triggerGameEvent({
      type: 'task_completed',
      data: { taskName, xpAmount: xpGained }
    });
    
    // Show XP gain shortly after task completion
    setTimeout(() => {
      this.triggerGameEvent({
        type: 'xp_gained',
        data: { xpAmount: xpGained, taskName }
      });
    }, 1000);
  }

  notifyLevelUp(newLevel: number, previousLevel: number) {
    this.triggerGameEvent({
      type: 'level_up',
      data: { newLevel, previousLevel }
    });
  }

  notifyAchievementUnlocked(name: string, description: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common') {
    this.triggerGameEvent({
      type: 'achievement_unlocked',
      data: { 
        achievementName: name, 
        achievementDescription: description,
        achievementRarity: rarity 
      }
    });
  }

  notifyItemReceived(itemName: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common') {
    this.triggerGameEvent({
      type: 'item_received',
      data: { itemName, itemRarity: rarity }
    });
  }

  notifyBuffApplied(buffName: string, durationMinutes?: number) {
    this.triggerGameEvent({
      type: 'buff_applied',
      data: { buffName, buffDuration: durationMinutes }
    });
  }

  notifyQuestChainCompleted(questChainName: string, reward?: string) {
    this.triggerGameEvent({
      type: 'quest_chain_completed',
      data: { questChainName, questChainReward: reward }
    });
  }

  // Generic system notification (info toast + notification center entry)
  notifySystem(title: string, message: string) {
    this.toastContext?.info(title, message, 4000);
    const { addNotification } = useNotificationStore.getState();
    addNotification(createSystemNotification(title, message));
  }

  notifySuccess(title: string, message?: string) {
    this.toastContext?.success(title, message, 4000);
    const { addNotification } = useNotificationStore.getState();
    addNotification(createSystemNotification(title, message ?? ''));
  }

  notifyError(title: string, message?: string) {
    this.toastContext?.error(title, message);
    const { addNotification } = useNotificationStore.getState();
    addNotification(createSystemNotification(title, message ?? ''));
  }

  notifyTaskCreated(taskName: string) {
    this.notifySystem('Quest Created', `New quest added: "${taskName}"`);
  }

  // Alias matching older call sites
  notifyAchievement(name: string, description: string, rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common') {
    this.notifyAchievementUnlocked(name, description, rarity);
  }

  notifyItemPurchased(itemName: string) {
    this.notifySystem('Item Purchased', `Purchased: ${itemName}`);
  }

  notifyItemUsed(itemName: string) {
    this.notifySystem('Item Used', `Used: ${itemName}`);
  }

  // Combo notifications for complex events
  notifyTaskCompletionWithRewards(taskName: string, xpGained: number, achievements: Array<{name: string, description: string, rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'}> = [], items: Array<{name: string, rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'}> = []) {
    // Task completion first
    this.notifyTaskCompleted(taskName, xpGained);
    
    // Then achievements (staggered)
    achievements.forEach((achievement, index) => {
      setTimeout(() => {
        this.notifyAchievementUnlocked(achievement.name, achievement.description, achievement.rarity);
      }, 2000 + (index * 1500));
    });
    
    // Finally items (staggered)
    items.forEach((item, index) => {
      setTimeout(() => {
        this.notifyItemReceived(item.name, item.rarity);
      }, 3000 + achievements.length * 1500 + (index * 1000));
    });
  }
}

// Export a singleton instance
export const notificationService = new NotificationService();

// Hook for easy integration with React components
export const useNotificationService = () => {
  const toastContext = useToast();
  
  // Initialize the service with the toast context
  if (notificationService && toastContext) {
    notificationService.setToastContext(toastContext);
  }
  
  return notificationService;
};