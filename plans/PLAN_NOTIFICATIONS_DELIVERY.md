# Plan: Notifications Delivery + Settings UI (Sprint 8 completion)

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

Sprint 8 delivered scheduling backend (migration 008: preferences/scheduled/history tables, 9 Rust commands, gameStore actions) but nothing ever *delivers* a notification, and there is no UI to manage preferences or set reminders.

## Interview

**Q1: Delivery mechanism?**
- (a) **[RECOMMENDED]** Frontend polling loop in `NotificationProvider`: every 60s call `fetchPendingNotifications()`; for each due notification show OS-level notification via `@tauri-apps/plugin-notification` (fall back to in-app toast if permission denied), then `markNotificationActioned`/mark sent. Simple, testable, no Rust async runtime work.
- (b) Rust-side tokio interval task emitting Tauri events.
- **Chosen: (a)** — app is open when it matters (personal desktop app); avoids adding Rust background-task complexity. Note: requires adding the notification plugin to Cargo.toml + capability permissions.

**Q2: Where do preferences live in the UI?**
- (a) **[RECOMMENDED]** `NotificationSettingsPanel` section inside existing Settings page: master toggle, quiet hours start/end, sound on/off, default reminder lead time.
- (b) New page.
- **Chosen: (a)**.

**Q3: Reminder creation UX?**
- (a) **[RECOMMENDED]** In CreateTaskModal advanced section: "Remind me" select (none/at due/15m/1h/1d before) — schedules via `scheduleNotification` after task creation when a due date exists. Plus DB trigger from migration 008 already auto-schedules for tasks with due dates.
- (b) Full custom datetime picker.
- **Chosen: (a)** — presets cover personal use.

**Q4: Visibility of pending/history?**
- (a) **[RECOMMENDED]** Bell icon with count badge in the top bar/sidebar opening a dropdown: pending reminders (with snooze 10m/1h + cancel) and recent history. Reuse existing notification dropdown component if present (NotificationProvider already renders in-app notifications).
- **Chosen: (a)**.

## Implementation

1. Add `tauri-plugin-notification` (Cargo.toml + `lib.rs` builder `.plugin(...)` + `capabilities/default.json` permission + npm `@tauri-apps/plugin-notification`).
2. Delivery hook `useNotificationDelivery` mounted in NotificationProvider: interval 60s → `get_pending_notifications`; respect quiet hours from preferences (backend view already filters — verify 008 SQL); send OS notification; mark sent via existing command (check names in lib.rs); play sound if enabled.
3. `NotificationSettingsPanel` in Settings page wired to `fetchNotificationPreferences`/`updateNotificationPreferences`.
4. Reminder select in CreateTaskModal → `scheduleNotification` post-create.
5. Bell + badge + dropdown (pending list, snooze/cancel buttons → store actions).

## Out of scope

Recurring notification rules, email/mobile push, notification sounds beyond a single chime.

## Verification

- `cargo check` + `npm run build` pass.
- Schedule a reminder 1 min out → OS notification fires; snooze reschedules; quiet hours suppress; history row appears.
