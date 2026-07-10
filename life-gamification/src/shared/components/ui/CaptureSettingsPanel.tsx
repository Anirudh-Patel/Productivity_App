import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FolderOpen,
  Inbox,
  RefreshCw,
} from 'lucide-react';
import { useCaptureStore } from '../../../store/captureStore';
import { useGameStore } from '../../../store/gameStore';
import type { CaptureLogEntry } from '../../../store/captureStore';

const formatScanTime = (iso?: string | null): string => {
  if (!iso) return 'Never';
  // SQLite CURRENT_TIMESTAMP is UTC without timezone marker.
  const date = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

const CaptureLogRow = ({ entry }: { entry: CaptureLogEntry }) => {
  const failed = entry.status === 'failed';
  return (
    <div className="flex items-center justify-between p-3 bg-theme-bg rounded-lg border border-gray-700">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-2 rounded-lg shrink-0 ${
            failed ? 'text-red-400 bg-red-500/20' : 'text-green-400 bg-green-500/20'
          }`}
        >
          {failed ? <AlertTriangle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate font-mono text-sm">{entry.filename}</p>
          <p className="text-xs text-gray-500">
            {formatScanTime(entry.imported_at)}
            {failed && entry.detail ? ` · ${entry.detail}` : ''}
          </p>
        </div>
      </div>
      <div className="shrink-0 text-sm text-gray-400">
        {failed ? (
          <span className="text-red-400">failed</span>
        ) : (
          <span>
            {entry.tasks_created} quest{entry.tasks_created === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
};

const CaptureSettingsPanel = () => {
  const {
    settings,
    log,
    scanning,
    lastScanSummary,
    error: scanError,
    fetchSettings,
    fetchLog,
    setFolder,
    scan,
  } = useCaptureStore();

  const [folderInput, setFolderInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchLog(20);
  }, [fetchSettings, fetchLog]);

  // Mirror the persisted folder into the input once loaded.
  useEffect(() => {
    setFolderInput(settings?.folder_path ?? '');
  }, [settings?.folder_path]);

  const handleSaveFolder = async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      await setFolder(folderInput);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSaveError(String(error));
    } finally {
      setSaving(false);
    }
  };

  const handleScanNow = async () => {
    const summary = await scan();
    if (summary && summary.tasks_created > 0) {
      await useGameStore.getState().fetchTasks();
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Inbox className="w-5 h-5" />
          Quick Capture Inbox
        </h3>
        <p className="text-gray-400 text-sm mb-3">
          Add quests from your iPhone (or anywhere) by dropping files into a watched iCloud Drive
          folder. An iPhone Shortcut — or Siri — appends lines to{' '}
          <span className="font-mono text-theme-accent">inbox.txt</span>; this app ingests each
          non-empty line as a quest, then empties the file. Standalone{' '}
          <span className="font-mono">.txt</span>/<span className="font-mono">.md</span>/
          <span className="font-mono">.json</span> files work too and are moved to{' '}
          <span className="font-mono">processed/</span> after ingest.
        </p>
        <p className="text-gray-400 text-sm">
          Line tokens: <span className="font-mono text-theme-accent">#category</span> ·{' '}
          <span className="font-mono text-theme-accent">!difficulty</span> (1–10) ·{' '}
          <span className="font-mono text-theme-accent">@YYYY-MM-DD</span> due date. Setup recipe in{' '}
          <span className="font-mono">docs/CAPTURE_SETUP.md</span>.
        </p>
      </div>

      {/* Watched Folder */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FolderOpen className="w-5 h-5" />
          Watched Folder
        </h3>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={folderInput}
            onChange={e => setFolderInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSaveFolder()}
            placeholder="~/Library/Mobile Documents/com~apple~CloudDocs/QuestInbox"
            className="flex-1 px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent text-sm font-mono"
          />
          <button
            onClick={handleSaveFolder}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-solo-accent/20 text-theme-accent border border-theme-accent/30 rounded-lg hover:bg-solo-accent/30 transition-colors disabled:opacity-50"
          >
            {saved ? <CheckCircle2 className="w-4 h-4" /> : null}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        </div>
        {saveError && <p className="text-red-400 text-sm mb-2">{saveError}</p>}
        <p className="text-xs text-gray-500">
          The iCloud Drive folder your iPhone Shortcut writes into (create a "QuestInbox" folder in
          iCloud Drive first). Leave empty to disable scanning.
        </p>
      </div>

      {/* Scan */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            <p>Last scan: {formatScanTime(settings?.last_scan_at)}</p>
            {lastScanSummary && (
              <p className="text-xs mt-1">
                {lastScanSummary.files_scanned} file(s) ingested ·{' '}
                <span className={lastScanSummary.tasks_created > 0 ? 'text-green-400' : ''}>
                  {lastScanSummary.tasks_created} quest(s) captured
                </span>
                {lastScanSummary.errors.length > 0 && (
                  <span className="text-red-400"> · {lastScanSummary.errors.length} error(s)</span>
                )}
              </p>
            )}
            <p className="text-xs mt-1 text-gray-500">Scans automatically on app start and every 5 minutes.</p>
          </div>
          <button
            onClick={handleScanNow}
            disabled={scanning || !settings?.folder_path}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning…' : 'Scan Now'}
          </button>
        </div>
        {scanError && <p className="text-red-400 text-sm mt-3">{scanError}</p>}
        {lastScanSummary && lastScanSummary.errors.length > 0 && (
          <div className="mt-3 space-y-1">
            {lastScanSummary.errors.map((error, i) => (
              <p key={i} className="text-xs text-red-400">{error}</p>
            ))}
          </div>
        )}
      </div>

      {/* Recent Captures */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Captures</h3>
        {log.length === 0 ? (
          <p className="text-gray-400 text-sm">
            Nothing captured yet. Set the watched folder above, drop a line into inbox.txt from
            your iPhone, and hit Scan Now.
          </p>
        ) : (
          <div className="space-y-2">
            {log.map(entry => (
              <CaptureLogRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaptureSettingsPanel;
