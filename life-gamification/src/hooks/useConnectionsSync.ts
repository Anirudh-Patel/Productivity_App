import { useEffect } from 'react';
import { useConnectionsStore } from '../store/connectionsStore';
import { logger } from '../utils/logger';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours — banks post slowly; SimpleFIN rate-limits

/**
 * Mounts live-connection sync (SimpleFIN): runs once on app start and then
 * every 6 hours. Only syncs providers that are connected (or in a transient
 * error state, so temporary network failures self-heal).
 */
export const useConnectionsSync = () => {
  useEffect(() => {
    let cancelled = false;

    const runSync = async () => {
      const store = useConnectionsStore.getState();
      try {
        await store.fetchConnections();
        if (cancelled) return;

        const simplefin = useConnectionsStore.getState().connections.find(c => c.provider === 'simplefin');
        if (!simplefin || simplefin.status === 'disconnected') return;

        await useConnectionsStore.getState().syncSimplefin();
      } catch (error) {
        logger.warn('Background connections sync failed', { error }, 'useConnectionsSync');
      }
    };

    runSync();
    const interval = setInterval(runSync, SYNC_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
};
