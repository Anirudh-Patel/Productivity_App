import { useEffect, useState } from 'react';
import { Github, Plus, Trash2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useGithubStore } from '../../../store/githubStore';
import { useGameStore } from '../../../store/gameStore';

const formatSyncTime = (iso?: string | null): string => {
  if (!iso) return 'Never';
  // SQLite CURRENT_TIMESTAMP is UTC without timezone marker.
  const date = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const Toggle = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) => (
  <label className="relative inline-flex items-center cursor-pointer">
    <input
      type="checkbox"
      className="sr-only peer"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
    />
    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-solo-accent"></div>
  </label>
);

const GithubSettingsPanel = () => {
  const {
    cliStatus,
    repos,
    settings,
    syncing,
    lastSyncSummary,
    checkCli,
    fetchRepos,
    fetchSettings,
    addRepo,
    removeRepo,
    toggleRepo,
    updateSettings,
    sync,
  } = useGithubStore();

  const [newRepo, setNewRepo] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    checkCli();
    fetchRepos();
    fetchSettings();
  }, [checkCli, fetchRepos, fetchSettings]);

  const handleAddRepo = async () => {
    const value = newRepo.trim();
    if (!value) return;
    setAdding(true);
    setAddError(null);
    try {
      await addRepo(value);
      setNewRepo('');
    } catch (error: any) {
      setAddError(String(error));
    } finally {
      setAdding(false);
    }
  };

  const handleSyncNow = async () => {
    const summary = await sync();
    if (summary && (summary.issues_imported > 0 || summary.tasks_completed > 0 || summary.tasks_updated > 0)) {
      await useGameStore.getState().fetchTasks();
    }
  };

  return (
    <div className="space-y-6">
      {/* CLI Status */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Github className="w-5 h-5" />
          GitHub Integration
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Open issues from your watched repositories are imported as quests. Uses the local
          GitHub CLI (<code className="text-theme-accent">gh</code>) — no tokens stored.
        </p>
        {cliStatus && (
          <div
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
              cliStatus.authenticated
                ? 'bg-green-500/10 text-green-400 border-green-500/30'
                : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
            }`}
          >
            {cliStatus.authenticated ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            {cliStatus.message}
          </div>
        )}
      </div>

      {/* Repo Watchlist */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4">Repository Watchlist</h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newRepo}
            onChange={e => setNewRepo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddRepo()}
            placeholder="owner/repo"
            className="flex-1 px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent text-sm"
          />
          <button
            onClick={handleAddRepo}
            disabled={adding || !newRepo.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-solo-accent/20 text-theme-accent border border-theme-accent/30 rounded-lg hover:bg-solo-accent/30 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            {adding ? 'Validating…' : 'Add'}
          </button>
        </div>
        {addError && <p className="text-red-400 text-sm mb-3">{addError}</p>}

        {repos.length === 0 ? (
          <p className="text-gray-400 text-sm">No repositories watched yet. Add one above to start importing issues.</p>
        ) : (
          <div className="space-y-2">
            {repos.map(repo => (
              <div
                key={repo.id}
                className="flex items-center justify-between p-3 bg-theme-bg rounded-lg border border-gray-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Github className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className={`font-medium truncate ${repo.enabled ? '' : 'text-gray-500 line-through'}`}>
                      {repo.owner}/{repo.name}
                    </p>
                    <p className="text-xs text-gray-500">Last synced: {formatSyncTime(repo.last_synced_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Toggle checked={repo.enabled} onChange={() => toggleRepo(repo.id)} />
                  <button
                    onClick={() => removeRepo(repo.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove repository"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sync Settings */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4">Sync Settings</h3>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Automatic Sync</p>
              <p className="text-sm text-gray-400">Import open issues on app start and every 30 minutes</p>
            </div>
            <Toggle
              checked={settings?.sync_enabled ?? true}
              onChange={value =>
                updateSettings({
                  sync_enabled: value,
                  close_on_complete: settings?.close_on_complete ?? true,
                })
              }
            />
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Close Issue on Quest Completion</p>
              <p className="text-sm text-gray-400">Completing an imported quest closes the GitHub issue</p>
            </div>
            <Toggle
              checked={settings?.close_on_complete ?? true}
              onChange={value =>
                updateSettings({
                  sync_enabled: settings?.sync_enabled ?? true,
                  close_on_complete: value,
                })
              }
            />
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            <p>Last sync: {formatSyncTime(settings?.last_sync_at)}</p>
            {lastSyncSummary && (
              <p className="text-xs mt-1">
                {lastSyncSummary.issues_imported} imported · {lastSyncSummary.tasks_updated} updated ·{' '}
                {lastSyncSummary.tasks_completed} completed
                {lastSyncSummary.errors.length > 0 && (
                  <span className="text-red-400"> · {lastSyncSummary.errors.length} error(s)</span>
                )}
              </p>
            )}
          </div>
          <button
            onClick={handleSyncNow}
            disabled={syncing || !cliStatus?.authenticated}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
        {lastSyncSummary && lastSyncSummary.errors.length > 0 && (
          <div className="mt-3 space-y-1">
            {lastSyncSummary.errors.map((error, i) => (
              <p key={i} className="text-xs text-red-400">{error}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GithubSettingsPanel;
