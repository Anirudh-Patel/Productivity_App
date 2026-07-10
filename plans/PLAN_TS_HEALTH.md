# Plan: TypeScript Health + Missing Backend Commands

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

`npx tsc --noEmit` reports ~260 errors; `build` script was changed to skip tsc entirely (`vite build` only), so type safety is off. Some errors reveal real bugs: frontend calls Rust commands that don't exist (`get_user_detailed_stats`, `get_task_by_id`, `get_task_statistics` in useGameQueries.ts) and `NotificationService` methods that don't exist (`notifySystem`, `notifyTaskCreated`, `notifyAchievement`, `notifyItemPurchased`, `notifyItemUsed`).

## Interview

**Q1: Fix errors or suppress?**
- (a) **[RECOMMENDED]** Fix genuinely — align types, add missing NotificationService methods (thin wrappers over existing notify pattern), implement the 3 missing Rust commands (simple SELECT aggregations), delete dead code where the feature was removed (e.g. atoms.ts if jotai unused).
- (b) Blanket @ts-ignore.
- **Chosen: (a)**, with pragmatic deletions for dead experimental files.

**Q2: Restore tsc gate in build?**
- (a) **[RECOMMENDED]** Yes — set `"build": "tsc && vite build"` once error count is 0 (keep `build:fast` as vite-only escape hatch).
- **Chosen: (a)**.

**Q3: Task type unions mismatch ('standard' vs 'simple', numeric difficulty vs union)?**
- (a) **[RECOMMENDED]** Make types match runtime/Rust reality: Rust uses `task_type TEXT DEFAULT 'standard'` and integer difficulty 1-10. Update TS types to `'standard' | 'goal' | 'recurring'` and `number` difficulty, fixing consumers.
- **Chosen: (a)** — DB is source of truth.

## Implementation

1. Add Rust commands: `get_user_detailed_stats` (user + aggregates), `get_task_by_id`, `get_task_statistics` (counts by status/category, completion rate) — register in invoke_handler.
2. NotificationService: add missing methods as wrappers (notifySystem → info toast, notifyTaskCreated, notifyAchievement, notifyItemPurchased, notifyItemUsed).
3. Sweep TS errors file-by-file; prefer minimal correct fixes; delete dead files only when unreferenced (verify with grep).
4. Restore tsc to build script; add `build:fast`.

## Verification

- `npx tsc --noEmit` → 0 errors. `npm run build` (with tsc) passes. `cargo check` passes.
- App still boots (`npm run tauri:dev` smoke).
