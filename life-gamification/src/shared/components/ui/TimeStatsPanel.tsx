import { useEffect, useMemo } from 'react';
import { Clock, CalendarDays, Timer as TimerIcon } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import type { TimeSession } from '../../../types';

/** Format seconds as a human-friendly duration, e.g. "2h 15m" or "8m". */
const formatDuration = (totalSeconds: number): string => {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.round((safe % 3600) / 60);
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  if (minutes > 0) return `${minutes}m`;
  return `${safe}s`;
};

/**
 * Parse a SQLite datetime string (naive UTC) into a Date, forcing UTC
 * interpretation when no timezone marker is present.
 */
const parseServerDate = (value?: string): Date | null => {
  if (!value) return null;
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim());
  const normalized = hasTz ? value : `${value.replace(' ', 'T')}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
};

const startOfToday = (): Date => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const startOfWeek = (): Date => {
  const d = startOfToday();
  // Week starts on Monday.
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
};

/**
 * Stats-page panel summarizing tracked time: totals for today and this week,
 * plus the top tasks by time spent. Fetches completed sessions on mount.
 */
const TimeStatsPanel = () => {
  const sessions = useGameStore((s) => s.timer.sessions);
  const loading = useGameStore((s) => s.timer.loading);
  const activeTasks = useGameStore((s) => s.tasks.active);
  const completedTasks = useGameStore((s) => s.tasks.completed);
  const fetchTimeSessions = useGameStore((s) => s.fetchTimeSessions);

  useEffect(() => {
    // Pull a generous window of recent sessions for aggregation.
    fetchTimeSessions(undefined, 500).catch(() => undefined);
  }, [fetchTimeSessions]);

  const taskTitleById = useMemo(() => {
    const map = new Map<number, string>();
    [...activeTasks, ...completedTasks].forEach((t) => map.set(t.id, t.title));
    return map;
  }, [activeTasks, completedTasks]);

  const { todaySeconds, weekSeconds, topTasks } = useMemo(() => {
    const todayStart = startOfToday().getTime();
    const weekStart = startOfWeek().getTime();
    let today = 0;
    let week = 0;
    const perTask = new Map<number, number>();

    (sessions as TimeSession[]).forEach((session) => {
      const duration = session.duration_seconds || 0;
      if (duration <= 0) return;
      const start = parseServerDate(session.start_time);
      if (!start) return;
      const startMs = start.getTime();
      if (startMs >= todayStart) today += duration;
      if (startMs >= weekStart) week += duration;
      perTask.set(session.task_id, (perTask.get(session.task_id) || 0) + duration);
    });

    const ranked = Array.from(perTask.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([taskId, seconds]) => ({
        taskId,
        seconds,
        title: taskTitleById.get(taskId) ?? `Task #${taskId}`,
      }));

    return { todaySeconds: today, weekSeconds: week, topTasks: ranked };
  }, [sessions, taskTitleById]);

  const hasData = sessions.length > 0;

  return (
    <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TimerIcon className="w-5 h-5 text-theme-accent" />
        Time Tracked
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-theme-bg rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Clock className="w-4 h-4" />
            Today
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {formatDuration(todaySeconds)}
          </div>
        </div>
        <div className="bg-theme-bg rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <CalendarDays className="w-4 h-4" />
            This Week
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {formatDuration(weekSeconds)}
          </div>
        </div>
      </div>

      <h4 className="text-sm font-medium text-gray-300 mb-2">Top Tasks</h4>
      {loading && !hasData ? (
        <div className="text-sm text-gray-400 py-4 text-center">Loading sessions…</div>
      ) : topTasks.length === 0 ? (
        <div className="text-center py-6 text-gray-400">
          <TimerIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tracked time yet</p>
          <p className="text-xs mt-1">Start a timer on a quest to begin tracking.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {topTasks.map((entry) => (
            <div
              key={entry.taskId}
              className="flex items-center justify-between p-3 bg-theme-bg rounded-lg"
            >
              <span className="text-sm font-medium truncate mr-3" title={entry.title}>
                {entry.title}
              </span>
              <span className="text-sm text-theme-accent tabular-nums shrink-0">
                {formatDuration(entry.seconds)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TimeStatsPanel;
