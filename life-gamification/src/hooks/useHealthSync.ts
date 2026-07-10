import { useEffect } from 'react';
import { useHealthStore } from '../store/healthStore';
import { useGameStore } from '../store/gameStore';
import { logger } from '../utils/logger';

const SCAN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Mounts Apple Health workout sync: scans the watched Health Auto Export folder
 * once on app start and then every 15 minutes. Only runs when a folder is
 * configured in Settings → Health. Auto-verified fitness quests trigger a
 * task-list refresh so completions show up immediately.
 */
export const useHealthSync = () => {
  useEffect(() => {
    let cancelled = false;

    const runScan = async (isInitial: boolean) => {
      try {
        if (isInitial) {
          await useHealthStore.getState().fetchSettings();
        }

        const { settings, scanning } = useHealthStore.getState();
        if (cancelled || scanning) return;
        if (!settings?.folder_path) return;

        const summary = await useHealthStore.getState().scan();
        if (cancelled || !summary) return;

        if (summary.tasks_verified > 0) {
          // Reflect auto-completed (verified) quests in the main quest list.
          await useGameStore.getState().fetchTasks();
        }
      } catch (error) {
        logger.warn('Background health scan failed', { error }, 'useHealthSync');
      }
    };

    runScan(true);
    const interval = setInterval(() => runScan(false), SCAN_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
};
