# Plan: GitHub Issues → Tasks

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

User wants open GitHub issues from connected repos to appear as tasks automatically (productivity-automation priority #3). No GitHub integration exists.

## Interview

**Q1: Auth mechanism?**
- (a) **[RECOMMENDED]** Shell out to the locally-installed, already-authenticated `gh` CLI from Rust (`gh api` / `gh issue list --json`). Zero credential management, works with both of the user's accounts, no OAuth app registration.
- (b) GitHub REST with a PAT stored in the DB.
- (c) Full OAuth device flow.
- **Chosen: (a)** — personal desktop app on a machine where `gh` is authed; simplest and most secure (no stored secrets).

**Q2: Which repos?**
- (a) **[RECOMMENDED]** User-managed watchlist: `github_repos` table (owner/name, enabled). Settings section lists repos; add via text input `owner/repo`, validate with `gh repo view`.
- (b) Auto-discover all repos.
- **Chosen: (a)** — explicit control, avoids noise from forks/archived repos.

**Q3: Sync model?**
- (a) **[RECOMMENDED]** Pull-based sync: on app start + manual "Sync now" button + every 30 min. Open issues → tasks (category 'work', difficulty from labels if present, else 3). `github_issue_id` column links task↔issue; issue closed on GitHub → auto-complete the task (grants XP); task completed in-app → optionally close the issue (setting, default ON) via `gh issue close`.
- (b) Webhooks (needs public endpoint — no).
- **Chosen: (a)**.

**Q4: Where does the UI live?**
- (a) **[RECOMMENDED]** Settings → "GitHub" section (repo watchlist, sync toggle, close-on-complete toggle, last-sync time) + sync-status line and manual sync button on Tasks page near the project chip bar. Imported tasks show a GitHub tag (octicon-style mark + repo#number) linking nowhere fancy — just visual.
- **Chosen: (a)**.

## Implementation

1. Migration `009_github_integration.sql`: `github_repos` (id, owner, name, enabled, last_synced_at), tasks columns `github_issue_id INTEGER`, `github_repo TEXT`, `github_issue_number INTEGER`; unique index on (github_repo, github_issue_number).
2. Rust `src-tauri/src/commands/github.rs`: 
   - `github_check_cli()` → is gh installed+authed (`gh auth status`),
   - `github_add_repo(owner_repo)` (validate via `gh repo view --json name`),
   - `github_list_repos()` / `github_remove_repo(id)` / `github_toggle_repo(id)`,
   - `github_sync()` → for each enabled repo: `gh issue list --repo O/R --state open --json number,title,body,labels,url` → upsert tasks (skip existing open ones, update titles); then for tasks with github_issue_id whose issue is now closed → complete_task; returns summary counts. Run `gh` via `std::process::Command`, parse JSON with serde_json. 30-min interval: frontend setInterval calling the command (simpler than tokio task).
   - `github_close_issue(repo, number)` — called by complete flow when setting enabled.
3. Register module + commands in lib.rs invoke_handler (keep additions in one small block at the end of the list to minimize merge conflicts).
4. Frontend: `githubStore.ts` (repos, syncing, lastSync, settings via preferences or table), Settings "GitHub" panel, sync button + status on Tasks page, GitHub tag on task cards (repo#number).
5. On task completion in gameStore.completeTask: if task has github fields and close-on-complete on → invoke `github_close_issue` (non-fatal on failure).

## Out of scope

PRs, issue creation from tasks, comments, multiple-account routing (gh active account is used).

## Verification

- `cargo check` + `npm run build` pass.
- With a real repo: add repo → sync → open issues appear as tasks with tags; close an issue on GitHub → next sync completes task; complete a task in-app → issue closes.
