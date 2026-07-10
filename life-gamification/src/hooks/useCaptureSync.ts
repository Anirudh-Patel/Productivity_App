import { useEffect } from 'react';
import { useCaptureStore } from '../store/captureStore';
import { useGameStore } from '../store/gameStore';
import { useToast } from '../shared/components/ui/Toast';
import { logger } from '../utils/logger';

const SCAN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Mounts quick-capture inbox sync: scans the watched iCloud Drive inbox folder
 * once on app start and then every 5 minutes. Only runs when a folder is
 * configured in Settings → Quick Capture. Newly captured quests trigger a
 * task-list refresh and a toast ("3 quests captured from inbox").
 */
export const useCaptureSync = () => {
  const { success } = useToast();

  useEffect(() => {
    let cancelled = false;

    const runScan = async (isInitial: boolean) => {
      try {
        if (isInitial) {
          await useCaptureStore.getState().fetchSettings();
        }

        const { settings, scanning } = useCaptureStore.getState();
        if (cancelled || scanning) return;
        if (!settings?.folder_path) return;

        const summary = await useCaptureStore.getState().scan();
        if (cancelled || !summary) return;

        if (summary.tasks_created > 0) {
          // Reflect captured quests in the main quest list.
          await useGameStore.getState().fetchTasks();
          success(
            'Inbox Captured!',
            `${summary.tasks_created} quest${summary.tasks_created === 1 ? '' : 's'} captured from inbox`,
            5000
          );
        }
      } catch (error) {
        logger.warn('Background capture scan failed', { error }, 'useCaptureSync');
      }
    };

    runScan(true);
    const interval = setInterval(() => runScan(false), SCAN_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};
