import { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, Pause, Square, Timer as TimerIcon } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';

/**
 * Format a number of seconds as H:MM:SS (or MM:SS when under an hour).
 */
const formatElapsed = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
};

/**
 * Parse a SQLite datetime string as UTC. The backend stores naive UTC
 * timestamps (e.g. "2026-07-10 14:23:05"); appending "Z" ensures the browser
 * interprets them as UTC rather than local time.
 */
const parseServerTime = (value: string): number => {
  if (!value) return Date.now();
  // Already has timezone info (ISO with Z or offset)
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim());
  const normalized = hasTz ? value : `${value.replace(' ', 'T')}Z`;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

/**
 * Global timer widget. Subscribes to the active timer in the game store and
 * displays a ticking, restart-safe elapsed time derived from the timer's
 * start_time (never from locally accumulated state). Renders nothing when no
 * timer is active. Mounted globally in the Layout so it persists across pages.
 */
const TimerWidget = () => {
  const activeTimer = useGameStore((s) => s.timer.active);
  const loading = useGameStore((s) => s.timer.loading);
  const activeTasks = useGameStore((s) => s.tasks.active);
  const completedTasks = useGameStore((s) => s.tasks.completed);
  const getActiveTimer = useGameStore((s) => s.getActiveTimer);
  const pauseTimer = useGameStore((s) => s.pauseTimer);
  const stopTimer = useGameStore((s) => s.stopTimer);

  const [now, setNow] = useState(() => Date.now());

  // Restore any running timer once on mount (survives app restart).
  useEffect(() => {
    getActiveTimer().catch(() => {
      /* handled + surfaced inside the store */
    });
  }, [getActiveTimer]);

  // Tick every second only while a timer is running and not paused.
  useEffect(() => {
    if (!activeTimer || activeTimer.is_paused) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [activeTimer]);

  const taskTitle = useMemo(() => {
    if (!activeTimer) return '';
    const match =
      activeTasks.find((t) => t.id === activeTimer.task_id) ||
      completedTasks.find((t) => t.id === activeTimer.task_id);
    return match?.title ?? `Task #${activeTimer.task_id}`;
  }, [activeTimer, activeTasks, completedTasks]);

  // Elapsed = (now - start) - paused, all derived from server-provided values.
  const elapsedSeconds = useMemo(() => {
    if (!activeTimer) return 0;
    const startMs = parseServerTime(activeTimer.start_time);
    const pausedSeconds = activeTimer.total_paused_seconds || 0;
    if (activeTimer.is_paused) {
      const pausedAtMs = activeTimer.paused_at
        ? parseServerTime(activeTimer.paused_at)
        : now;
      return (pausedAtMs - startMs) / 1000 - pausedSeconds;
    }
    return (now - startMs) / 1000 - pausedSeconds;
  }, [activeTimer, now]);

  const handlePauseResume = useCallback(() => {
    pauseTimer().catch(() => undefined);
  }, [pauseTimer]);

  const handleStop = useCallback(() => {
    stopTimer().catch(() => undefined);
  }, [stopTimer]);

  if (!activeTimer) return null;

  const isPaused = activeTimer.is_paused;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 max-w-[calc(100vw-2rem)]">
      <div className="bg-theme-primary/95 backdrop-blur border border-theme-accent/40 rounded-xl shadow-lg shadow-theme-accent/10 p-4">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={`flex items-center justify-center w-6 h-6 rounded-md ${
              isPaused
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-theme-accent/20 text-theme-accent'
            }`}
          >
            <TimerIcon className="w-4 h-4" />
          </span>
          <span className="text-xs uppercase tracking-wide text-gray-400">
            {isPaused ? 'Paused' : 'Focus Session'}
          </span>
          {!isPaused && (
            <span className="ml-auto flex items-center gap-1 text-[10px] text-theme-accent">
              <span className="w-2 h-2 rounded-full bg-theme-accent animate-pulse" />
              Live
            </span>
          )}
        </div>

        <div className="mb-1 text-sm font-medium truncate" title={taskTitle}>
          {taskTitle}
        </div>

        <div className="font-mono text-2xl font-bold tabular-nums mb-3">
          {formatElapsed(elapsedSeconds)}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePauseResume}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 bg-theme-bg hover:border-theme-accent/50 hover:text-theme-accent transition-colors disabled:opacity-50 text-sm"
            title={isPaused ? 'Resume timer' : 'Pause timer'}
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                Pause
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleStop}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 text-sm"
            title="Stop timer and save session"
          >
            <Square className="w-4 h-4" />
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimerWidget;
