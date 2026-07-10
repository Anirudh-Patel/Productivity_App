import { useEffect, useState } from 'react';
import {
  Activity,
  Bike,
  CheckCircle2,
  Dumbbell,
  Flame,
  FolderOpen,
  Footprints,
  MapPin,
  RefreshCw,
  Timer,
} from 'lucide-react';
import { useHealthStore } from '../../../store/healthStore';
import { useGameStore } from '../../../store/gameStore';
import type { Workout } from '../../../store/healthStore';

const formatScanTime = (iso?: string | null): string => {
  if (!iso) return 'Never';
  // SQLite CURRENT_TIMESTAMP is UTC without timezone marker.
  const date = new Date(iso.includes('T') || iso.endsWith('Z') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString();
};

// Workout start_time is stored as local wall time "YYYY-MM-DD HH:MM:SS".
const formatWorkoutTime = (local: string): string => {
  const date = new Date(local.replace(' ', 'T'));
  if (isNaN(date.getTime())) return local;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const WORKOUT_TYPE_META: Record<string, { icon: typeof Activity; color: string; label: string }> = {
  run: { icon: Footprints, color: 'text-orange-400 bg-orange-500/20', label: 'Run' },
  strength: { icon: Dumbbell, color: 'text-red-400 bg-red-500/20', label: 'Strength' },
  cycling: { icon: Bike, color: 'text-green-400 bg-green-500/20', label: 'Cycling' },
  walk: { icon: Footprints, color: 'text-blue-400 bg-blue-500/20', label: 'Walk' },
  other: { icon: Activity, color: 'text-purple-400 bg-purple-500/20', label: 'Workout' },
};

const WorkoutRow = ({ workout }: { workout: Workout }) => {
  const meta = WORKOUT_TYPE_META[workout.workout_type] ?? WORKOUT_TYPE_META.other;
  const Icon = meta.icon;
  const minutes = Math.round(workout.duration_seconds / 60);

  return (
    <div className="flex items-center justify-between p-3 bg-theme-bg rounded-lg border border-gray-700">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`p-2 rounded-lg shrink-0 ${meta.color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{workout.workout_name}</p>
          <p className="text-xs text-gray-500">{formatWorkoutTime(workout.start_time)}</p>
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0 text-sm text-gray-400">
        <span className="flex items-center gap-1" title="Duration">
          <Timer className="w-3.5 h-3.5" />
          {minutes} min
        </span>
        {workout.distance_m != null && workout.distance_m > 0 && (
          <span className="hidden sm:flex items-center gap-1" title="Distance">
            <MapPin className="w-3.5 h-3.5" />
            {(workout.distance_m / 1000).toFixed(1)} km
          </span>
        )}
        {workout.calories != null && workout.calories > 0 && (
          <span className="hidden md:flex items-center gap-1" title="Active calories">
            <Flame className="w-3.5 h-3.5" />
            {Math.round(workout.calories)} kcal
          </span>
        )}
      </div>
    </div>
  );
};

const HealthSettingsPanel = () => {
  const {
    settings,
    workouts,
    scanning,
    lastScanSummary,
    error: scanError,
    fetchSettings,
    fetchWorkouts,
    setFolder,
    scan,
  } = useHealthStore();

  const [folderInput, setFolderInput] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchWorkouts(20);
  }, [fetchSettings, fetchWorkouts]);

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
    if (summary && summary.tasks_verified > 0) {
      await useGameStore.getState().fetchTasks();
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Apple Health Workouts
        </h3>
        <p className="text-gray-400 text-sm">
          Apple Watch workouts verify your fitness quests. Install the{' '}
          <span className="text-theme-accent">Health Auto Export</span> app on your iPhone and set it
          to export workout JSON to an iCloud Drive folder on a schedule. This app watches that
          folder, imports workouts, and auto-completes matching fitness/health quests with{' '}
          <span className="text-theme-accent">+50% bonus XP</span>.
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
            placeholder="~/Library/Mobile Documents/com~apple~CloudDocs/HealthAutoExport"
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
          The iCloud Drive folder your iPhone exports workout JSON files into. Leave empty to
          disable scanning.
        </p>
      </div>

      {/* Scan */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-400">
            <p>Last scan: {formatScanTime(settings?.last_scan_at)}</p>
            {lastScanSummary && (
              <p className="text-xs mt-1">
                {lastScanSummary.files_scanned} file(s) scanned ·{' '}
                {lastScanSummary.workouts_imported} workout(s) imported ·{' '}
                <span className={lastScanSummary.tasks_verified > 0 ? 'text-green-400' : ''}>
                  {lastScanSummary.tasks_verified} quest(s) verified
                </span>
                {lastScanSummary.errors.length > 0 && (
                  <span className="text-red-400"> · {lastScanSummary.errors.length} error(s)</span>
                )}
              </p>
            )}
            <p className="text-xs mt-1 text-gray-500">Scans automatically on app start and every 15 minutes.</p>
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

      {/* Recent Workouts */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Workouts</h3>
        {workouts.length === 0 ? (
          <p className="text-gray-400 text-sm">
            No workouts imported yet. Set the watched folder above and hit Scan Now once your
            iPhone has exported some workouts.
          </p>
        ) : (
          <div className="space-y-2">
            {workouts.map(workout => (
              <WorkoutRow key={workout.id} workout={workout} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HealthSettingsPanel;
