# Integrations Setup Guide

One-time setup steps for each connection. All integrations are local-first: no API keys stored in the app, no third-party servers.

## GitHub Issues → Quests

**Requires:** `gh` CLI installed and authenticated (already true on this machine).

1. Settings → GitHub → confirm CLI status shows connected.
2. Add repos to the watchlist as `owner/repo` (e.g. `Anirudh-Patel/Productivity_App`).
3. Open issues import as work quests on sync (app start + every 30 min + Sync Now).
4. Close an issue on GitHub → quest auto-completes. Complete a quest in-app → issue closes (toggle in settings, default on).

Note: pushes/closes use the *active* gh account — switch with `gh auth switch -u Anirudh-Patel` if needed.

## Calendar (macOS Calendar.app, two-way)

**Requires:** your Google account added to Calendar.app once (System Settings → Internet Accounts → Google → enable Calendars). All Google/iCloud calendars then work with zero OAuth.

1. Settings → Calendar → "Connect Calendar.app" → **approve the macOS Automation permission prompt** (one time; later manageable in System Settings → Privacy & Security → Automation).
2. Calendar page shows real events; enable per-calendar auto-import toggles to turn upcoming events into quests.
3. Create a quest with a due date + "Put on calendar" → 1h event appears in the "Quests" calendar. Completing it prefixes the event with ✅.

## Apple Watch Workout Verification

**Requires:** "Health Auto Export – JSON+CSV" iOS app (~$5) on your iPhone.

1. In Health Auto Export: create an automation → data type Workouts → format JSON → destination iCloud Drive folder (e.g. `HealthExport`) → schedule hourly/daily.
2. Settings → Health → set folder to `~/Library/Mobile Documents/com~apple~CloudDocs/HealthExport` → Save → Scan Now.
3. Create fitness/health quests with "Verify with Workout" (type + min minutes). Finish a matching Watch workout → quest auto-completes with +50% bonus XP within a scan cycle (15 min).

## Apple Reminders (Siri capture, two-way completion)

1. Settings → Reminders → "Connect Reminders.app" → **approve the macOS Automation prompt**.
2. Toggle on the lists you want imported.
3. Say "Hey Siri, remind me to ___" anywhere → appears as a quest on next sync (≤15 min). Complete the quest → reminder checks off; check the reminder → quest completes.

## Quick-Capture Inbox (iPhone Shortcut → quests)

See `docs/CAPTURE_SETUP.md` for the 2-action Shortcut recipe. Summary:

1. Create iCloud Drive folder `QuestInbox`; Settings → Capture → point at `~/Library/Mobile Documents/com~apple~CloudDocs/QuestInbox`.
2. iPhone Shortcut: Ask for Input → Append to `QuestInbox/inbox.txt`. Optionally add a Siri phrase ("add a quest").
3. Lines support tokens: `#category !difficulty(1-10) @YYYY-MM-DD`, e.g. `Ship report #work !6 @2026-07-15`.

## Finance (bank + Robinhood CSV)

1. Export statements as CSV from your bank / Robinhood (account activity export).
2. Finance page → Import → pick account → choose file. Chase/BofA/Amex/Robinhood layouts auto-detected; re-imports are deduplicated.
3. Recategorize any transaction inline; tick "always" to create a permanent rule.

**Live bank sync (optional, later):** sign up for SimpleFIN Bridge (~$1.50/mo) and ask Claude to wire it in — the schema is ready (`transactions.source`).

## Notifications

First launch prompts for notification permission. Settings → Notifications for quiet hours (default 22:00–07:00), lead times, sound. Reminders fire as macOS notifications while the app is running.
