import { useEffect, useState } from 'react';
import { Bell, BellRing, Clock, Moon, Volume2 } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import type { UpdateNotificationPreferencesRequest } from '../../../types';

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const REMINDER_LEAD_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

const ToggleRow = ({ title, description, checked, onChange, disabled }: ToggleRowProps) => (
  <div className="flex justify-between items-center">
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
    <label className={`relative inline-flex items-center ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
    </label>
  </div>
);

/**
 * Settings > Notifications section. Wired to notification_preferences via
 * gameStore (get/update_notification_preferences commands).
 */
const NotificationSettingsPanel = () => {
  const { notifications, fetchNotificationPreferences, updateNotificationPreferences } = useGameStore();
  const preferences = notifications.preferences;
  const [osPermission, setOsPermission] = useState<'granted' | 'denied' | 'unknown'>('unknown');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!preferences) {
      fetchNotificationPreferences().catch(() => undefined);
    }
  }, [preferences, fetchNotificationPreferences]);

  useEffect(() => {
    let cancelled = false;
    if (isTauri()) {
      import('@tauri-apps/plugin-notification')
        .then(({ isPermissionGranted }) => isPermissionGranted())
        .then((granted) => {
          if (!cancelled) setOsPermission(granted ? 'granted' : 'denied');
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const requestOsPermission = async () => {
    if (!isTauri()) return;
    try {
      const { requestPermission } = await import('@tauri-apps/plugin-notification');
      const result = await requestPermission();
      setOsPermission(result === 'granted' ? 'granted' : 'denied');
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    }
  };

  const save = async (patch: UpdateNotificationPreferencesRequest) => {
    setSaving(true);
    try {
      await updateNotificationPreferences(patch);
    } catch {
      // Store already surfaces the error toast.
    } finally {
      setSaving(false);
    }
  };

  if (!preferences) {
    return (
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <div className="text-center py-12 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
          <p>Loading notification preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* OS Permission */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BellRing className="w-5 h-5" />
          System Notifications
        </h3>
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">OS notification permission</p>
            <p className="text-sm text-gray-400">
              {osPermission === 'granted'
                ? 'Granted — reminders will appear as system notifications'
                : osPermission === 'denied'
                  ? 'Not granted — reminders will only appear inside the app'
                  : 'Only available in the desktop app'}
            </p>
          </div>
          {osPermission === 'granted' ? (
            <span className="px-3 py-1 text-sm rounded-lg bg-green-500/20 text-green-400 border border-green-500/30">
              Enabled
            </span>
          ) : (
            <button
              onClick={requestOsPermission}
              disabled={osPermission === 'unknown'}
              className="px-4 py-2 bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent border border-theme-accent/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Enable
            </button>
          )}
        </div>
      </div>

      {/* Reminder Preferences */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Quest Reminders
        </h3>
        <div className="space-y-4">
          <ToggleRow
            title="Due date reminders"
            description="Get notified before a quest is due"
            checked={preferences.due_reminders_enabled}
            disabled={saving}
            onChange={(checked) => save({ due_reminders_enabled: checked })}
          />
          <ToggleRow
            title="Overdue alerts"
            description="Get notified when a quest becomes overdue"
            checked={preferences.overdue_alerts_enabled}
            disabled={saving}
            onChange={(checked) => save({ overdue_alerts_enabled: checked })}
          />
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Default reminder time</p>
              <p className="text-sm text-gray-400">How long before the due date to remind you</p>
            </div>
            <select
              value={preferences.reminder_minutes_before}
              disabled={saving}
              onChange={(e) => save({ reminder_minutes_before: parseInt(e.target.value, 10) })}
              className="px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent disabled:opacity-50"
            >
              {REMINDER_LEAD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
              {!REMINDER_LEAD_OPTIONS.some((o) => o.value === preferences.reminder_minutes_before) && (
                <option value={preferences.reminder_minutes_before}>
                  {preferences.reminder_minutes_before} minutes before
                </option>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Quiet Hours & Sound */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Moon className="w-5 h-5" />
          Quiet Hours & Sound
        </h3>
        <div className="space-y-4">
          <ToggleRow
            title="Quiet hours"
            description="Pause notification delivery during a daily window"
            checked={preferences.quiet_hours_enabled}
            disabled={saving}
            onChange={(checked) =>
              save({
                quiet_hours_enabled: checked,
                // Provide sane defaults the first time it's enabled.
                quiet_hours_start: preferences.quiet_hours_start || '22:00',
                quiet_hours_end: preferences.quiet_hours_end || '07:00',
              })
            }
          />
          {preferences.quiet_hours_enabled && (
            <div className="flex items-center gap-4 pl-4 border-l-2 border-theme-accent/30">
              <div>
                <label className="block text-xs text-gray-400 mb-1">From</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_start || '22:00'}
                  disabled={saving}
                  onChange={(e) => save({ quiet_hours_start: e.target.value })}
                  className="px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Until</label>
                <input
                  type="time"
                  value={preferences.quiet_hours_end || '07:00'}
                  disabled={saving}
                  onChange={(e) => save({ quiet_hours_end: e.target.value })}
                  className="px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent disabled:opacity-50"
                />
              </div>
            </div>
          )}
          <ToggleRow
            title="Notification sound"
            description="Play a chime when a reminder is delivered"
            checked={preferences.sound_enabled}
            disabled={saving}
            onChange={(checked) => save({ sound_enabled: checked })}
          />
          {preferences.sound_enabled && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Volume2 className="w-3 h-3" />
              A short chime plays alongside each delivered reminder.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPanel;
