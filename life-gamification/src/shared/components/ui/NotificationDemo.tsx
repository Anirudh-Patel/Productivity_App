import { useToast } from './Toast';
import { useNotificationService } from '../../../services/notificationService';

const NotificationDemo = () => {
  const toast = useToast();
  const notificationService = useNotificationService();

  const testBasicNotifications = () => {
    toast.success('Success!', 'This is a success message');
    setTimeout(() => toast.error('Error!', 'This is an error message'), 1000);
    setTimeout(() => toast.warning('Warning!', 'This is a warning message'), 2000);
    setTimeout(() => toast.info('Info!', 'This is an info message'), 3000);
  };

  const testGameNotifications = () => {
    // XP Gain
    toast.xpGain(250, 'Completed daily quest');
    
    setTimeout(() => {
      // Achievement unlock
      toast.achievement(
        'First Steps',
        'Complete your first quest',
        'uncommon'
      );
    }, 1500);

    setTimeout(() => {
      // Level up
      toast.levelUp(5, 4);
    }, 3000);

    setTimeout(() => {
      // Rare drop
      toast.rareDrop('Dragon Scale Armor', 'epic');
    }, 4500);
  };

  const testServiceNotifications = () => {
    notificationService.notifyTaskCompletionWithRewards(
      'Master the Ancient Arts',
      350,
      [
        { name: 'Martial Artist', description: 'Complete 10 training tasks', rarity: 'rare' },
        { name: 'Legendary Warrior', description: 'Reach maximum mastery', rarity: 'legendary' }
      ],
      [
        { name: 'Mystic Sword', rarity: 'epic' },
        { name: 'Ancient Scroll', rarity: 'rare' }
      ]
    );
  };

  const testLegendaryAchievement = () => {
    toast.achievement(
      'Immortal Legend',
      'Achieved the impossible - transcended mortal limits',
      'legendary',
      10000
    );
  };

  return (
    <div className="p-6 bg-theme-primary rounded-lg border border-gray-800">
      <h3 className="text-lg font-semibold mb-4">Notification System Demo</h3>
      <div className="space-y-3">
        <button
          onClick={testBasicNotifications}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Test Basic Notifications
        </button>
        
        <button
          onClick={testGameNotifications}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Test Game Notifications
        </button>
        
        <button
          onClick={testServiceNotifications}
          className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Test Service Notifications (Complex)
        </button>
        
        <button
          onClick={testLegendaryAchievement}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg transition-colors font-semibold"
        >
          Test Legendary Achievement
        </button>
      </div>
    </div>
  );
};

export default NotificationDemo;