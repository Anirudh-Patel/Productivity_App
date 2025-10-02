import { invoke } from '@tauri-apps/api/core';
import { logger } from '../utils/logger';

// Event analysis types
export interface EventAnalysis {
  category: string;
  difficulty: number;
  priority: number;
  taskType: 'standard' | 'goal' | 'recurring';
  confidence: number; // 0-100% confidence in analysis
  reasoning: string;
  suggestedTitle: string;
  suggestedDescription: string;
  estimatedDuration: number; // in minutes
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  attendees?: string[];
  recurring?: boolean;
}

// Event categorization patterns
const EVENT_PATTERNS = {
  // Work & Professional
  work: {
    keywords: ['meeting', 'standup', 'sync', 'review', 'call', 'interview', 'presentation', 'demo', 'sprint', 'retrospective', 'planning', 'budget', 'proposal', 'deadline', 'deliverable', 'project', 'client', 'customer', 'conference', 'workshop', 'training'],
    difficulty: { min: 4, max: 8 },
    priority: { min: 3, max: 5 },
    category: 'work'
  },

  // Health & Medical
  health: {
    keywords: ['doctor', 'dentist', 'appointment', 'checkup', 'medical', 'clinic', 'hospital', 'therapy', 'physical', 'dental', 'eye', 'surgery', 'vaccine', 'blood', 'test', 'screening', 'wellness', 'fitness', 'gym', 'workout', 'exercise', 'run', 'yoga'],
    difficulty: { min: 2, max: 6 },
    priority: { min: 4, max: 5 },
    category: 'health'
  },

  // Personal & Family
  personal: {
    keywords: ['family', 'dinner', 'lunch', 'birthday', 'anniversary', 'wedding', 'party', 'celebration', 'visit', 'hangout', 'date', 'movie', 'shopping', 'grocery', 'errands', 'personal', 'home', 'house', 'maintenance', 'repair', 'cleaning'],
    difficulty: { min: 1, max: 4 },
    priority: { min: 2, max: 4 },
    category: 'personal'
  },

  // Learning & Education
  learning: {
    keywords: ['class', 'course', 'lesson', 'study', 'exam', 'test', 'homework', 'assignment', 'research', 'reading', 'book', 'tutorial', 'learning', 'education', 'school', 'university', 'college', 'certification', 'training', 'webinar', 'seminar'],
    difficulty: { min: 3, max: 7 },
    priority: { min: 3, max: 5 },
    category: 'learning'
  },

  // Financial
  financial: {
    keywords: ['bank', 'financial', 'tax', 'payment', 'bill', 'insurance', 'investment', 'budget', 'accounting', 'expense', 'receipt', 'loan', 'mortgage', 'credit', 'advisor', 'finance'],
    difficulty: { min: 3, max: 6 },
    priority: { min: 4, max: 5 },
    category: 'finance'
  },

  // Travel
  travel: {
    keywords: ['flight', 'travel', 'trip', 'vacation', 'hotel', 'booking', 'departure', 'arrival', 'airport', 'train', 'bus', 'car', 'rental', 'check-in', 'check-out', 'itinerary', 'passport', 'visa'],
    difficulty: { min: 2, max: 5 },
    priority: { min: 3, max: 5 },
    category: 'travel'
  },

  // Social
  social: {
    keywords: ['friends', 'social', 'gathering', 'meetup', 'networking', 'event', 'concert', 'show', 'theater', 'sports', 'game', 'club', 'community', 'volunteer', 'charity', 'church', 'religious'],
    difficulty: { min: 1, max: 3 },
    priority: { min: 2, max: 4 },
    category: 'social'
  },

  // Creative
  creative: {
    keywords: ['art', 'music', 'writing', 'design', 'creative', 'painting', 'drawing', 'photography', 'video', 'editing', 'recording', 'performance', 'craft', 'hobby', 'project', 'portfolio'],
    difficulty: { min: 2, max: 6 },
    priority: { min: 2, max: 4 },
    category: 'creative'
  }
};

// Special event type patterns
const SPECIAL_PATTERNS = {
  reminder: {
    keywords: ['reminder', 'remember', 'don\'t forget', 'call', 'text', 'email', 'follow up', 'check', 'review'],
    taskType: 'standard' as const,
    difficultyModifier: -1,
    priorityModifier: 1
  },

  deadline: {
    keywords: ['deadline', 'due', 'submit', 'deliver', 'complete', 'finish', 'final', 'end date', 'cutoff'],
    taskType: 'standard' as const,
    difficultyModifier: 2,
    priorityModifier: 2
  },

  recurring: {
    keywords: ['weekly', 'daily', 'monthly', 'every', 'recurring', 'regular', 'routine', 'standup', 'check-in'],
    taskType: 'recurring' as const,
    difficultyModifier: 0,
    priorityModifier: 0
  },

  appointment: {
    keywords: ['appointment', 'meeting', 'session', 'consultation', 'visit', 'scheduled'],
    taskType: 'standard' as const,
    difficultyModifier: 0,
    priorityModifier: 1
  },

  project: {
    keywords: ['project', 'milestone', 'phase', 'deliverable', 'goal', 'objective', 'target'],
    taskType: 'goal' as const,
    difficultyModifier: 1,
    priorityModifier: 1
  }
};

class EventAnalysisService {

  // Main analysis function
  analyzeEvent(event: CalendarEventInput): EventAnalysis {
    const text = this.extractAnalysisText(event);
    const textLower = text.toLowerCase();

    // Find category match
    const categoryAnalysis = this.analyzeCategoryAndDifficulty(textLower);

    // Find special type patterns
    const specialTypeAnalysis = this.analyzeSpecialTypes(textLower);

    // Analyze timing and duration
    const timingAnalysis = this.analyzeTimingAndDuration(event);

    // Determine final values
    const difficulty = this.calculateFinalDifficulty(
      categoryAnalysis.difficulty,
      specialTypeAnalysis.difficultyModifier,
      timingAnalysis.durationHours
    );

    const priority = this.calculateFinalPriority(
      categoryAnalysis.priority,
      specialTypeAnalysis.priorityModifier,
      timingAnalysis.urgency
    );

    // Generate smart title and description
    const titleAndDescription = this.generateQuestTitleAndDescription(
      event,
      categoryAnalysis.category,
      specialTypeAnalysis.type
    );

    const analysis: EventAnalysis = {
      category: categoryAnalysis.category,
      difficulty: Math.max(1, Math.min(10, difficulty)),
      priority: Math.max(1, Math.min(5, priority)),
      taskType: specialTypeAnalysis.taskType,
      confidence: this.calculateConfidence(categoryAnalysis, specialTypeAnalysis, textLower),
      reasoning: this.generateReasoning(categoryAnalysis, specialTypeAnalysis, timingAnalysis),
      suggestedTitle: titleAndDescription.title,
      suggestedDescription: titleAndDescription.description,
      estimatedDuration: timingAnalysis.estimatedMinutes
    };

    logger.info('Event analysis completed', { event: event.title, analysis }, 'EventAnalysis');
    return analysis;
  }

  private extractAnalysisText(event: CalendarEventInput): string {
    const parts = [
      event.title,
      event.description || '',
      event.location || '',
      ...(event.attendees || [])
    ];
    return parts.join(' ').trim();
  }

  private analyzeCategoryAndDifficulty(text: string) {
    let bestMatch = { category: 'general', difficulty: 3, priority: 3, score: 0 };

    for (const [patternName, pattern] of Object.entries(EVENT_PATTERNS)) {
      const score = this.calculateKeywordScore(text, pattern.keywords);

      if (score > bestMatch.score) {
        bestMatch = {
          category: pattern.category,
          difficulty: Math.round((pattern.difficulty.min + pattern.difficulty.max) / 2),
          priority: Math.round((pattern.priority.min + pattern.priority.max) / 2),
          score
        };
      }
    }

    return bestMatch;
  }

  private analyzeSpecialTypes(text: string) {
    let bestMatch = {
      type: 'standard',
      taskType: 'standard' as const,
      difficultyModifier: 0,
      priorityModifier: 0,
      score: 0
    };

    for (const [typeName, pattern] of Object.entries(SPECIAL_PATTERNS)) {
      const score = this.calculateKeywordScore(text, pattern.keywords);

      if (score > bestMatch.score) {
        bestMatch = {
          type: typeName,
          taskType: pattern.taskType,
          difficultyModifier: pattern.difficultyModifier,
          priorityModifier: pattern.priorityModifier,
          score
        };
      }
    }

    return bestMatch;
  }

  private analyzeTimingAndDuration(event: CalendarEventInput) {
    const now = new Date();
    const eventStart = new Date(event.start);
    const eventEnd = event.end ? new Date(event.end) : null;

    // Calculate duration
    const durationHours = eventEnd
      ? (eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60)
      : event.allDay ? 8 : 1; // Default durations

    // Calculate urgency (how soon is the event)
    const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);
    let urgency = 0;

    if (hoursUntilEvent < 2) urgency = 3;      // Very urgent
    else if (hoursUntilEvent < 24) urgency = 2; // Urgent
    else if (hoursUntilEvent < 72) urgency = 1; // Somewhat urgent
    else urgency = 0;                           // Not urgent

    return {
      durationHours,
      urgency,
      estimatedMinutes: Math.round(durationHours * 60),
      hoursUntilEvent
    };
  }

  private calculateKeywordScore(text: string, keywords: string[]): number {
    let score = 0;
    const words = text.toLowerCase().split(/\s+/);

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // Exact match gets higher score
        if (words.includes(keyword)) {
          score += 2;
        } else {
          // Partial match gets lower score
          score += 1;
        }
      }
    }

    return score;
  }

  private calculateFinalDifficulty(baseDifficulty: number, modifier: number, durationHours: number): number {
    let difficulty = baseDifficulty + modifier;

    // Duration adjustments
    if (durationHours > 4) difficulty += 2;      // Long events are harder
    else if (durationHours > 2) difficulty += 1;
    else if (durationHours < 0.5) difficulty -= 1; // Quick events are easier

    return difficulty;
  }

  private calculateFinalPriority(basePriority: number, modifier: number, urgency: number): number {
    return basePriority + modifier + urgency;
  }

  private generateQuestTitleAndDescription(
    event: CalendarEventInput,
    category: string,
    specialType: string
  ) {
    const categoryEmojis: { [key: string]: string } = {
      work: '💼', health: '🏥', personal: '🏠', learning: '📚',
      financial: '💰', travel: '✈️', social: '👥', creative: '🎨',
      general: '📅'
    };

    const typeActions: { [key: string]: string } = {
      reminder: 'Remember to',
      deadline: 'Complete by deadline',
      appointment: 'Attend',
      project: 'Work on',
      standard: 'Handle'
    };

    const emoji = categoryEmojis[category] || '📅';
    const action = typeActions[specialType] || 'Attend';

    // Smart title generation
    let title = event.title;
    if (!title.toLowerCase().includes(action.toLowerCase())) {
      title = `${emoji} ${action}: ${title}`;
    } else {
      title = `${emoji} ${title}`;
    }

    // Smart description generation
    const descriptionParts = [
      event.description || '',
      '',
      `🎮 Auto-generated quest from calendar event`,
      `📍 Location: ${event.location || 'Not specified'}`,
      `👥 Attendees: ${event.attendees?.length || 0}`,
      `🏷️ Category: ${category}`,
      `⚡ Type: ${specialType}`
    ];

    return {
      title: title.slice(0, 100), // Limit title length
      description: descriptionParts.join('\n')
    };
  }

  private calculateConfidence(
    categoryAnalysis: any,
    specialTypeAnalysis: any,
    text: string
  ): number {
    let confidence = 0;

    // Base confidence from category matching
    confidence += Math.min(40, categoryAnalysis.score * 5);

    // Confidence from special type matching
    confidence += Math.min(30, specialTypeAnalysis.score * 5);

    // Confidence from text length and detail
    if (text.length > 50) confidence += 10;
    if (text.length > 100) confidence += 10;

    // Confidence from having multiple data points
    const hasLocation = text.includes('location') || text.includes('at ');
    const hasTime = text.includes('time') || text.includes(':');
    const hasDetails = text.split(' ').length > 5;

    if (hasLocation) confidence += 5;
    if (hasTime) confidence += 5;
    if (hasDetails) confidence += 5;

    return Math.min(100, confidence);
  }

  private generateReasoning(
    categoryAnalysis: any,
    specialTypeAnalysis: any,
    timingAnalysis: any
  ): string {
    const reasons = [];

    if (categoryAnalysis.score > 0) {
      reasons.push(`Categorized as '${categoryAnalysis.category}' based on keywords`);
    }

    if (specialTypeAnalysis.score > 0) {
      reasons.push(`Identified as '${specialTypeAnalysis.type}' type event`);
    }

    if (timingAnalysis.urgency > 0) {
      reasons.push(`High priority due to proximity (${Math.round(timingAnalysis.hoursUntilEvent)} hours away)`);
    }

    if (timingAnalysis.durationHours > 2) {
      reasons.push(`Increased difficulty due to long duration (${timingAnalysis.durationHours.toFixed(1)} hours)`);
    }

    return reasons.length > 0
      ? reasons.join('. ') + '.'
      : 'Analysis based on general event patterns.';
  }

  // Check if an event was auto-generated from a quest
  isQuestGeneratedEvent(event: CalendarEventInput): boolean {
    const description = event.description?.toLowerCase() || '';
    return description.includes('generated from life gamification app') ||
           description.includes('auto-generated quest') ||
           event.title.match(/^[🏃💼📚👥🎨⚡🏥🏠💰✈️📅]/); // Starts with our category emojis
  }

  // Batch analyze multiple events
  analyzeEvents(events: CalendarEventInput[]): EventAnalysis[] {
    return events
      .filter(event => !this.isQuestGeneratedEvent(event)) // Skip our own generated events
      .map(event => this.analyzeEvent(event));
  }
}

// Export singleton
export const eventAnalysisService = new EventAnalysisService();

// Utility functions
export const analyzeCalendarEvent = (event: CalendarEventInput) => eventAnalysisService.analyzeEvent(event);
export const analyzeCalendarEvents = (events: CalendarEventInput[]) => eventAnalysisService.analyzeEvents(events);
export const isQuestGeneratedEvent = (event: CalendarEventInput) => eventAnalysisService.isQuestGeneratedEvent(event);