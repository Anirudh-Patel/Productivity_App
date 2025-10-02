import { invoke } from '@tauri-apps/api/core';
import { getGoogleCalendarClient, isGoogleSignedIn } from '../utils/googleCalendar';
import { logger } from '../utils/logger';
import { eventAnalysisService, analyzeCalendarEvent, EventAnalysis } from './eventAnalysisService';
import { usePreferencesStore } from '../store/preferencesStore';

// Types for calendar synchronization
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO string
  end?: string;   // ISO string
  allDay?: boolean;
  source: 'google' | 'local' | 'apple';
  googleEventId?: string;
  questId?: number;
  category?: string;
  location?: string;
  attendees?: string[];
}

export interface Quest {
  id: number;
  title: string;
  description?: string;
  due_date?: string;
  category: string;
  difficulty: number;
  priority: number;
  status: string;
  created_at: string;
  task_type: string;
}

export interface SyncResult {
  googleEventsSync: number;
  questsCreated: number;
  questsUpdated: number;
  googleEventsCreated: number;
  questsFromEvents: number; // New: quests created from Google Calendar events
  errors: string[];
}

class CalendarSyncService {
  private lastSyncTime: Date | null = null;
  private syncInProgress = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Auto-sync every 5 minutes if authenticated
    this.startAutoSync();
  }

  // Start automatic synchronization
  startAutoSync(intervalMinutes = 5) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(async () => {
      if (isGoogleSignedIn() && !this.syncInProgress) {
        try {
          await this.performFullSync();
        } catch (error) {
          logger.error('Auto-sync failed', error, 'CalendarSync');
        }
      }
    }, intervalMinutes * 60 * 1000);

    logger.info(`Auto-sync started (${intervalMinutes} min intervals)`, {}, 'CalendarSync');
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Perform complete bidirectional sync
  async performFullSync(): Promise<SyncResult> {
    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    if (!isGoogleSignedIn()) {
      throw new Error('Google Calendar not authenticated');
    }

    this.syncInProgress = true;
    const result: SyncResult = {
      googleEventsSync: 0,
      questsCreated: 0,
      questsUpdated: 0,
      googleEventsCreated: 0,
      questsFromEvents: 0,
      errors: []
    };

    try {
      logger.info('Starting full calendar sync', {}, 'CalendarSync');

      // 1. Sync Google Calendar events to local calendar
      const googleSyncResult = await this.syncGoogleEventsToLocal();
      result.googleEventsSync = googleSyncResult.eventsSynced;
      result.errors.push(...googleSyncResult.errors);

      // 2. Convert unsynced quests to Google Calendar events
      const questSyncResult = await this.syncQuestsToGoogle();
      result.googleEventsCreated = questSyncResult.eventsCreated;
      result.errors.push(...questSyncResult.errors);

      // 3. Convert Google Calendar events to quests (NEW FEATURE)
      const eventToQuestResult = await this.convertGoogleEventsToQuests();
      result.questsFromEvents = eventToQuestResult.questsCreated;
      result.errors.push(...eventToQuestResult.errors);

      this.lastSyncTime = new Date();
      logger.info('Full sync completed', result, 'CalendarSync');

      return result;
    } catch (error) {
      logger.error('Full sync failed', error, 'CalendarSync');
      result.errors.push(`Sync failed: ${error}`);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Sync Google Calendar events to local calendar
  async syncGoogleEventsToLocal(): Promise<{ eventsSynced: number; errors: string[] }> {
    const result = { eventsSynced: 0, errors: [] };

    try {
      // Get Google Calendar events from the last week to next month
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 7); // 1 week ago

      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30); // 1 month ahead

      const calendarClient = await getGoogleCalendarClient();
      const response = await calendarClient.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 100,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const googleEvents = response.result.items || [];
      logger.info(`Fetched ${googleEvents.length} Google Calendar events`, {}, 'CalendarSync');

      // Store/update events in local calendar
      for (const googleEvent of googleEvents) {
        try {
          const calendarEvent = this.convertGoogleEventToCalendarEvent(googleEvent);
          await this.storeCalendarEvent(calendarEvent);
          result.eventsSynced++;
        } catch (error) {
          result.errors.push(`Failed to sync event ${googleEvent.id}: ${error}`);
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to sync Google events to local', error, 'CalendarSync');
      result.errors.push(`Google events sync failed: ${error}`);
      return result;
    }
  }

  // Sync quests to Google Calendar
  async syncQuestsToGoogle(): Promise<{ eventsCreated: number; errors: string[] }> {
    const result = { eventsCreated: 0, errors: [] };

    try {
      // Get quests that haven't been synced to Google yet
      const unsyncedQuests = await this.getUnsyncedQuests();
      logger.info(`Found ${unsyncedQuests.length} quests to sync to Google`, {}, 'CalendarSync');

      const calendarClient = await getGoogleCalendarClient();

      for (const quest of unsyncedQuests) {
        try {
          // Skip quests without due dates
          if (!quest.due_date) {
            continue;
          }

          const googleEvent = this.convertQuestToGoogleEvent(quest);

          // Create event in Google Calendar
          const response = await calendarClient.events.insert({
            calendarId: 'primary',
            resource: googleEvent
          });

          if (response.result.id) {
            // Update quest with Google Calendar event ID
            await this.updateQuestWithGoogleEventId(quest.id, response.result.id);
            result.eventsCreated++;
            logger.info(`Created Google Calendar event for quest ${quest.id}`, { eventId: response.result.id }, 'CalendarSync');
          }
        } catch (error) {
          result.errors.push(`Failed to create Google event for quest ${quest.id}: ${error}`);
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to sync quests to Google', error, 'CalendarSync');
      result.errors.push(`Quest sync failed: ${error}`);
      return result;
    }
  }

  // Convert Google Calendar events to quests (NEW FEATURE)
  async convertGoogleEventsToQuests(): Promise<{ questsCreated: number; errors: string[] }> {
    const result = { questsCreated: 0, errors: [] };

    try {
      // Get user preferences for event conversion
      const preferences = usePreferencesStore.getState().calendar.googleSync;

      // Check if auto-conversion is enabled
      if (!preferences.autoCreateQuestsFromEvents) {
        logger.info('Google event to quest conversion is disabled in preferences', {}, 'CalendarSync');
        return result;
      }

      // Get recent Google Calendar events (last 2 weeks to next month)
      const timeMin = new Date();
      timeMin.setDate(timeMin.getDate() - 14); // 2 weeks ago

      const timeMax = new Date();
      timeMax.setDate(timeMax.getDate() + 30); // 1 month ahead

      const calendarClient = await getGoogleCalendarClient();
      const response = await calendarClient.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const googleEvents = response.result.items || [];
      logger.info(`Analyzing ${googleEvents.length} Google Calendar events for quest conversion`, {}, 'CalendarSync');

      // Get existing quests to avoid duplicates
      const existingQuests = await this.getAllExistingQuests();

      for (const googleEvent of googleEvents) {
        try {
          // Skip if this event was generated by our app
          if (eventAnalysisService.isQuestGeneratedEvent({
            title: googleEvent.summary || '',
            description: googleEvent.description,
            start: googleEvent.start?.dateTime || googleEvent.start?.date || '',
            end: googleEvent.end?.dateTime || googleEvent.end?.date,
            allDay: !googleEvent.start?.dateTime,
            location: googleEvent.location,
            attendees: googleEvent.attendees?.map(a => a.email)
          })) {
            continue;
          }

          // Skip recurring events if disabled in preferences
          if (googleEvent.recurringEventId && !preferences.createRecurringQuests) {
            logger.info(`Skipping recurring event '${googleEvent.summary}' - recurring quest creation disabled`, {}, 'CalendarSync');
            continue;
          }

          // Check for excluded keywords
          const eventText = `${googleEvent.summary || ''} ${googleEvent.description || ''}`.toLowerCase();
          const hasExcludedKeyword = preferences.excludedKeywords.some(keyword =>
            eventText.includes(keyword.toLowerCase())
          );

          if (hasExcludedKeyword) {
            logger.info(`Skipping event '${googleEvent.summary}' - contains excluded keyword`, {}, 'CalendarSync');
            continue;
          }

          // Check if we already created a quest for this event
          const eventId = googleEvent.id;
          const existingQuest = existingQuests.find(quest =>
            quest.description?.includes(`calendar_event_id:${eventId}`)
          );

          if (existingQuest) {
            continue; // Skip if quest already exists
          }

          // Analyze the event to determine quest properties
          const analysis = analyzeCalendarEvent({
            title: googleEvent.summary || 'Untitled Event',
            description: googleEvent.description,
            start: googleEvent.start?.dateTime || googleEvent.start?.date || '',
            end: googleEvent.end?.dateTime || googleEvent.end?.date,
            allDay: !googleEvent.start?.dateTime,
            location: googleEvent.location,
            attendees: googleEvent.attendees?.map(a => a.email) || []
          });

          // Check confidence threshold from preferences
          if (analysis.confidence < preferences.minimumConfidenceThreshold) {
            logger.info(`Skipping event '${googleEvent.summary}' - confidence ${analysis.confidence}% below threshold ${preferences.minimumConfidenceThreshold}%`, {}, 'CalendarSync');
            continue;
          }

          // Check if category is enabled in preferences
          if (!preferences.enabledCategories.includes(analysis.category)) {
            logger.info(`Skipping event '${googleEvent.summary}' - category '${analysis.category}' not enabled`, {}, 'CalendarSync');
            continue;
          }

          // Create quest from the analyzed event
          const questData = {
            title: analysis.suggestedTitle,
            description: `${analysis.suggestedDescription}\n\ncalendar_event_id:${eventId}`,
            category: analysis.category,
            difficulty: analysis.difficulty,
            priority: analysis.priority,
            task_type: analysis.taskType,
            due_date: googleEvent.start?.dateTime || googleEvent.start?.date,
          };

          await this.createQuestFromEventAnalysis(questData);
          result.questsCreated++;

          logger.info(`Created quest from Google Calendar event`, {
            eventTitle: googleEvent.summary,
            questTitle: analysis.suggestedTitle,
            category: analysis.category,
            difficulty: analysis.difficulty,
            confidence: analysis.confidence
          }, 'CalendarSync');

        } catch (error) {
          result.errors.push(`Failed to convert event '${googleEvent.summary}': ${error}`);
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to convert Google events to quests', error, 'CalendarSync');
      result.errors.push(`Event-to-quest conversion failed: ${error}`);
      return result;
    }
  }

  // Create Google Calendar event when a quest is created
  async createGoogleEventForQuest(quest: Quest): Promise<string | null> {
    if (!isGoogleSignedIn() || !quest.due_date) {
      return null;
    }

    try {
      const googleEvent = this.convertQuestToGoogleEvent(quest);
      const eventData = JSON.stringify(googleEvent);

      // Get access token from localStorage
      const tokens = localStorage.getItem('google_calendar_tokens');
      if (!tokens) {
        throw new Error('No access token available');
      }

      const { accessToken } = JSON.parse(tokens);

      // Create event through Tauri command
      const responseJson = await invoke<string>('create_google_calendar_event', {
        accessToken,
        eventData
      });

      const response = JSON.parse(responseJson);

      if (response.id) {
        // Update quest with Google Calendar event ID
        await this.updateQuestWithGoogleEventId(quest.id, response.id);
        logger.info(`Created Google Calendar event for new quest`, { questId: quest.id, eventId: response.id }, 'CalendarSync');
        return response.id;
      }

      return null;
    } catch (error) {
      logger.error('Failed to create Google event for quest', error, 'CalendarSync');
      return null;
    }
  }

  // Update Google Calendar event when quest is modified
  async updateGoogleEventForQuest(quest: Quest, googleEventId: string): Promise<boolean> {
    if (!isGoogleSignedIn()) {
      return false;
    }

    try {
      const calendarClient = await getGoogleCalendarClient();
      const googleEvent = this.convertQuestToGoogleEvent(quest);

      await calendarClient.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        resource: googleEvent
      });

      logger.info(`Updated Google Calendar event for quest`, { questId: quest.id, eventId: googleEventId }, 'CalendarSync');
      return true;
    } catch (error) {
      logger.error('Failed to update Google event for quest', error, 'CalendarSync');
      return false;
    }
  }

  // Delete Google Calendar event when quest is deleted
  async deleteGoogleEventForQuest(googleEventId: string): Promise<boolean> {
    if (!isGoogleSignedIn()) {
      return false;
    }

    try {
      const calendarClient = await getGoogleCalendarClient();

      await calendarClient.events.delete({
        calendarId: 'primary',
        eventId: googleEventId
      });

      logger.info(`Deleted Google Calendar event`, { eventId: googleEventId }, 'CalendarSync');
      return true;
    } catch (error) {
      logger.error('Failed to delete Google event', error, 'CalendarSync');
      return false;
    }
  }

  // Get all calendar events for display
  async getAllCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    const events: CalendarEvent[] = [];

    try {
      // Get local events
      const localEvents = await this.getLocalCalendarEvents(startDate, endDate);
      events.push(...localEvents);

      // Get Google events if authenticated
      if (isGoogleSignedIn()) {
        const googleEvents = await this.getGoogleCalendarEventsForDisplay(startDate, endDate);
        events.push(...googleEvents);
      }

      // Sort by start time
      events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      return events;
    } catch (error) {
      logger.error('Failed to get calendar events', error, 'CalendarSync');
      throw error;
    }
  }

  // Helper methods
  private convertGoogleEventToCalendarEvent(googleEvent: any): CalendarEvent {
    const startTime = googleEvent.start?.dateTime || googleEvent.start?.date;
    const endTime = googleEvent.end?.dateTime || googleEvent.end?.date;

    return {
      id: `google-${googleEvent.id}`,
      title: googleEvent.summary || 'Untitled Event',
      description: googleEvent.description,
      start: startTime,
      end: endTime,
      allDay: !googleEvent.start?.dateTime, // All-day if no dateTime
      source: 'google',
      googleEventId: googleEvent.id,
      location: googleEvent.location,
      attendees: googleEvent.attendees?.map((a: any) => a.email) || []
    };
  }

  private convertQuestToGoogleEvent(quest: Quest): any {
    const startTime = new Date(quest.due_date!);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    // Create meaningful description with gamification elements
    const description = [
      quest.description || '',
      '',
      `🎮 Quest Details:`,
      `⚔️ Difficulty: ${quest.difficulty}/10`,
      `⭐ Priority: ${quest.priority}/5`,
      `📂 Category: ${quest.category}`,
      `🏆 Type: ${quest.task_type}`,
      '',
      `Generated from Life Gamification App`,
      `Quest ID: ${quest.id}`
    ].join('\n');

    // Quest title with emoji based on category
    const categoryEmojis: { [key: string]: string } = {
      'health': '🏃',
      'work': '💼',
      'learning': '📚',
      'social': '👥',
      'creative': '🎨',
      'fitness': '💪',
      'personal': '🧘'
    };

    const emoji = categoryEmojis[quest.category.toLowerCase()] || '⚡';
    const title = `${emoji} ${quest.title}`;

    // Base event object
    const event: any = {
      summary: title,
      description: description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      colorId: this.getQuestColorId(quest.difficulty, quest.priority),
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 15 },
          { method: 'email', minutes: 60 }
        ]
      }
    };

    // Add recurrence rules for recurring quests
    if (quest.task_type === 'recurring') {
      event.recurrence = this.generateRecurrenceRules(quest);
    }

    return event;
  }

  private generateRecurrenceRules(quest: Quest): string[] {
    // Default to weekly recurrence for recurring quests
    // In the future, this could be enhanced with quest-specific recurrence patterns
    const rules: string[] = [];

    // Analyze quest title/description for recurrence patterns
    const questText = `${quest.title} ${quest.description || ''}`.toLowerCase();

    if (questText.includes('daily') || questText.includes('every day')) {
      rules.push('RRULE:FREQ=DAILY');
    } else if (questText.includes('weekly') || questText.includes('every week')) {
      rules.push('RRULE:FREQ=WEEKLY');
    } else if (questText.includes('monthly') || questText.includes('every month')) {
      rules.push('RRULE:FREQ=MONTHLY');
    } else if (questText.includes('workday') || questText.includes('weekday')) {
      rules.push('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR');
    } else if (questText.includes('weekend')) {
      rules.push('RRULE:FREQ=WEEKLY;BYDAY=SA,SU');
    } else {
      // Default weekly recurrence for recurring quests
      rules.push('RRULE:FREQ=WEEKLY');
    }

    return rules;
  }

  private getQuestColorId(difficulty: number, priority: number): string {
    // Google Calendar color IDs (1-11)
    if (difficulty >= 8) return '11'; // Red for high difficulty
    if (difficulty >= 6) return '6';  // Orange for medium-high
    if (priority >= 4) return '9';    // Purple for high priority
    if (priority >= 3) return '3';    // Purple for medium priority
    return '2'; // Green for normal tasks
  }

  // Tauri command wrappers
  private async getUnsyncedQuests(): Promise<Quest[]> {
    try {
      const tasks = await invoke<Quest[]>('get_tasks');
      return tasks.filter(task =>
        task.due_date &&
        task.status === 'active' &&
        !task.description?.includes('google_event_id:')
      );
    } catch (error) {
      logger.error('Failed to get unsynced quests', error, 'CalendarSync');
      return [];
    }
  }

  private async updateQuestWithGoogleEventId(questId: number, googleEventId: string): Promise<void> {
    try {
      await invoke('update_task_google_event_id', {
        taskId: questId,
        googleEventId
      });
      logger.info(`Updated quest ${questId} with Google event ID ${googleEventId}`, {}, 'CalendarSync');
    } catch (error) {
      logger.error('Failed to update quest with Google event ID', error, 'CalendarSync');
      throw error;
    }
  }

  private async getAllExistingQuests(): Promise<Quest[]> {
    try {
      return await invoke<Quest[]>('get_tasks');
    } catch (error) {
      logger.error('Failed to get existing quests', error, 'CalendarSync');
      return [];
    }
  }

  private async createQuestFromEventAnalysis(questData: any): Promise<Quest | null> {
    try {
      const newQuest = await invoke<Quest>('create_task', questData);
      logger.info(`Created quest from calendar event`, { questData }, 'CalendarSync');
      return newQuest;
    } catch (error) {
      logger.error('Failed to create quest from event analysis', error, 'CalendarSync');
      throw error;
    }
  }

  private async storeCalendarEvent(event: CalendarEvent): Promise<void> {
    // This would need a new Tauri command to store calendar events
    // You could create a calendar_events table in the database
    logger.info(`Would store calendar event: ${event.title}`, { event }, 'CalendarSync');
  }

  private async getLocalCalendarEvents(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    // This would fetch events from local calendar_events table
    return [];
  }

  private async getGoogleCalendarEventsForDisplay(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const calendarClient = await getGoogleCalendarClient();
      const response = await calendarClient.events.list({
        calendarId: 'primary',
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        maxResults: 50,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const googleEvents = response.result.items || [];
      return googleEvents.map(event => this.convertGoogleEventToCalendarEvent(event));
    } catch (error) {
      logger.error('Failed to get Google events for display', error, 'CalendarSync');
      return [];
    }
  }

  // Public API
  getLastSyncTime(): Date | null {
    return this.lastSyncTime;
  }

  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }
}

// Export singleton instance
export const calendarSyncService = new CalendarSyncService();

// Export utility functions
export const performFullSync = () => calendarSyncService.performFullSync();
export const createGoogleEventForQuest = (quest: Quest) => calendarSyncService.createGoogleEventForQuest(quest);
export const getAllCalendarEvents = (start: Date, end: Date) => calendarSyncService.getAllCalendarEvents(start, end);
export const getLastSyncTime = () => calendarSyncService.getLastSyncTime();
export const isSyncInProgress = () => calendarSyncService.isSyncInProgress();