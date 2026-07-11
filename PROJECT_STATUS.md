# Project Status

**Updated:** 2026-07-12 · **Branch:** main (all feature branches merged and deleted)

## Where things stand

The app is an operational personal productivity system with a gamification layer. Priority per user direction: productivity/task automation first, gaming polish second.

### Productivity core — DONE
- Tasks/quests CRUD, projects (chip filter, modal, assignment), recurring tasks with streaks, time tracking (task-card timer, global widget, stats panel), quick-add + command palette, notifications (OS-level delivery, quiet hours, reminder picker, bell dropdown).

### Automation integrations — DONE (setup steps in docs/INTEGRATIONS_SETUP.md)
- **GitHub issues → quests** (gh CLI, two-way completion)
- **Calendar.app two-way sync** (events ↔ quests, "Quests" calendar push; covers Google via Internet Accounts)
- **Apple Watch workout verification** (Health Auto Export folder watch, +50% verified bonus XP)
- **Apple Reminders two-way** (Siri capture path)
- **Quick-capture inbox** (iPhone Shortcut → iCloud folder → quests, token syntax)
- **Finance** (bank/Robinhood CSV import, auto-categorization rules, Finance page with charts)

### Gaming layer — working stage (parked per priority)
- XP/levels/stats, achievements, shop + inventory + buffs + titles (DB-persisted as of Sprint 9), avatar/equipment, POE-style skill tree, quest chains.

### Deferred (needs user action or later phase)
- SimpleFIN/Plaid live bank sync (user signup; schema ready)
- Robinhood portfolio positions
- Sleep-data quest scaling, deeper gaming polish
- Test coverage expansion (Rust has 41 unit tests across integrations; frontend untested)

## Tech facts
- Tauri 2 + React 19 + TS + Zustand + Tailwind; rusqlite; migrations 001–014 embedded in `database.rs` (`run_migrations`).
- Feature plans with decision records: `plans/PLAN_*.md`.
- Known repo history issue: a Gemini API key was committed to this public repo until 2026-07-10 (removed; **must be rotated by user**).
