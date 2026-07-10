import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

export interface GithubCliStatus {
  installed: boolean;
  authenticated: boolean;
  message: string;
}

export interface GithubRepo {
  id: number;
  owner: string;
  name: string;
  enabled: boolean;
  last_synced_at?: string | null;
}

export interface GithubSettings {
  sync_enabled: boolean;
  close_on_complete: boolean;
  last_sync_at?: string | null;
}

export interface GithubSyncSummary {
  repos_synced: number;
  issues_imported: number;
  tasks_updated: number;
  tasks_completed: number;
  errors: string[];
}

export interface GithubTaskLink {
  task_id: number;
  repo: string;
  issue_number: number;
  url: string;
}

interface GithubState {
  cliStatus: GithubCliStatus | null;
  repos: GithubRepo[];
  settings: GithubSettings | null;
  taskLinks: Record<number, GithubTaskLink>;
  syncing: boolean;
  lastSyncSummary: GithubSyncSummary | null;
  error: string | null;

  checkCli: () => Promise<GithubCliStatus | null>;
  fetchRepos: () => Promise<void>;
  addRepo: (ownerRepo: string) => Promise<GithubRepo>;
  removeRepo: (repoId: number) => Promise<void>;
  toggleRepo: (repoId: number) => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (settings: { sync_enabled: boolean; close_on_complete: boolean }) => Promise<void>;
  fetchTaskLinks: () => Promise<void>;
  sync: () => Promise<GithubSyncSummary | null>;
  /** Close the linked GitHub issue for a completed task, if close-on-complete is enabled. Non-fatal. */
  closeIssueForTask: (taskId: number) => Promise<void>;
}

export const useGithubStore = create<GithubState>((set, get) => ({
  cliStatus: null,
  repos: [],
  settings: null,
  taskLinks: {},
  syncing: false,
  lastSyncSummary: null,
  error: null,

  checkCli: async () => {
    try {
      const status = await invoke<GithubCliStatus>('github_check_cli');
      set({ cliStatus: status });
      return status;
    } catch (error) {
      logger.error('Failed to check GitHub CLI', error, 'GithubStore');
      set({ cliStatus: { installed: false, authenticated: false, message: String(error) } });
      return null;
    }
  },

  fetchRepos: async () => {
    try {
      const repos = await invoke<GithubRepo[]>('github_list_repos');
      set({ repos, error: null });
    } catch (error) {
      logger.error('Failed to fetch GitHub repos', error, 'GithubStore');
      set({ error: String(error) });
    }
  },

  addRepo: async (ownerRepo: string) => {
    const repo = await invoke<GithubRepo>('github_add_repo', { ownerRepo });
    await get().fetchRepos();
    return repo;
  },

  removeRepo: async (repoId: number) => {
    await invoke('github_remove_repo', { repoId });
    set(state => ({ repos: state.repos.filter(r => r.id !== repoId) }));
  },

  toggleRepo: async (repoId: number) => {
    const enabled = await invoke<boolean>('github_toggle_repo', { repoId });
    set(state => ({
      repos: state.repos.map(r => (r.id === repoId ? { ...r, enabled } : r)),
    }));
  },

  fetchSettings: async () => {
    try {
      const settings = await invoke<GithubSettings>('github_get_settings');
      set({ settings });
    } catch (error) {
      logger.error('Failed to fetch GitHub settings', error, 'GithubStore');
    }
  },

  updateSettings: async ({ sync_enabled, close_on_complete }) => {
    const settings = await invoke<GithubSettings>('github_update_settings', {
      syncEnabled: sync_enabled,
      closeOnComplete: close_on_complete,
    });
    set({ settings });
  },

  fetchTaskLinks: async () => {
    try {
      const links = await invoke<GithubTaskLink[]>('github_get_task_links');
      const taskLinks: Record<number, GithubTaskLink> = {};
      for (const link of links) {
        taskLinks[link.task_id] = link;
      }
      set({ taskLinks });
    } catch (error) {
      logger.error('Failed to fetch GitHub task links', error, 'GithubStore');
    }
  },

  sync: async () => {
    if (get().syncing) return null;
    set({ syncing: true, error: null });
    try {
      const summary = await invoke<GithubSyncSummary>('github_sync');
      set({ lastSyncSummary: summary, syncing: false });
      // Refresh dependent state after sync.
      await Promise.all([get().fetchTaskLinks(), get().fetchRepos(), get().fetchSettings()]);
      if (summary.errors.length > 0) {
        logger.warn('GitHub sync finished with errors', { errors: summary.errors }, 'GithubStore');
      }
      return summary;
    } catch (error) {
      logger.error('GitHub sync failed', error, 'GithubStore');
      set({ syncing: false, error: String(error) });
      return null;
    }
  },

  closeIssueForTask: async (taskId: number) => {
    try {
      const { settings, taskLinks } = get();
      const link = taskLinks[taskId];
      if (!link || settings?.close_on_complete === false) return;
      await invoke('github_close_issue', { repo: link.repo, issueNumber: link.issue_number });
      logger.info('Closed GitHub issue for completed task', { taskId, repo: link.repo, issue: link.issue_number }, 'GithubStore');
    } catch (error) {
      // Non-fatal by design: task completion must never fail because of GitHub.
      logger.warn('Failed to close GitHub issue for task', { taskId, error }, 'GithubStore');
    }
  },
}));
