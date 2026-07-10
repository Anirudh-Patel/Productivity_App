# Claude Code — Life Gamification Productivity App

> SECURITY NOTE: A previous version of this file contained a hardcoded Gemini API key,
> committed to this public repo. The key must be treated as compromised and rotated at
> https://aistudio.google.com/apikey. Never commit API keys; use environment variables.

## Project

- **Type:** Tauri 2 desktop app (personal, single-user)
- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS, Framer Motion, Zustand, React Router (HashRouter)
- **Backend:** Rust (src-tauri), rusqlite with migrations embedded via `include_str!` in `src-tauri/src/database.rs`
- **Database:** SQLite (`src-tauri/game.db` in dev); schema created by migrations 001–008 at startup

## Commands

- Dev: `cd life-gamification && npm run tauri:dev` (web only: `npm run dev`)
- Build: `npm run build` (vite) / `npm run build:check` (tsc + vite) / `npm run tauri:build`
- Lint: `npm run lint` · Rust: `cd src-tauri && cargo check`

## Layout

- Pages: `life-gamification/src/pages/` · Shared UI: `src/shared/components/ui/`
- Stores: `src/store/` (gameStore is primary) · Types: `src/types/index.ts`
- Rust commands: `src-tauri/src/lib.rs` (registered in `invoke_handler`) + `src-tauri/src/commands/`
- Migrations: `src-tauri/migrations/` — new migrations must also be added to `run_migrations()` in `database.rs`
- Feature plans: `plans/PLAN_*.md` (interview format, decisions recorded)

## Conventions

- Frontend calls Rust via `invoke('command_name', {...})`; keep command names/payloads in sync with gameStore.
- Dark gamified "Solo Leveling" visual theme — see `App-style-guide.md`; match surrounding component styling.
- Don't modify already-applied migration files; add new ones.
- Priority direction (2026-07-10): productivity automation first (calendar sync, GitHub issues → tasks, spending tracking, workout verification), gaming polish second. Tasks are the engine; game is the reward layer.
