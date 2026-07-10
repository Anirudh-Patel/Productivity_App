import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

export interface CaptureSettings {
  folder_path: string | null;
  last_scan_at: string | null;
}

export interface CaptureLogEntry {
  id: number;
  filename: string;
  tasks_created: number;
  status: string; // 'processed' | 'failed'
  detail: string | null;
  imported_at: string;
}

export interface CaptureScanSummary {
  files_scanned: number;
  tasks_created: number;
  errors: string[];
}

interface CaptureState {
  settings: CaptureSettings | null;
  log: CaptureLogEntry[];
  scanning: boolean;
  lastScanSummary: CaptureScanSummary | null;
  error: string | null;

  fetchSettings: () => Promise<CaptureSettings | null>;
  /** Set (or clear, with an empty string) the watched inbox folder. */
  setFolder: (path: string) => Promise<void>;
  fetchLog: (limit?: number) => Promise<void>;
  /** Scan the watched inbox folder and turn dropped files into quests. */
  scan: () => Promise<CaptureScanSummary | null>;
}

export const useCaptureStore = create<CaptureState>((set, get) => ({
  settings: null,
  log: [],
  scanning: false,
  lastScanSummary: null,
  error: null,

  fetchSettings: async () => {
    try {
      const settings = await invoke<CaptureSettings>('get_capture_settings');
      set({ settings });
      return settings;
    } catch (error) {
      logger.error('Failed to fetch capture settings', error, 'CaptureStore');
      return null;
    }
  },

  setFolder: async (path: string) => {
    const settings = await invoke<CaptureSettings>('set_capture_folder', { path });
    set({ settings, error: null });
  },

  fetchLog: async (limit = 20) => {
    try {
      const log = await invoke<CaptureLogEntry[]>('get_capture_log', { limit });
      set({ log, error: null });
    } catch (error) {
      logger.error('Failed to fetch capture log', error, 'CaptureStore');
      set({ error: String(error) });
    }
  },

  scan: async () => {
    if (get().scanning) return null;
    set({ scanning: true, error: null });
    try {
      const summary = await invoke<CaptureScanSummary>('scan_capture_inbox');
      set({ lastScanSummary: summary, scanning: false });
      // Refresh dependent state after the scan.
      await Promise.all([get().fetchLog(), get().fetchSettings()]);
      if (summary.errors.length > 0) {
        logger.warn('Capture scan finished with errors', { errors: summary.errors }, 'CaptureStore');
      }
      return summary;
    } catch (error) {
      logger.error('Capture scan failed', error, 'CaptureStore');
      set({ scanning: false, error: String(error) });
      return null;
    }
  },
}));
