import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

export interface HealthSettings {
  folder_path: string | null;
  last_scan_at: string | null;
}

export interface Workout {
  id: number;
  workout_type: string;
  workout_name: string;
  start_time: string;
  end_time: string | null;
  duration_seconds: number;
  calories: number | null;
  distance_m: number | null;
  source: string;
}

export interface HealthScanSummary {
  files_scanned: number;
  workouts_imported: number;
  tasks_verified: number;
  errors: string[];
}

interface HealthState {
  settings: HealthSettings | null;
  workouts: Workout[];
  scanning: boolean;
  lastScanSummary: HealthScanSummary | null;
  error: string | null;

  fetchSettings: () => Promise<HealthSettings | null>;
  /** Set (or clear, with an empty string) the watched Health Auto Export folder. */
  setFolder: (path: string) => Promise<void>;
  fetchWorkouts: (limit?: number) => Promise<void>;
  /** Scan the watched folder for new exports and auto-verify fitness quests. */
  scan: () => Promise<HealthScanSummary | null>;
  /** Attach a workout-verification requirement to a task after creation. */
  setTaskVerification: (taskId: number, workoutType: string, minMinutes?: number) => Promise<void>;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  settings: null,
  workouts: [],
  scanning: false,
  lastScanSummary: null,
  error: null,

  fetchSettings: async () => {
    try {
      const settings = await invoke<HealthSettings>('get_health_settings');
      set({ settings });
      return settings;
    } catch (error) {
      logger.error('Failed to fetch health settings', error, 'HealthStore');
      return null;
    }
  },

  setFolder: async (path: string) => {
    const settings = await invoke<HealthSettings>('set_health_folder', { path });
    set({ settings, error: null });
  },

  fetchWorkouts: async (limit = 20) => {
    try {
      const workouts = await invoke<Workout[]>('get_workouts', { limit });
      set({ workouts, error: null });
    } catch (error) {
      logger.error('Failed to fetch workouts', error, 'HealthStore');
      set({ error: String(error) });
    }
  },

  scan: async () => {
    if (get().scanning) return null;
    set({ scanning: true, error: null });
    try {
      const summary = await invoke<HealthScanSummary>('scan_health_folder');
      set({ lastScanSummary: summary, scanning: false });
      // Refresh dependent state after the scan.
      await Promise.all([get().fetchWorkouts(), get().fetchSettings()]);
      if (summary.errors.length > 0) {
        logger.warn('Health scan finished with errors', { errors: summary.errors }, 'HealthStore');
      }
      return summary;
    } catch (error) {
      logger.error('Health scan failed', error, 'HealthStore');
      set({ scanning: false, error: String(error) });
      return null;
    }
  },

  setTaskVerification: async (taskId: number, workoutType: string, minMinutes?: number) => {
    await invoke('set_task_verification', {
      taskId,
      workoutType,
      minMinutes: minMinutes ?? null,
    });
  },
}));
