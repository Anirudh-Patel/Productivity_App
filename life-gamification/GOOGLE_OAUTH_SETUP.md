# Google Calendar OAuth Setup Guide

## Error 400: invalid_request Fix

The "Error 400: invalid_request" occurs because the Google OAuth configuration needs to be properly set up. Follow these steps:

## 1. Create Google Cloud Project (if not done already)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Name it something like "Life Gamification App"

## 2. Enable Google Calendar API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for "Google Calendar API"
3. Click on it and press **Enable**

## 3. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth 2.0 Client IDs**
3. If prompted, configure the OAuth consent screen first:
   - Choose **External** user type
   - Fill in app name: "Life Gamification App"
   - Add your email as developer contact
   - Add scopes: `../auth/calendar`, `../auth/calendar.events`
   - Add test users (your email)

4. For OAuth 2.0 Client ID:
   - Application type: **Desktop application**
   - Name: "Life Gamification Desktop"
   - Download the JSON file

## 4. Configure Redirect URIs

In your OAuth client configuration, add these redirect URIs:
```
http://localhost:9898/oauth/callback
```

## 5. Update Environment Variables

Create a `.env` file in the project root with:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-client-secret-here
```

Replace `your-client-id-here` with the actual client ID from your downloaded JSON file.

## 6. Update OAuth Scopes

The app needs write access to create calendar events. The scopes should include:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

## Current Configuration Issues

The app currently has:
- ✅ Client ID in .env file
- ❌ Client ID likely configured for web (needs desktop configuration)
- ✅ Updated to write scopes (calendar + calendar.events)
- ❌ Missing redirect URI configuration

## IMMEDIATE FIX NEEDED

Your current client ID `592240104717-qiuaj3hv33r3gdh96lq6ed456nji2v6b.apps.googleusercontent.com` appears to be configured for web applications.

### Quick Solution:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **Credentials**
3. Find your OAuth 2.0 Client ID
4. Edit it and:
   - Change application type to **Desktop application**
   - OR add redirect URI: `http://localhost:9898/oauth/callback`
   - Ensure Calendar API is enabled
   - Update scopes in OAuth consent screen

### Alternative: Create New Desktop OAuth Client
If the above doesn't work, create a new OAuth client:
1. Application type: **Desktop application**
2. Add redirect URI: `http://localhost:9898/oauth/callback`
3. Update your `.env` file with the new client ID

## Quick Fix

If you want to test immediately with a working configuration, I can update the code to use proper scopes and remove the hardcoded client ID.

## Test OAuth Flow

After setup:
1. Restart the app (`npm run tauri dev`)
2. Try connecting Google Calendar again
3. You should see a proper Google OAuth consent screen
4. Grant permissions for calendar access
5. The app should successfully connect

## Troubleshooting

- **Error 400**: Usually means client ID is invalid or redirect URI mismatch
- **Error 403**: API not enabled or quota exceeded
- **Error 401**: Invalid credentials or expired tokens

## Security Note

Never commit your `.env` file to version control. Add it to `.gitignore`.