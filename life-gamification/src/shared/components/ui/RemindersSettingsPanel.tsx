import { useEffect, useState } from 'react';
import { Link, ListChecks, RefreshCw } from 'lucide-react';
import { useRemindersStore } from '../../../store/remindersStore';
import { useGameStore } from '../../../store/gameStore';

const formatSyncTime = (iso?: string | null): string => {
  if (!iso) return 'Never';
  // SQLite CURRENT_TIMESTAMP is UTC without timezone marker.
  const date = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const RemindersSettingsPanel = () => {
  const {
    connected,
    lists,
    settings,
    syncing,
    lastSyncSummary,
    error,
    connect,
    fetchLists,
    fetchSettings,
    setListEnabled,
    sync,
  } = useRemindersStore();

  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchLists();
    fetchSettings();
  }, [fetchLists, fetchSettings]);

  const handleConnect = async () => {
    setConnecting(true);
    setStatus(null);
    const ok = await connect();
    setStatus(
      ok
        ? 'Connected to Reminders.app'
        : 'Could not access Reminders.app — check System Settings > Privacy & Security > Automation.'
    );
    setConnecting(false);
  };

  const handleSyncNow = async () => {
    setStatus(null);
    const summary = await sync();
    if (summary && (summary.reminders_imported > 0 || summary.tasks_completed > 0 || summary.tasks_updated > 0)) {
      await useGameStore.getState().fetchTasks();
    }
  };

  const anyEnabled = lists.some(l => l.enabled);

  return (
    <div className="space-y-6">
      {/* Connection */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ListChecks className="w-5 h-5" />
          Apple Reminders (Reminders.app)
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Reminders captured via Siri or your iPhone become quests. Incomplete reminders from
          enabled lists are imported (deduplicated), and completion syncs both ways: complete a
          quest here and its reminder gets checked off; check a reminder off and the quest
          completes on the next sync. No API keys needed — the first connection triggers a
          one-time macOS permission prompt.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-4 py-2 bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent border border-theme-accent/30 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <Link className="w-4 h-4" />
            {connecting ? 'Connecting…' : connected ? 'Refresh Lists' : 'Connect Reminders.app'}
          </button>
          {connected && <span className="text-sm text-green-400">Connected</span>}
        </div>
        {status && <p className="text-sm text-gray-400 mt-3">{status}</p>}
        {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
      </div>

      {/* Per-list import toggles */}
      {connected && (
        <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold mb-2">Synced Lists</h3>
          <p className="text-gray-400 text-sm mb-4">
            Import incomplete reminders from a list as quests. Off by default — reminders are
            deduplicated, so nothing is imported twice.
          </p>
          {lists.length === 0 ? (
            <p className="text-sm text-gray-400">
              No lists found. Hit "Refresh Lists" above after granting access.
            </p>
          ) : (
            <div className="space-y-3">
              {lists.map(list => (
                <div key={list.name} className="flex justify-between items-center p-3 bg-theme-bg rounded-lg">
                  <div>
                    <p className="font-medium">{list.name}</p>
                    <p className="text-sm text-gray-400">
                      {list.enabled ? 'Importing reminders as quests' : 'Not importing'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={list.enabled}
                      onChange={e => {
                        setListEnabled(list.name, e.target.checked).catch(() =>
                          setStatus('Failed to save list setting.')
                        );
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sync */}
      {connected && (
        <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              <p>Last sync: {formatSyncTime(settings?.last_sync_at)}</p>
              {lastSyncSummary && (
                <p className="text-xs mt-1">
                  {lastSyncSummary.reminders_imported} imported ·{' '}
                  {lastSyncSummary.tasks_updated} updated ·{' '}
                  <span className={lastSyncSummary.tasks_completed > 0 ? 'text-green-400' : ''}>
                    {lastSyncSummary.tasks_completed} quest(s) completed
                  </span>{' '}
                  · {lastSyncSummary.reminders_completed} reminder(s) checked off
                  {lastSyncSummary.errors.length > 0 && (
                    <span className="text-red-400"> · {lastSyncSummary.errors.length} error(s)</span>
                  )}
                </p>
              )}
              <p className="text-xs mt-1 text-gray-500">Syncs automatically on app start and every 15 minutes.</p>
            </div>
            <button
              onClick={handleSyncNow}
              disabled={syncing || !anyEnabled}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
          {lastSyncSummary && lastSyncSummary.errors.length > 0 && (
            <div className="mt-3 space-y-1">
              {lastSyncSummary.errors.map((err, i) => (
                <p key={i} className="text-xs text-red-400">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RemindersSettingsPanel;
