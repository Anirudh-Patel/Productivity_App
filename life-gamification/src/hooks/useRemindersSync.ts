import { useEffect } from 'react';
import { useRemindersStore } from '../store/remindersStore';
import { useGameStore } from '../store/gameStore';
import { logger } from '../utils/logger';

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Mounts Apple Reminders sync: runs once on app start and then every 15
 * minutes. Only syncs when at least one reminder list is enabled in
 * Settings → Reminders, so it never triggers the macOS permission prompt
 * on its own (connecting happens explicitly from Settings).
 */
export const useRemindersSync = () => {
  useEffect(() => {
    let cancelled = false;

    const runSync = async (isInitial: boolean) => {
      try {
        if (isInitial) {
          // DB-only reads — safe on startup (no Reminders.app access).
          await Promise.all([
            useRemindersStore.getState().fetchLists(),
            useRemindersStore.getState().fetchSettings(),
          ]);
        }

        const { lists, syncing } = useRemindersStore.getState();
        if (cancelled || syncing) return;
        if (!lists.some(l => l.enabled)) return;

        const summary = await useRemindersStore.getState().sync();
        if (cancelled || !summary) return;

        if (summary.reminders_imported > 0 || summary.tasks_completed > 0 || summary.tasks_updated > 0) {
          // Reflect imported/completed tasks in the main quest list.
          await useGameStore.getState().fetchTasks();
        }
      } catch (error) {
        logger.warn('Background Reminders sync failed', { error }, 'useRemindersSync');
      }
    };

    runSync(true);
    const interval = setInterval(() => runSync(false), SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
};
