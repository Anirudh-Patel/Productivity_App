import { useEffect } from 'react';
import { AlarmClock, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useGameStore } from '../../../store/gameStore';
import type { ScheduledNotification } from '../../../types';

/**
 * SQLite naive timestamps ("YYYY-MM-DD HH:MM:SS") are UTC — append Z so the
 * browser doesn't interpret them as local time.
 */
export const parseDbDate = (value: string): Date => {
  const hasTimezone = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value.replace(' ', 'T')}Z`);
};

const effectiveTime = (reminder: ScheduledNotification): Date =>
  parseDbDate(reminder.status === 'snoozed' && reminder.snoozed_until
    ? reminder.snoozed_until
    : reminder.scheduled_for);

/**
 * Pending/snoozed scheduled reminders shown at the top of the bell dropdown,
 * with quick snooze (10m / 1h) and cancel actions.
 */
const UpcomingRemindersSection = () => {
  const scheduled = useGameStore((state) => state.notifications.scheduled);
  const { fetchScheduledNotifications, snoozeNotification, cancelNotification } = useGameStore();

  useEffect(() => {
    fetchScheduledNotifications().catch(() => undefined);
  }, [fetchScheduledNotifications]);

  const upcoming = scheduled
    .filter((n) => n.status === 'pending' || n.status === 'snoozed')
    .sort((a, b) => effectiveTime(a).getTime() - effectiveTime(b).getTime())
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <div className="p-3 border-b border-gray-700 bg-theme-bg/40">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        <AlarmClock className="w-3 h-3 text-theme-accent" />
        Upcoming Reminders
      </div>
      <div className="space-y-2">
        {upcoming.map((reminder) => {
          const when = effectiveTime(reminder);
          const isValidDate = !Number.isNaN(when.getTime());
          return (
            <div
              key={reminder.id}
              className="flex items-center gap-2 p-2 rounded-lg bg-theme-primary border border-gray-700"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{reminder.title}</p>
                <p className="text-xs text-gray-400 truncate">{reminder.message}</p>
                <p className="text-xs text-theme-accent mt-0.5">
                  {isValidDate ? formatDistanceToNow(when, { addSuffix: true }) : reminder.scheduled_for}
                  {reminder.status === 'snoozed' && ' (snoozed)'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => snoozeNotification(reminder.id, 10).catch(() => undefined)}
                  className="px-1.5 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  title="Snooze 10 minutes"
                >
                  10m
                </button>
                <button
                  onClick={() => snoozeNotification(reminder.id, 60).catch(() => undefined)}
                  className="px-1.5 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                  title="Snooze 1 hour"
                >
                  1h
                </button>
                <button
                  onClick={() => cancelNotification(reminder.id).catch(() => undefined)}
                  className="p-1 rounded hover:bg-gray-600 text-gray-400 hover:text-red-400 transition-colors"
                  title="Cancel reminder"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingRemindersSection;
