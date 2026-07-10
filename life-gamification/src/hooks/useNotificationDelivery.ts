import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import useNotificationStore, { createSystemNotification } from '../store/notificationStore';
import type { NotificationPreferences, ScheduledNotification } from '../types';

const POLL_INTERVAL_MS = 60_000;

const isTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Returns true when `now` falls inside the configured quiet hours window.
 * Handles overnight windows (e.g. 22:00 -> 07:00).
 * NOTE: the backend pending view/query does NOT filter quiet hours, so this
 * is the single place quiet hours are enforced.
 */
export const isWithinQuietHours = (
  prefs: Pick<NotificationPreferences, 'quiet_hours_enabled' | 'quiet_hours_start' | 'quiet_hours_end'>,
  now: Date = new Date()
): boolean => {
  if (!prefs.quiet_hours_enabled || !prefs.quiet_hours_start || !prefs.quiet_hours_end) {
    return false;
  }
  const toMinutes = (hhmm: string): number | null => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!match) return null;
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  };
  const start = toMinutes(prefs.quiet_hours_start);
  const end = toMinutes(prefs.quiet_hours_end);
  if (start === null || end === null || start === end) return false;

  const current = now.getHours() * 60 + now.getMinutes();
  return start < end
    ? current >= start && current < end
    : current >= start || current < end; // overnight window
};

/** Short synth chime (no audio asset needed). */
const playChime = () => {
  try {
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close().catch(() => undefined);
  } catch {
    // Sound is best-effort only.
  }
};

const toInAppPriority = (priority: ScheduledNotification['priority']): 'low' | 'normal' | 'high' => {
  if (priority === 'high') return 'high';
  if (priority === 'low') return 'low';
  return 'normal';
};

/**
 * Polls the backend for due scheduled notifications every 60s and delivers
 * them as OS notifications (falling back to the in-app notification center
 * when OS permission is denied / unavailable), then marks them sent so the
 * DB trigger records history.
 */
export const useNotificationDelivery = () => {
  const osPermissionGranted = useRef(false);
  const deliveredIds = useRef<Set<number>>(new Set());
  const ticking = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const deliverOne = async (notification: ScheduledNotification, prefs: NotificationPreferences | null) => {
      if (osPermissionGranted.current && isTauri()) {
        try {
          const { sendNotification } = await import('@tauri-apps/plugin-notification');
          sendNotification({ title: notification.title, body: notification.message });
        } catch (error) {
          console.warn('OS notification failed, falling back to in-app only:', error);
        }
      }

      // Always surface it in the in-app notification center (bell dropdown);
      // when OS delivery failed this is the delivery fallback.
      useNotificationStore.getState().addNotification({
        ...createSystemNotification(notification.title, notification.message, toInAppPriority(notification.priority)),
        icon: '⏰',
        actionUrl: notification.action_url || (notification.task_id ? '#/tasks' : undefined),
        data: notification.task_id ? { taskId: notification.task_id } : undefined,
      });

      if (prefs?.sound_enabled) {
        playChime();
      }
    };

    const tick = async () => {
      if (cancelled || ticking.current) return;
      ticking.current = true;
      try {
        const store = useGameStore.getState();
        let prefs = store.notifications.preferences;
        if (!prefs) {
          try {
            await store.fetchNotificationPreferences();
            prefs = useGameStore.getState().notifications.preferences;
          } catch {
            // Preferences unavailable; proceed with defaults (deliver).
          }
        }

        // Quiet hours: skip delivery entirely; notifications stay pending and
        // will be delivered on the first tick after quiet hours end.
        if (prefs && isWithinQuietHours(prefs)) return;

        try {
          await store.fetchPendingNotifications();
        } catch {
          return; // Backend unavailable (e.g. plain browser dev) — retry next tick.
        }

        const pending = useGameStore.getState().notifications.pending;
        for (const notification of pending) {
          if (cancelled) return;
          if (deliveredIds.current.has(notification.id)) continue;
          deliveredIds.current.add(notification.id);
          try {
            await deliverOne(notification, prefs ?? null);
            await useGameStore.getState().markNotificationSent(notification.id);
          } catch (error) {
            // Allow a retry on the next tick.
            deliveredIds.current.delete(notification.id);
            console.error('Failed to deliver notification:', error);
          }
        }
      } finally {
        ticking.current = false;
      }
    };

    const init = async () => {
      if (isTauri()) {
        try {
          const { isPermissionGranted, requestPermission } = await import('@tauri-apps/plugin-notification');
          let granted = await isPermissionGranted();
          if (!granted) {
            granted = (await requestPermission()) === 'granted';
          }
          if (!cancelled) osPermissionGranted.current = granted;
        } catch (error) {
          console.warn('Notification permission check failed:', error);
        }
      }
      await tick();
    };

    void init();
    const interval = setInterval(() => void tick(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);
};

export default useNotificationDelivery;
