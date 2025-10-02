import { useEffect } from 'react';
import { calendarSyncService, createGoogleEventForQuest } from '../services/calendarSyncService';
import { isGoogleSignedIn } from '../utils/googleCalendar';
import { logger } from '../utils/logger';

// Types
interface Task {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  category: string;
  difficulty: number;
  priority: number;
  status: string;
  created_at: string;
  task_type: string;
}

// Hook for automatic calendar synchronization
export const useCalendarSync = () => {
  useEffect(() => {
    // Initialize calendar sync service
    calendarSyncService.startAutoSync(5); // Sync every 5 minutes

    return () => {
      calendarSyncService.stopAutoSync();
    };
  }, []);

  return {
    isGoogleAuthenticated: isGoogleSignedIn(),
    lastSyncTime: calendarSyncService.getLastSyncTime(),
    isSyncInProgress: calendarSyncService.isSyncInProgress(),
    performFullSync: () => calendarSyncService.performFullSync(),
  };
};

// Hook to automatically create Google Calendar events for new quests
export const useQuestCalendarSync = () => {
  const syncQuestToGoogle = async (quest: Task): Promise<string | null> => {
    if (!isGoogleSignedIn() || !quest.due_date) {
      return null;
    }

    try {
      logger.info('Auto-syncing quest to Google Calendar', { questId: quest.id, title: quest.title }, 'CalendarSync');
      return await createGoogleEventForQuest(quest);
    } catch (error) {
      logger.error('Failed to auto-sync quest to Google Calendar', error, 'CalendarSync');
      return null;
    }
  };

  const updateGoogleEventForQuest = async (quest: Task, googleEventId: string): Promise<boolean> => {
    if (!isGoogleSignedIn()) {
      return false;
    }

    try {
      return await calendarSyncService.updateGoogleEventForQuest(quest, googleEventId);
    } catch (error) {
      logger.error('Failed to update Google Calendar event for quest', error, 'CalendarSync');
      return false;
    }
  };

  const deleteGoogleEventForQuest = async (googleEventId: string): Promise<boolean> => {
    if (!isGoogleSignedIn()) {
      return false;
    }

    try {
      return await calendarSyncService.deleteGoogleEventForQuest(googleEventId);
    } catch (error) {
      logger.error('Failed to delete Google Calendar event', error, 'CalendarSync');
      return false;
    }
  };

  return {
    syncQuestToGoogle,
    updateGoogleEventForQuest,
    deleteGoogleEventForQuest,
  };
};

// Hook for getting calendar events for display
export const useCalendarEvents = (startDate: Date, endDate: Date) => {
  const getEvents = async () => {
    try {
      return await calendarSyncService.getAllCalendarEvents(startDate, endDate);
    } catch (error) {
      logger.error('Failed to get calendar events', error, 'CalendarSync');
      return [];
    }
  };

  return {
    getEvents,
  };
};