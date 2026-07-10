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
  /** Name of the Calendar.app calendar this event belongs to (apple source). */
  calendar?: string;
}

export interface CalendarImportRule {
  calendar_name: string;
  enabled: boolean;
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

  // Apple Calendar.app metadata
  appleCalendars: string[];
  importRules: CalendarImportRule[];

  // Credentials (stored securely)
  credentials: CalendarCredentials;

  // Actions
  connectGoogleCalendar: () => Promise<void>;
  disconnectGoogleCalendar: () => Promise<void>;
  connectAppleCalendar: () => Promise<void>;
  disconnectAppleCalendar: () => Promise<void>;
  syncCalendars: () => Promise<void>;
  setCredentials: (creds: Partial<CalendarCredentials>) => void;
  fetchAppleCalendars: () => Promise<void>;
  fetchImportRules: () => Promise<void>;
  setImportRule: (calendarName: string, enabled: boolean) => Promise<void>;
  runAutoImport: () => Promise<number>;
  addTaskToCalendar: (taskId: number) => Promise<string>;
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
      appleCalendars: [],
      importRules: [],
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
          // Real Calendar.app connection via osascript/JXA in the Rust backend.
          // The first call triggers the one-time macOS Calendar permission prompt.
          const result = await invoke<{ connected: boolean; calendarId?: string; calendars?: string[] }>(
            'connect_apple_calendar'
          );

          if (result.connected) {
            set({
              appleCalendarConnected: true,
              appleCalendars: result.calendars ?? [],
              credentials: {
                ...get().credentials,
                appleCalendarId: result.calendarId
              }
            });

            logger.info('Connected to Apple Calendar', { calendars: result.calendars?.length }, 'CalendarStore');
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
          
          // Sync Apple Calendar (real Calendar.app events, bounded to ±30 days)
          if (state.appleCalendarConnected) {
            try {
              const appleEvents = await invoke<CalendarEvent[]>('get_apple_calendar_events', {
                calendarId: state.credentials.appleCalendarId
              });

              appleEvents.forEach(event => {
                events.push({
                  ...event,
                  id: `apple-${event.id}`,
                  sourceId: event.id,
                  source: 'apple'
                });
              });

              // Auto-import: create tasks for upcoming events from calendars with
              // an enabled import rule (dedup handled by the backend on event uid).
              if (get().importRules.some(rule => rule.enabled)) {
                try {
                  const imported = await invoke<number>('import_calendar_events_as_tasks');
                  if (imported > 0) {
                    logger.info('Auto-imported calendar events as tasks', { imported }, 'CalendarStore');
                    const { useGameStore } = await import('./gameStore');
                    await useGameStore.getState().fetchTasks();
                  }
                } catch (importError) {
                  logger.error('Calendar auto-import failed', importError, 'CalendarStore');
                }
              }
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
      },

      fetchAppleCalendars: async () => {
        try {
          const calendars = await invoke<string[]>('get_apple_calendar_list');
          set({ appleCalendars: calendars, appleCalendarConnected: true });
        } catch (error) {
          logger.error('Failed to fetch Apple calendar list', error, 'CalendarStore');
          throw error;
        }
      },

      fetchImportRules: async () => {
        try {
          const rules = await invoke<CalendarImportRule[]>('get_calendar_import_rules');
          set({ importRules: rules });
        } catch (error) {
          logger.error('Failed to fetch calendar import rules', error, 'CalendarStore');
          throw error;
        }
      },

      setImportRule: async (calendarName: string, enabled: boolean) => {
        try {
          await invoke('set_calendar_import_rule', { calendarName, enabled });
          const existing = get().importRules;
          const next = existing.some(r => r.calendar_name === calendarName)
            ? existing.map(r => (r.calendar_name === calendarName ? { ...r, enabled } : r))
            : [...existing, { calendar_name: calendarName, enabled }];
          set({ importRules: next });
        } catch (error) {
          logger.error('Failed to update calendar import rule', error, 'CalendarStore');
          throw error;
        }
      },

      runAutoImport: async () => {
        try {
          const imported = await invoke<number>('import_calendar_events_as_tasks');
          if (imported > 0) {
            const { useGameStore } = await import('./gameStore');
            await useGameStore.getState().fetchTasks();
          }
          logger.info('Calendar import complete', { imported }, 'CalendarStore');
          return imported;
        } catch (error) {
          logger.error('Calendar import failed', error, 'CalendarStore');
          throw error;
        }
      },

      addTaskToCalendar: async (taskId: number) => {
        try {
          // Creates a 1h event in the "Quests" calendar and links it to the task.
          const uid = await invoke<string>('add_task_to_calendar', { taskId });
          logger.info('Task pushed to Calendar.app', { taskId, uid }, 'CalendarStore');
          return uid;
        } catch (error) {
          logger.error('Failed to add task to calendar', error, 'CalendarStore');
          throw error;
        }
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