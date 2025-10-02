import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { logger } from './logger';

declare global {
  interface Window {
    gapi: any;
    google: any;
    __TAURI__?: any;
  }
}

// Configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events';

// State management
let isGapiLoaded = false;
let isGapiInitialized = false;
let accessToken: string | null = null;
let refreshToken: string | null = null;
let tokenExpiresAt: number | null = null;

// OAuth Tokens interface for Tauri
interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
  scope: string;
}

// Initialize OAuth event listeners for Tauri
if (window.__TAURI__) {
  // Listen for OAuth success events from the backend
  listen<OAuthTokens>('oauth-success', (event) => {
    logger.info('OAuth success from Tauri', event.payload, 'GoogleCalendar');
    handleOAuthSuccess(event.payload);
  });

  // Listen for OAuth error events
  listen<string>('oauth-error', (event) => {
    logger.error('OAuth error from Tauri', event.payload, 'GoogleCalendar');
  });
}

function handleOAuthSuccess(tokens: OAuthTokens) {
  accessToken = tokens.access_token;
  refreshToken = tokens.refresh_token || null;

  if (tokens.expires_in) {
    tokenExpiresAt = Date.now() + (tokens.expires_in * 1000);
  }

  // Store tokens in localStorage for persistence
  localStorage.setItem('google_calendar_tokens', JSON.stringify({
    accessToken,
    refreshToken,
    tokenExpiresAt
  }));

  logger.info('Google Calendar authenticated successfully', {}, 'GoogleCalendar');
}

// Desktop OAuth flow using Tauri
async function authenticateDesktop(): Promise<void> {
  try {
    logger.info('Starting desktop OAuth flow', {}, 'GoogleCalendar');

    // Validate configuration
    if (!GOOGLE_CLIENT_ID) {
      throw new Error('Google Client ID not configured. Please set VITE_GOOGLE_CLIENT_ID in your .env file. See GOOGLE_OAUTH_SETUP.md for details.');
    }

    // Start OAuth flow through Tauri backend
    const state = await invoke<string>('start_google_oauth', {
      clientId: GOOGLE_CLIENT_ID,
      scopes: SCOPES.split(' ')
    });

    logger.info('OAuth flow started with state', { state }, 'GoogleCalendar');

    // Wait for authentication to complete (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OAuth authentication timed out'));
      }, 120000); // 2 minute timeout

      const unsubscribe = listen<OAuthTokens>('oauth-success', async (event) => {
        clearTimeout(timeout);
        (await unsubscribe)();
        resolve();
      });

      listen<string>('oauth-error', async (event) => {
        clearTimeout(timeout);
        (await unsubscribe)();
        reject(new Error(event.payload));
      });
    });
  } catch (error) {
    logger.error('Desktop OAuth failed', error, 'GoogleCalendar');
    throw error;
  }
}

// Web OAuth flow using Google API
export const loadGoogleAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.gapi && isGapiLoaded) {
      resolve();
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
    if (existingScript) {
      // Wait for it to load
      existingScript.addEventListener('load', () => {
        isGapiLoaded = true;
        resolve();
      });

      // Check if already loaded
      if (window.gapi) {
        isGapiLoaded = true;
        resolve();
      }
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      isGapiLoaded = true;
      logger.info('Google API script loaded', {}, 'GoogleCalendar');
      resolve();
    };

    script.onerror = (error) => {
      logger.error('Failed to load Google API script', error, 'GoogleCalendar');
      reject(new Error('Failed to load Google API script'));
    };

    document.head.appendChild(script);
  });
};

export const initializeGoogleAPI = async (): Promise<void> => {
  try {
    // Check for existing tokens
    const storedTokens = localStorage.getItem('google_calendar_tokens');
    if (storedTokens) {
      const tokens = JSON.parse(storedTokens);
      accessToken = tokens.accessToken;
      refreshToken = tokens.refreshToken;
      tokenExpiresAt = tokens.tokenExpiresAt;

      // Check if token is expired
      if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
        if (window.__TAURI__ && refreshToken) {
          // Refresh token through Tauri
          await refreshAccessToken();
        } else {
          // Clear expired tokens
          accessToken = null;
          refreshToken = null;
          tokenExpiresAt = null;
        }
      }

      if (accessToken) {
        logger.info('Restored Google Calendar authentication from storage', {}, 'GoogleCalendar');
        return;
      }
    }

    // Use desktop flow if in Tauri, otherwise use web flow
    if (window.__TAURI__) {
      logger.info('Using Tauri desktop OAuth flow', {}, 'GoogleCalendar');
      // Desktop authentication will be triggered when needed
      return;
    }

    // Load the script first for web mode
    await loadGoogleAPI();

    if (!window.gapi) {
      throw new Error('Google API not available');
    }

    // Check if already initialized
    if (isGapiInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
          });

          isGapiInitialized = true;
          logger.info('Google API initialized', {}, 'GoogleCalendar');
          resolve();
        } catch (error) {
          logger.error('Failed to initialize Google API client', error, 'GoogleCalendar');
          reject(error);
        }
      });
    });
  } catch (error) {
    logger.error('Failed to initialize Google API', error, 'GoogleCalendar');
    throw error;
  }
};

async function refreshAccessToken(): Promise<void> {
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const tokens = await invoke<OAuthTokens>('refresh_google_token', {
      refreshToken,
      clientId: GOOGLE_CLIENT_ID
    });

    handleOAuthSuccess(tokens);
  } catch (error) {
    logger.error('Failed to refresh token', error, 'GoogleCalendar');
    // Clear tokens and re-authenticate
    clearTokens();
    throw error;
  }
}

function clearTokens() {
  accessToken = null;
  refreshToken = null;
  tokenExpiresAt = null;
  localStorage.removeItem('google_calendar_tokens');
}

export const signInToGoogle = async (): Promise<any> => {
  try {
    // Use desktop flow if in Tauri
    if (window.__TAURI__) {
      await authenticateDesktop();
      return {
        access_token: accessToken,
        token_type: 'Bearer'
      };
    }

    // Web flow
    await initializeGoogleAPI();

    // Wait for Google Identity Services to load
    if (!window.google?.accounts?.oauth2) {
      throw new Error('Google Identity Services not loaded');
    }

    return new Promise((resolve, reject) => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error) {
            logger.error('Google OAuth error', response, 'GoogleCalendar');
            reject(response);
            return;
          }

          accessToken = response.access_token;

          // Set the token for API requests
          window.gapi.client.setToken({ access_token: accessToken });

          logger.info('Successfully signed in to Google', {}, 'GoogleCalendar');
          resolve({
            access_token: accessToken,
            expires_in: response.expires_in,
            token_type: response.token_type
          });
        },
      });

      client.requestAccessToken({
        prompt: 'consent',
      });
    });
  } catch (error) {
    logger.error('Failed to sign in to Google', error, 'GoogleCalendar');
    throw error;
  }
};

export const signOutFromGoogle = async (): Promise<void> => {
  try {
    if (window.__TAURI__) {
      // Desktop sign out
      clearTokens();
      logger.info('Signed out from Google (desktop)', {}, 'GoogleCalendar');
      return;
    }

    // Web sign out
    if (accessToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessToken, () => {
        logger.info('Google access token revoked', {}, 'GoogleCalendar');
      });
    }

    accessToken = null;

    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }

    logger.info('Signed out from Google', {}, 'GoogleCalendar');
  } catch (error) {
    logger.error('Failed to sign out from Google', error, 'GoogleCalendar');
    throw error;
  }
};

export const getGoogleCalendarClient = async () => {
  // For desktop, ensure we're authenticated
  if (window.__TAURI__) {
    if (!accessToken) {
      await signInToGoogle();
    }

    // Check if token needs refresh
    if (tokenExpiresAt && Date.now() >= tokenExpiresAt) {
      await refreshAccessToken();
    }

    // Return a proxy object for desktop that uses Tauri commands
    return {
      events: {
        list: async (params: any) => {
          const eventsJson = await invoke<string>('get_google_calendar_events', {
            accessToken
          });
          return { result: JSON.parse(eventsJson) };
        }
      }
    };
  }

  // Web mode
  await initializeGoogleAPI();

  if (!window.gapi.client.calendar) {
    throw new Error('Google Calendar client not available');
  }

  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  return window.gapi.client.calendar;
};

export const isGoogleSignedIn = (): boolean => {
  return accessToken !== null;
};

// For backward compatibility
export const initializeGoogleCalendar = initializeGoogleAPI;