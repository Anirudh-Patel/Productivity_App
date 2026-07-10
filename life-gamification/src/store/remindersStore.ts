import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

export interface ReminderList {
  name: string;
  enabled: boolean;
}

export interface RemindersSettings {
  last_sync_at?: string | null;
}

export interface RemindersSyncSummary {
  lists_synced: number;
  reminders_imported: number;
  tasks_updated: number;
  tasks_completed: number;
  reminders_completed: number;
  errors: string[];
}

interface RemindersConnectionResult {
  connected: boolean;
  lists: ReminderList[];
}

interface RemindersState {
  connected: boolean;
  lists: ReminderList[];
  settings: RemindersSettings | null;
  syncing: boolean;
  lastSyncSummary: RemindersSyncSummary | null;
  error: string | null;

  /** Connect to Reminders.app (triggers the one-time macOS permission prompt). */
  connect: () => Promise<boolean>;
  /** Known lists + toggles from the DB only — never triggers the macOS prompt. */
  fetchLists: () => Promise<void>;
  setListEnabled: (listName: string, enabled: boolean) => Promise<void>;
  fetchSettings: () => Promise<void>;
  sync: () => Promise<RemindersSyncSummary | null>;
}

export const useRemindersStore = create<RemindersState>((set, get) => ({
  connected: false,
  lists: [],
  settings: null,
  syncing: false,
  lastSyncSummary: null,
  error: null,

  connect: async () => {
    try {
      const result = await invoke<RemindersConnectionResult>('connect_apple_reminders');
      set({ connected: result.connected, lists: result.lists, error: null });
      return result.connected;
    } catch (error) {
      logger.error('Failed to connect to Reminders.app', error, 'RemindersStore');
      set({ connected: false, error: String(error) });
      return false;
    }
  },

  fetchLists: async () => {
    try {
      const lists = await invoke<ReminderList[]>('get_reminder_lists');
      // Lists in the DB mean a connection succeeded at some point.
      set(state => ({ lists, connected: state.connected || lists.length > 0 }));
    } catch (error) {
      logger.error('Failed to fetch reminder lists', error, 'RemindersStore');
      set({ error: String(error) });
    }
  },

  setListEnabled: async (listName: string, enabled: boolean) => {
    await invoke('set_reminder_list_rule', { listName, enabled });
    set(state => ({
      lists: state.lists.map(l => (l.name === listName ? { ...l, enabled } : l)),
    }));
  },

  fetchSettings: async () => {
    try {
      const settings = await invoke<RemindersSettings>('get_reminders_settings');
      set({ settings });
    } catch (error) {
      logger.error('Failed to fetch Reminders settings', error, 'RemindersStore');
    }
  },

  sync: async () => {
    if (get().syncing) return null;
    set({ syncing: true, error: null });
    try {
      const summary = await invoke<RemindersSyncSummary>('sync_reminders');
      set({ lastSyncSummary: summary, syncing: false });
      await get().fetchSettings();
      if (summary.errors.length > 0) {
        logger.warn('Reminders sync finished with errors', { errors: summary.errors }, 'RemindersStore');
      }
      return summary;
    } catch (error) {
      logger.error('Reminders sync failed', error, 'RemindersStore');
      set({ syncing: false, error: String(error) });
      return null;
    }
  },
}));
