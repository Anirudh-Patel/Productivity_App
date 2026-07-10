# Plan: Quick-Capture Inbox (iPhone/Siri/Shortcuts → Quests)

**Date:** 2026-07-10 · **Status:** Approved (interview answered with recommended options) · **Executor:** Claude subagent

## Problem

No way to add quests from the phone or anywhere outside the app. A watched iCloud Drive "inbox" folder turns ANY device into a capture surface: an iPhone Shortcut (or Siri "add to my quests" shortcut, or any tool that can write a file to iCloud) drops a small text/JSON file; the desktop app ingests it into tasks. Same folder-watch pattern as the Health integration — proven, zero credentials, no server.

## Interview

**Q1: File format?**
- (a) **[RECOMMENDED]** Both: plain `.txt`/`.md` (each non-empty line = one task title; optional `#category` and `!difficulty1-10` and `@YYYY-MM-DD` tokens parsed out) and `.json` (`{"tasks":[{"title":...,"category":...,"difficulty":...,"due_date":...}]}`). Plain text keeps the iPhone Shortcut trivial (one "Append to file" action).
- **Chosen: (a)**.

**Q2: Post-ingest file handling?**
- (a) **[RECOMMENDED]** Move processed files into `processed/` subfolder (audit trail, no reprocessing). Malformed files → `failed/` with reason file.
- (b) Delete.
- **Chosen: (a)**.

**Q3: Scan cadence?**
- (a) **[RECOMMENDED]** App start + every 5 min + manual "Scan inbox" button (Settings → Capture). Toast per ingested batch ("3 quests captured from inbox").
- **Chosen: (a)**.

**Q4: Ship a Shortcut?**
- (a) **[RECOMMENDED]** Document the 2-action iPhone Shortcut recipe (Ask for Input → Append to iCloud file `QuestInbox/inbox.txt`) in `docs/CAPTURE_SETUP.md`; appending to a single `inbox.txt` is also supported (ingest lines, then truncate file) since Shortcuts appends more easily than creating unique files.
- **Chosen: (a)** — support both one-file-append and file-per-capture.

## Implementation

1. Migration `014_capture.sql`: `capture_settings` (folder path), `capture_log` (filename, lines, imported_at).
2. Rust `commands/capture.rs`: `set_capture_folder`, `get_capture_settings`, `scan_capture_inbox` (list files, parse txt/md/json, create tasks via existing creation SQL with sensible defaults: category from #token else 'general', difficulty from !token else 3; truncate inbox.txt after ingest; move other files to processed/), `get_capture_log`.
3. lib.rs handler entries at END; database.rs add 014.
4. Frontend: Settings → Capture panel (folder input, scan now, recent log); hook scanning every 5 min in Layout; toast on ingest.
5. `docs/CAPTURE_SETUP.md` with the iPhone Shortcut recipe (incl. Siri phrase setup).

## Verification

cargo check + npm run build + parser unit tests pass; drop fixture inbox.txt with 3 lines incl. tokens → 3 quests with right category/difficulty/due date; file truncated; re-scan no duplicates; JSON file variant works; bad file → failed/.
