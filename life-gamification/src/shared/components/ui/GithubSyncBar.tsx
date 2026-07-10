import { useEffect } from 'react';
import { Github, RefreshCw } from 'lucide-react';
import { useGithubStore } from '../../../store/githubStore';
import { useGameStore } from '../../../store/gameStore';

const relativeTime = (iso?: string | null): string => {
  if (!iso) return 'never';
  const date = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (isNaN(date.getTime())) return iso;
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return date.toLocaleDateString();
};

/**
 * Compact GitHub sync status + manual sync button shown on the Tasks page,
 * next to the project chip bar. Renders nothing when no repos are watched.
 */
const GithubSyncBar = () => {
  const repos = useGithubStore(s => s.repos);
  const settings = useGithubStore(s => s.settings);
  const syncing = useGithubStore(s => s.syncing);
  const lastSyncSummary = useGithubStore(s => s.lastSyncSummary);
  const error = useGithubStore(s => s.error);
  const fetchRepos = useGithubStore(s => s.fetchRepos);
  const fetchSettings = useGithubStore(s => s.fetchSettings);
  const sync = useGithubStore(s => s.sync);

  useEffect(() => {
    if (repos.length === 0) fetchRepos();
    if (!settings) fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (repos.length === 0) return null;

  const enabledCount = repos.filter(r => r.enabled).length;

  const handleSync = async () => {
    const summary = await sync();
    if (summary && (summary.issues_imported > 0 || summary.tasks_completed > 0 || summary.tasks_updated > 0)) {
      await useGameStore.getState().fetchTasks();
    }
  };

  return (
    <div className="flex items-center gap-3 mb-4 px-3 py-2 bg-theme-primary border border-gray-800 rounded-lg text-sm">
      <Github className="w-4 h-4 text-gray-400 shrink-0" />
      <span className="text-gray-400">
        {enabledCount} repo{enabledCount === 1 ? '' : 's'} · synced {relativeTime(settings?.last_sync_at)}
      </span>
      {lastSyncSummary && (
        <span className="text-xs text-gray-500 hidden md:inline">
          {lastSyncSummary.issues_imported} imported · {lastSyncSummary.tasks_completed} auto-completed
        </span>
      )}
      {error && <span className="text-xs text-red-400 truncate">{error}</span>}
      <button
        onClick={handleSync}
        disabled={syncing}
        className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-700 text-gray-300 hover:border-theme-accent/50 hover:text-theme-accent transition-colors disabled:opacity-50"
        title="Sync GitHub issues now"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Syncing…' : 'Sync'}
      </button>
    </div>
  );
};

export default GithubSyncBar;
