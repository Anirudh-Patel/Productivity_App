import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

export type ConnectionStatus = 'connected' | 'error' | 'disconnected';

export interface ConnectionInfo {
  provider: string;
  status: ConnectionStatus;
  last_sync_at?: string | null;
  last_error?: string | null;
}

export interface SimplefinSyncSummary {
  accounts_synced: number;
  transactions_imported: number;
  transactions_duplicates: number;
}

interface ConnectionsState {
  connections: ConnectionInfo[];
  connecting: boolean;
  syncing: boolean;
  lastSummary: SimplefinSyncSummary | null;
  error: string | null;

  fetchConnections: () => Promise<void>;
  getConnection: (provider: string) => ConnectionInfo | undefined;
  /** Claim a pasted SimpleFIN setup token and run the initial sync. Throws on failure. */
  connectSimplefin: (setupToken: string) => Promise<SimplefinSyncSummary>;
  syncSimplefin: () => Promise<SimplefinSyncSummary | null>;
  disconnectProvider: (provider: string) => Promise<void>;
}

export const useConnectionsStore = create<ConnectionsState>((set, get) => ({
  connections: [],
  connecting: false,
  syncing: false,
  lastSummary: null,
  error: null,

  fetchConnections: async () => {
    try {
      const connections = await invoke<ConnectionInfo[]>('get_connections');
      set({ connections });
    } catch (error) {
      logger.error('Failed to fetch connections', error, 'ConnectionsStore');
      set({ error: String(error) });
    }
  },

  getConnection: (provider: string) => get().connections.find(c => c.provider === provider),

  connectSimplefin: async (setupToken: string) => {
    set({ connecting: true, error: null });
    try {
      const summary = await invoke<SimplefinSyncSummary>('simplefin_connect', { setupToken });
      set({ connecting: false, lastSummary: summary });
      await get().fetchConnections();
      return summary;
    } catch (error) {
      set({ connecting: false, error: String(error) });
      await get().fetchConnections();
      throw error;
    }
  },

  syncSimplefin: async () => {
    if (get().syncing) return null;
    set({ syncing: true, error: null });
    try {
      const summary = await invoke<SimplefinSyncSummary>('simplefin_sync');
      set({ syncing: false, lastSummary: summary });
      await get().fetchConnections();
      return summary;
    } catch (error) {
      logger.warn('SimpleFIN sync failed', { error }, 'ConnectionsStore');
      set({ syncing: false, error: String(error) });
      // Refresh so the panel picks up status='error' / last_error from the row.
      await get().fetchConnections();
      return null;
    }
  },

  disconnectProvider: async (provider: string) => {
    try {
      await invoke('disconnect_provider', { provider });
      set({ lastSummary: null, error: null });
      await get().fetchConnections();
    } catch (error) {
      logger.error('Failed to disconnect provider', error, 'ConnectionsStore');
      set({ error: String(error) });
      throw error;
    }
  },
}));
