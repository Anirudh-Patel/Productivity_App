# Quick Capture Setup — iPhone/Siri → Quests

Add quests from your iPhone (or anything that can write a file to iCloud Drive)
without opening the app. The desktop app watches an iCloud Drive folder and
turns dropped text into quests — no server, no API keys.

## How it works

```
iPhone Shortcut / Siri ──▶ iCloud Drive/QuestInbox/inbox.txt
                                        │  (iCloud syncs to your Mac)
Desktop app scans folder on start + every 5 min (or "Scan Now")
                                        │
                       each non-empty line becomes a quest
                       inbox.txt is emptied after ingest
```

## 1. Create the inbox folder

1. On your Mac or iPhone, open **Files → iCloud Drive** and create a folder
   named **QuestInbox**.
2. In the desktop app, go to **Settings → Quick Capture** and set the watched
   folder to:

   ```
   ~/Library/Mobile Documents/com~apple~CloudDocs/QuestInbox
   ```

   (That is where iCloud Drive folders live on macOS. `~` is expanded
   automatically.)

## 2. Build the iPhone Shortcut (2 actions)

In the **Shortcuts** app on your iPhone, create a new shortcut:

1. **Ask for Input**
   - Prompt: `New quest?`
   - Input type: Text
2. **Append to Text File** (search "Append" in the actions list)
   - File Path: `QuestInbox/inbox.txt`
   - Service: **iCloud Drive**
   - Text: `Provided Input` (the variable from step 1)
   - Turn ON "Make New Line" (or append `\n` yourself) so each capture lands
     on its own line.

Name the shortcut something Siri-friendly, e.g. **"Add to my quests"**.

> If `inbox.txt` doesn't exist yet, the Append action creates it on first run.

### Siri phrase

Shortcuts are automatically Siri-enabled under their name. Say:

> "Hey Siri, add to my quests"

Siri asks "New quest?", you dictate the line, and it lands in `inbox.txt`.
Within ~5 minutes (or on next app start / "Scan Now") it appears as a quest.

You can rename the shortcut to change the phrase. To confirm it's wired up:
iPhone **Settings → Siri & Search → Shortcuts** should list it.

## 3. Token syntax (optional, per line)

Each non-empty line becomes one quest. Tokens can appear anywhere in the line
and are stripped from the title:

| Token          | Meaning                     | Default     | Example        |
| -------------- | --------------------------- | ----------- | -------------- |
| `#word`        | Category (lowercased)       | `general`   | `#fitness`     |
| `!N`           | Difficulty 1–10             | `3`         | `!7`           |
| `@YYYY-MM-DD`  | Due date                    | none        | `@2026-07-15`  |

Examples:

```
Buy groceries
Finish quarterly report #work !6 @2026-07-15
Morning run #fitness !2
```

Malformed tokens (e.g. `!99`, `@tomorrow`) are left in the title untouched.
Markdown list prefixes (`- `, `* `, `- [ ] `) are stripped, so `.md`
checklists work too.

## File formats supported

- **`inbox.txt`** (special-cased): lines are ingested, then the file is
  emptied in place — safe for Shortcuts to keep appending to.
- **Any other `.txt` / `.md` file**: one quest per non-empty line; the file is
  moved to `processed/` afterwards (audit trail, never re-ingested).
- **`.json` file**:

  ```json
  {
    "tasks": [
      { "title": "Plan the trip", "category": "personal", "difficulty": 4, "due_date": "2026-08-01" },
      { "title": "Water the plants" }
    ]
  }
  ```

  Only `title` is required. Processed JSON files also move to `processed/`.
- **Anything else / malformed JSON**: moved to `failed/` with a
  `<name>.reason.txt` explaining why.

## Troubleshooting

- **Nothing appears on the Mac** — iCloud sync can lag. Open the Files app on
  iPhone and confirm `inbox.txt` has your line; on the Mac, check that the
  file exists in Finder (it may show a download icon — click it to force sync).
- **"Folder not found" when saving settings** — the path must already exist on
  the Mac. Create `QuestInbox` in iCloud Drive first.
- **Duplicate-looking quests** — each scan empties `inbox.txt` and moves other
  files to `processed/`, so re-scans never re-ingest. Duplicates mean the same
  line was captured twice on the phone.
- **Check what was ingested** — Settings → Quick Capture shows a log of the
  recent captures, including failures and their reasons.
