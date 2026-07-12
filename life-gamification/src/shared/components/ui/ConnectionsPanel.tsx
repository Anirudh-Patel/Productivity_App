import { useEffect, useState } from 'react';
import {
  Plug,
  Landmark,
  RefreshCw,
  Trash2,
  Github,
  Calendar as CalendarIcon,
  ListChecks,
  Activity,
  Inbox,
  ExternalLink,
} from 'lucide-react';
import { useConnectionsStore } from '../../../store/connectionsStore';

const formatSyncTime = (iso?: string | null): string => {
  if (!iso) return 'Never';
  // SQLite CURRENT_TIMESTAMP is UTC without timezone marker.
  const date = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const StatusDot = ({ status }: { status: 'connected' | 'error' | 'disconnected' }) => {
  const color =
    status === 'connected' ? 'bg-green-400' : status === 'error' ? 'bg-yellow-400' : 'bg-gray-500';
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color}`} />;
};

/** Credential-free integrations already built into the app, listed here so
 *  Connections is the one-stop overview of everything the app talks to. */
const BUILT_IN_INTEGRATIONS = [
  {
    icon: Github,
    name: 'GitHub',
    description: 'Issues imported as quests via the local gh CLI',
    configure: 'Settings → GitHub',
  },
  {
    icon: CalendarIcon,
    name: 'Apple Calendar',
    description: 'Two-way sync with Calendar.app via macOS automation',
    configure: 'Settings → Calendar',
  },
  {
    icon: ListChecks,
    name: 'Apple Reminders',
    description: 'Reminders imported as quests via macOS automation',
    configure: 'Settings → Reminders',
  },
  {
    icon: Activity,
    name: 'Apple Health',
    description: 'Workout verification from a watched export folder',
    configure: 'Settings → Health',
  },
  {
    icon: Inbox,
    name: 'Quick Capture',
    description: 'Watched inbox folder scanned for captured quests',
    configure: 'Settings → Quick Capture',
  },
];

const ConnectionsPanel = () => {
  const {
    connections,
    connecting,
    syncing,
    lastSummary,
    fetchConnections,
    connectSimplefin,
    syncSimplefin,
    disconnectProvider,
  } = useConnectionsStore();

  const [setupToken, setSetupToken] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  const simplefin = connections.find(c => c.provider === 'simplefin');
  const simplefinStatus = simplefin?.status ?? 'disconnected';
  const isConnected = simplefinStatus === 'connected' || simplefinStatus === 'error';

  const handleConnect = async () => {
    const token = setupToken.trim();
    if (!token) return;
    setConnectError(null);
    setStatusMessage(null);
    try {
      const summary = await connectSimplefin(token);
      setSetupToken('');
      setStatusMessage(
        `Connected — ${summary.accounts_synced} account${summary.accounts_synced === 1 ? '' : 's'}, ` +
          `${summary.transactions_imported} transactions imported.`
      );
    } catch (error) {
      setConnectError(String(error));
    }
  };

  const handleSyncNow = async () => {
    setStatusMessage(null);
    const summary = await syncSimplefin();
    if (summary) {
      setStatusMessage(
        `Synced ${summary.accounts_synced} account${summary.accounts_synced === 1 ? '' : 's'}: ` +
          `${summary.transactions_imported} new, ${summary.transactions_duplicates} already imported.`
      );
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect SimpleFIN? The access key is removed from your Keychain. Already-imported transactions are kept.')) {
      return;
    }
    setStatusMessage(null);
    setConnectError(null);
    try {
      await disconnectProvider('simplefin');
      setStatusMessage('SimpleFIN disconnected.');
    } catch (error) {
      setConnectError(String(error));
    }
  };

  return (
    <div className="space-y-6">
      {/* SimpleFIN */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5" />
          SimpleFIN — Bank Sync
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Live bank account balances and transactions, synced into Finance on app start and every
          6 hours. Your access key is stored in the macOS Keychain — never in the database or repo.
        </p>

        {!isConnected ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                type="password"
                value={setupToken}
                onChange={e => setSetupToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
                placeholder="Paste your SimpleFIN setup token"
                className="flex-1 px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent text-sm"
              />
              <button
                onClick={handleConnect}
                disabled={connecting || !setupToken.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-solo-accent/20 text-theme-accent border border-theme-accent/30 rounded-lg hover:bg-solo-accent/30 transition-colors disabled:opacity-50"
              >
                <Plug className="w-4 h-4" />
                {connecting ? 'Connecting…' : 'Connect'}
              </button>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              Get a setup token by linking your bank at{' '}
              <a
                href="https://bridge.simplefin.org"
                target="_blank"
                rel="noreferrer"
                className="text-theme-accent hover:underline inline-flex items-center gap-1"
              >
                bridge.simplefin.org <ExternalLink className="w-3 h-3" />
              </a>
              — tokens are single-use.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-theme-bg rounded-lg border border-gray-700">
              <div className="flex items-center gap-3 min-w-0">
                <StatusDot status={simplefinStatus} />
                <div className="min-w-0">
                  <p className="font-medium">
                    {simplefinStatus === 'connected' ? 'Connected' : 'Connected — last sync failed'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last sync: {formatSyncTime(simplefin?.last_sync_at)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSyncNow}
                  disabled={syncing}
                  className="flex items-center gap-2 px-3 py-2 bg-solo-accent/20 text-theme-accent border border-theme-accent/30 rounded-lg hover:bg-solo-accent/30 transition-colors disabled:opacity-50 text-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing…' : 'Sync Now'}
                </button>
                <button
                  onClick={handleDisconnect}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  title="Disconnect SimpleFIN"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {simplefinStatus === 'error' && simplefin?.last_error && (
              <p className="text-xs text-yellow-400">{simplefin.last_error}</p>
            )}
            {lastSummary && !statusMessage && (
              <p className="text-xs text-gray-500">
                Last result: {lastSummary.transactions_imported} new ·{' '}
                {lastSummary.transactions_duplicates} duplicates across {lastSummary.accounts_synced}{' '}
                account{lastSummary.accounts_synced === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        )}

        {statusMessage && <p className="text-sm text-green-400 mt-3">{statusMessage}</p>}
        {connectError && <p className="text-sm text-red-400 mt-3">{connectError}</p>}
      </div>

      {/* Built-in credential-free integrations */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-2">Built-in Integrations</h3>
        <p className="text-gray-400 text-sm mb-4">
          These run through local tools and folders — no credentials stored anywhere.
        </p>
        <div className="space-y-2">
          {BUILT_IN_INTEGRATIONS.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="flex items-center justify-between p-3 bg-theme-bg rounded-lg border border-gray-700"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.description}</p>
                  </div>
                </div>
                <span className="text-xs text-gray-500 shrink-0 ml-3">{item.configure}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConnectionsPanel;
