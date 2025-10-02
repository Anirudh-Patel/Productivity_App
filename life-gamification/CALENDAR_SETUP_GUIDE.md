# Calendar Integration Setup Guide

## Google Calendar Integration

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click "Select a project" → "New Project"
3. Name it something like "Life Gamification Calendar"
4. Click "Create"

### Step 2: Enable Google Calendar API
1. In your project dashboard, go to "APIs & Services" → "Library"
2. Search for "Google Calendar API"
3. Click on it and press "ENABLE"

### Step 3: Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" user type
3. Fill in the required fields:
   - App name: "Life Gamification"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `.../auth/calendar.readonly`
   - `.../auth/calendar.events.readonly`
5. Add your email as a test user

### Step 4: Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. Application type: "Web application"
4. Name: "Life Gamification Web"
5. Authorized JavaScript origins:
   - `http://localhost:1420`
   - `http://localhost`
6. Authorized redirect URIs:
   - `http://localhost:1420`
   - `http://localhost:1420/callback`
7. Click "CREATE"
8. Copy the Client ID

### Step 5: Create API Key
1. Click "+ CREATE CREDENTIALS" → "API key"
2. Copy the API key
3. Click "RESTRICT KEY"
4. Under "API restrictions", select "Restrict key"
5. Choose "Google Calendar API"
6. Save

### Step 6: Update .env File
Update `/life-gamification/.env` with your credentials:
```env
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your_api_key_here
```

### Step 7: Restart the App
1. Stop the app (Ctrl+C in terminal)
2. Run `npm run tauri:dev` again

### Step 8: Connect in App
1. Open the Calendar page in your app
2. Click the Settings icon (gear)
3. Click "Connect" under Google Calendar
4. Sign in with your Google account
5. Grant permissions

## Apple Calendar Integration (macOS only)

### For Apple Calendar:
1. Open the Calendar page in your app
2. Click the Settings icon
3. Click "Connect" under Apple Calendar
4. Grant calendar access when prompted by macOS

### Note:
Apple Calendar integration requires:
- macOS system
- Calendar app permissions
- The app will request access to your calendars when you first connect

## Troubleshooting

### Google Calendar Issues:
- **"Invalid Client" error**: Check that your Client ID is correct in .env
- **"Redirect URI mismatch"**: Add the exact URL shown in the error to your OAuth credentials
- **No events showing**: Make sure you have events in your primary calendar
- **Connection fails**: Check browser console for errors (F12)

### Apple Calendar Issues:
- **Permission denied**: Go to System Settings → Privacy & Security → Calendars → Enable for Life Gamification
- **No calendars found**: Make sure you have calendars in the Apple Calendar app
- **Events not syncing**: Click the "Sync" button to manually refresh

## Security Notes
- Never commit your .env file to git (it's already in .gitignore)
- Keep your API keys secure
- Use test users during development
- For production, implement proper OAuth flow with server-side token handling

## Using the Calendar

Once connected:
1. Your Google/Apple events will appear in the calendar
2. They'll have different colors (blue for Google, gray for Apple)
3. Click "Sync" to refresh events
4. Your gamified tasks appear alongside calendar events
5. Create new tasks directly from the calendar view

The calendar syncs:
- Google Calendar events (read-only)
- Apple Calendar events (read-only on macOS)
- Your Life Gamification tasks (full control)

All in one unified view!