# Plan: Time Tracking UI (Sprint 7 completion)

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

Sprint 7 delivered backend (migration 007: `time_sessions`, `active_timers`, analytics views; 7 Rust commands; gameStore timer actions + state) but no UI. Timers can't be started from anywhere.

## Interview

**Q1: Where does the user start a timer?**
- (a) **[RECOMMENDED]** Play button on each task card (visible on hover/always for in-progress tasks). One click to start focus session on that task.
- (b) Only from a timer page.
- **Chosen: (a)** — friction kills time tracking; task card is where the intent is.

**Q2: Active timer display?**
- (a) **[RECOMMENDED]** Compact floating/pinned `TimerWidget` (bottom of sidebar or fixed corner) visible on all pages: task title, elapsed mm:ss ticking client-side, pause/stop buttons. On mount, `getActiveTimer()` to restore after app restart.
- (b) Only inside the task card.
- **Chosen: (a)** — user navigates away; timer must stay visible.

**Q3: Session types (focus/break/pomodoro)?**
- (a) **[RECOMMENDED]** Default to `focus` on the task-card button; expose type picker only in the TimerWidget when no timer is running (optional dropdown). Keep pomodoro logic out of v1.
- (b) Full pomodoro cycle engine.
- **Chosen: (a)** — backend supports types; full pomodoro automation is a later feature.

**Q4: Where do stats show?**
- (a) **[RECOMMENDED]** (1) Task card shows `actual/estimated` minutes when either exists; (2) small "Time" panel on Stats page: today + this week totals and top tasks, from `get_time_stats`/`get_time_sessions`.
- (b) Dedicated analytics dashboard.
- **Chosen: (a)** — reuse existing Stats page; the views in migration 007 already aggregate.

**Q5: Estimated time entry?**
- (a) **[RECOMMENDED]** Numeric "estimate (min)" field in CreateTaskModal advanced section + inline edit from task card menu via `updateEstimatedTime`.
- **Chosen: (a)**.

## Implementation

1. `TimerWidget.tsx`: subscribes to `timer.active`; ticking display (setInterval, derive from `start_time` not local accumulation so restart-safe); pause/resume/stop (stop prompts optional note — keep simple: stop directly); renders nothing when idle unless hovered start affordance. Mount in `Layout` so it's global. Call `getActiveTimer()` once on mount.
2. Task card: play/stop button → `startTimer(taskId)` / `stopTimer()`; show ⏱ `Xm / Ym est` line when data exists.
3. CreateTaskModal: estimate input → after task creation call `updateEstimatedTime` (or pass through if request supports it).
4. Stats page: `TimeStatsPanel` — today/week totals, per-task top-5 (fetchTimeStats/fetchTimeSessions on mount).
5. Guard: starting a timer while one runs → stop current first (store already handles? if not, stop then start).
6. Style per `App-style-guide.md` (dark gamified theme).

## Out of scope

Pomodoro cycles, idle detection, XP rewards for tracked time, exporting.

## Verification

- `npm run build` passes; no new tsc errors in changed files.
- Start → widget ticks; restart app → widget restores; stop → session row in `time_sessions`; stats panel shows totals.
