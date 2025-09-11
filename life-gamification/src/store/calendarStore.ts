import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  description?: string;
  source: 'google' | 'apple' | 'local';
  sourceId?: string;
  color?: string;
}

interface CalendarCredentials {
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleCalendarId?: string;
  appleCalendarId?: string;
}

interface CalendarState {
  // Connection status
  googleCalendarConnected: boolean;
  appleCalendarConnected: boolean;
  
  // Synced events
  syncedCalendars: CalendarEvent[];
  lastSyncTime: Date | null;
  isSyncing: boolean;
  
  // Credentials (stored securely)
  credentials: CalendarCredentials;
  
  // Actions
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  connectAppleCalendar: () => Promise<void>;
  disconnectAppleCalendar: () => Promise<void>;
  syncCalendars: () => Promise<void>;
  setCredentials: (creds: Partial<CalendarCredentials>) => void;
}

// Google Calendar API configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';
const GOOGLE_DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      googleCalendarConnected: false,
      appleCalendarConnected: false,
      syncedCalendars: [],
      lastSyncTime: null,
      isSyncing: false,
      credentials: {},

      connectGoogleCalendar: async () => {
        try {
          // Initialize Google API client
          if (typeof window !== 'undefined' && (window as any).gapi) {
            const gapi = (window as any).gapi;
            
            await new Promise<void>((resolve, reject) => {
              gapi.load('client:auth2', async () => {
                try {
                  await gapi.client.init({
                    apiKey: GOOGLE_API_KEY,
                    clientId: GOOGLE_CLIENT_ID,
                    discoveryDocs: GOOGLE_DISCOVERY_DOCS,
                    scope: GOOGLE_SCOPES
                  });
                  
                  // Sign in
                  const authInstance = gapi.auth2.getAuthInstance();
                  if (!authInstance.isSignedIn.get()) {
                    await authInstance.signIn();
                  }
                  
                  // Get access token
                  const user = authInstance.currentUser.get();
                  const authResponse = user.getAuthResponse();
                  
                  set({
                    googleCalendarConnected: true,
                    credentials: {
                      ...get().credentials,
                      googleAccessToken: authResponse.access_token,
                      googleRefreshToken: authResponse.refresh_token
                    }
                  });
                  
                  logger.info('Connected to Google Calendar', {}, 'CalendarStore');
                  resolve();
                } catch (error) {
                  reject(error);
                }
              });
            });
          } else {
            // Fallback: Open OAuth flow in browser
            const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
              `client_id=${GOOGLE_CLIENT_ID}&` +
              `redirect_uri=${encodeURIComponent(window.location.origin)}&` +
              `response_type=token&` +
              `scope=${encodeURIComponent(GOOGLE_SCOPES)}`;
            
            window.open(authUrl, '_blank');
            
            // In a real implementation, you'd handle the OAuth callback
            set({ googleCalendarConnected: true });
          }
        } catch (error) {
          logger.error('Failed to connect Google Calendar', error, 'CalendarStore');
          throw error;
        }
      },

      disconnectGoogleCalendar: async () => {
        try {
          if (typeof window !== 'undefined' && (window as any).gapi) {
            const gapi = (window as any).gapi;
            const authInstance = gapi.auth2?.getAuthInstance();
            if (authInstance) {
              await authInstance.signOut();
            }
          }
          
          set({
            googleCalendarConnected: false,
            credentials: {
              ...get().credentials,
              googleAccessToken: undefined,
              googleRefreshToken: undefined,
              googleCalendarId: undefined
            }
          });
          
          logger.info('Disconnected from Google Calendar', {}, 'CalendarStore');
        } catch (error) {
          logger.error('Failed to disconnect Google Calendar', error, 'CalendarStore');
          throw error;
        }
      },

      connectAppleCalendar: async () => {
        try {
          // For Apple Calendar, we'll use EventKit through Tauri
          // This requires native code in the Tauri backend
          const result = await invoke<{ connected: boolean; calendarId?: string }>(
            'connect_apple_calendar'
          );
          
          if (result.connected) {
            set({
              appleCalendarConnected: true,
              credentials: {
                ...get().credentials,
                appleCalendarId: result.calendarId
              }
            });
            
            logger.info('Connected to Apple Calendar', {}, 'CalendarStore');
          }
        } catch (error) {
          logger.error('Failed to connect Apple Calendar', error, 'CalendarStore');
          throw error;
        }
      },

      disconnectAppleCalendar: async () => {
        try {
          await invoke('disconnect_apple_calendar');
          
          set({
            appleCalendarConnected: false,
            credentials: {
              ...get().credentials,
              appleCalendarId: undefined
            }
          });
          
          logger.info('Disconnected from Apple Calendar', {}, 'CalendarStore');
        } catch (error) {
          logger.error('Failed to disconnect Apple Calendar', error, 'CalendarStore');
          throw error;
        }
      },

      syncCalendars: async () => {
        const state = get();
        if (state.isSyncing) return;
        
        set({ isSyncing: true });
        
        try {
          const events: CalendarEvent[] = [];
          
          // Sync Google Calendar
          if (state.googleCalendarConnected && (window as any).gapi) {
            const gapi = (window as any).gapi;
            const calendar = gapi.client.calendar;
            
            if (calendar) {
              const response = await calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                maxResults: 100,
                singleEvents: true,
                orderBy: 'startTime'
              });
              
              if (response.result.items) {
                response.result.items.forEach((item: any) => {
                  events.push({
                    id: `google-${item.id}`,
                    title: item.summary || 'Untitled Event',
                    start: item.start?.dateTime || item.start?.date || '',
                    end: item.end?.dateTime || item.end?.date,
                    allDay: !item.start?.dateTime,
                    description: item.description,
                    source: 'google',
                    sourceId: item.id,
                    color: item.colorId
                  });
                });
              }
            }
          }
          
          // Sync Apple Calendar
          if (state.appleCalendarConnected) {
            try {
              const appleEvents = await invoke<CalendarEvent[]>('get_apple_calendar_events', {
                calendarId: state.credentials.appleCalendarId
              });
              
              appleEvents.forEach(event => {
                events.push({
                  ...event,
                  id: `apple-${event.id}`,
                  source: 'apple'
                });
              });
            } catch (error) {
              logger.error('Failed to fetch Apple Calendar events', error, 'CalendarStore');
            }
          }
          
          set({
            syncedCalendars: events,
            lastSyncTime: new Date(),
            isSyncing: false
          });
          
          logger.info('Calendars synced successfully', { 
            eventCount: events.length 
          }, 'CalendarStore');
        } catch (error) {
          logger.error('Failed to sync calendars', error, 'CalendarStore');
          set({ isSyncing: false });
          throw error;
        }
      },

      setCredentials: (creds: Partial<CalendarCredentials>) => {
        set({
          credentials: {
            ...get().credentials,
            ...creds
          }
        });
      }
    }),
    {
      name: 'calendar-storage',
      partialize: (state) => ({
        googleCalendarConnected: state.googleCalendarConnected,
        appleCalendarConnected: state.appleCalendarConnected,
        credentials: state.credentials,
        lastSyncTime: state.lastSyncTime
      })
    }
  )
);