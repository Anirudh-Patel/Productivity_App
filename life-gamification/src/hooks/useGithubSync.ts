import { useEffect } from 'react';
import { useGithubStore } from '../store/githubStore';
import { useGameStore } from '../store/gameStore';
import { logger } from '../utils/logger';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Mounts GitHub issue sync: runs once on app start and then every 30 minutes.
 * Only syncs when the gh CLI is authenticated, sync is enabled, and at least
 * one repo is on the watchlist.
 */
export const useGithubSync = () => {
  useEffect(() => {
    let cancelled = false;

    const runSync = async (isInitial: boolean) => {
      const github = useGithubStore.getState();
      try {
        if (isInitial) {
          const status = await github.checkCli();
          await Promise.all([github.fetchSettings(), github.fetchRepos(), github.fetchTaskLinks()]);
          if (!status?.installed || !status?.authenticated) return;
        }

        const { settings, repos, cliStatus, syncing } = useGithubStore.getState();
        if (cancelled || syncing) return;
        if (!cliStatus?.authenticated || !settings?.sync_enabled) return;
        if (!repos.some(r => r.enabled)) return;

        const summary = await useGithubStore.getState().sync();
        if (cancelled || !summary) return;

        if (summary.issues_imported > 0 || summary.tasks_completed > 0 || summary.tasks_updated > 0) {
          // Reflect imported/completed tasks in the main quest list.
          await useGameStore.getState().fetchTasks();
        }
      } catch (error) {
        logger.warn('Background GitHub sync failed', { error }, 'useGithubSync');
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
