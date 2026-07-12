import { invoke } from '@tauri-apps/api/core';

export interface UserProductivityPattern {
  userId: number;
  hourlyProductivity: number[]; // 24-hour array, 0-1 scale
  weeklyPattern: number[]; // 7-day array, 0-1 scale (0=Sunday)
  taskComplexityPreference: {
    [hour: number]: 'low' | 'medium' | 'high';
  };
  averageTaskDuration: number; // in minutes
  peakPerformanceHours: number[];
  lastUpdated: Date;
}

export interface NotificationSchedule {
  id: string;
  taskId?: number;
  type: 'reminder' | 'break' | 'review' | 'suggestion';
  title: string;
  message: string;
  scheduledTime: Date;
  priority: 'low' | 'medium' | 'high';
  complexity?: 'low' | 'medium' | 'high';
  estimatedDuration?: number;
  userId: number;
  sent: boolean;
  engagement?: 'clicked' | 'dismissed' | 'ignored';
}

class SmartNotificationScheduler {
  private userPatterns: Map<number, UserProductivityPattern> = new Map();
  private scheduledNotifications: NotificationSchedule[] = [];
  private engagementHistory: { time: Date; type: string; response: string }[] = [];

  // Analyze user's historical productivity patterns
  async analyzeUserPatterns(userId: number): Promise<UserProductivityPattern> {
    try {
      // Get user's task completion history
      const completionHistory = await invoke<Array<{ completed_at: string }>>('get_user_task_history', { userId });
      
      const pattern: UserProductivityPattern = {
        userId,
        hourlyProductivity: new Array(24).fill(0),
        weeklyPattern: new Array(7).fill(0),
        taskComplexityPreference: {},
        averageTaskDuration: 30,
        peakPerformanceHours: [],
        lastUpdated: new Date()
      };

      // Analyze hourly patterns
      const hourlyCompletions = new Array(24).fill(0);
      const hourlyTotal = new Array(24).fill(0);
      
      // Analyze weekly patterns
      const weeklyCompletions = new Array(7).fill(0);
      const weeklyTotal = new Array(7).fill(0);

      for (const completion of completionHistory) {
        const date = new Date(completion.completed_at);
        const hour = date.getHours();
        const day = date.getDay();
        
        hourlyCompletions[hour]++;
        hourlyTotal[hour]++;
        
        weeklyCompletions[day]++;
        weeklyTotal[day]++;
      }

      // Calculate productivity scores (0-1 scale)
      for (let i = 0; i < 24; i++) {
        pattern.hourlyProductivity[i] = hourlyTotal[i] > 0 ? hourlyCompletions[i] / Math.max(...hourlyTotal) : 0;
      }

      for (let i = 0; i < 7; i++) {
        pattern.weeklyPattern[i] = weeklyTotal[i] > 0 ? weeklyCompletions[i] / Math.max(...weeklyTotal) : 0;
      }

      // Find peak performance hours (top 3 hours)
      pattern.peakPerformanceHours = pattern.hourlyProductivity
        .map((score, hour) => ({ hour, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => item.hour);

      // Store pattern
      this.userPatterns.set(userId, pattern);
      
      return pattern;
    } catch (error) {
      console.error('Failed to analyze user patterns:', error);
      // Return default pattern
      return this.getDefaultPattern(userId);
    }
  }

  private getDefaultPattern(userId: number): UserProductivityPattern {
    // Default productivity pattern (morning and evening peaks)
    const hourlyProductivity = new Array(24).fill(0.3);
    hourlyProductivity[9] = 0.8;  // 9 AM
    hourlyProductivity[10] = 0.9; // 10 AM peak
    hourlyProductivity[11] = 0.8; // 11 AM
    hourlyProductivity[14] = 0.7; // 2 PM
    hourlyProductivity[15] = 0.8; // 3 PM
    hourlyProductivity[19] = 0.6; // 7 PM
    hourlyProductivity[20] = 0.7; // 8 PM

    return {
      userId,
      hourlyProductivity,
      weeklyPattern: [0.4, 0.9, 0.9, 0.8, 0.8, 0.7, 0.5], // Lower on weekends
      taskComplexityPreference: {
        9: 'high', 10: 'high', 11: 'high',
        14: 'medium', 15: 'medium',
        19: 'low', 20: 'low'
      },
      averageTaskDuration: 30,
      peakPerformanceHours: [10, 14, 20],
      lastUpdated: new Date()
    };
  }

  // Schedule optimal reminder time for a task
  async scheduleOptimalReminder(
    userId: number,
    taskId: number,
    taskTitle: string,
    baseTime: Date,
    complexity: 'low' | 'medium' | 'high' = 'medium',
    estimatedDuration: number = 30
  ): Promise<NotificationSchedule> {
    
    let pattern = this.userPatterns.get(userId);
    if (!pattern) {
      pattern = await this.analyzeUserPatterns(userId);
    }

    const optimalTime = this.findOptimalNotificationTime(
      baseTime,
      pattern,
      complexity,
      estimatedDuration
    );

    const notification: NotificationSchedule = {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      taskId,
      type: 'reminder',
      title: `Time to work on: ${taskTitle}`,
      message: `Ready to tackle this ${complexity}-complexity task? Estimated time: ${estimatedDuration} minutes`,
      scheduledTime: optimalTime,
      priority: complexity === 'high' ? 'high' : complexity === 'medium' ? 'medium' : 'low',
      complexity,
      estimatedDuration,
      userId,
      sent: false
    };

    this.scheduledNotifications.push(notification);
    this.scheduleNotificationDelivery(notification);

    return notification;
  }

  // Find the optimal time within a window around the base time
  private findOptimalNotificationTime(
    baseTime: Date,
    pattern: UserProductivityPattern,
    complexity: 'low' | 'medium' | 'high',
    duration: number
  ): Date {
    const windowStart = new Date(baseTime.getTime() - (2 * 60 * 60 * 1000)); // 2 hours before
    const windowEnd = new Date(baseTime.getTime() + (2 * 60 * 60 * 1000));   // 2 hours after

    let bestTime = baseTime;
    let bestScore = 0;

    // Check every 15-minute interval in the window
    for (let time = windowStart.getTime(); time <= windowEnd.getTime(); time += 15 * 60 * 1000) {
      const checkTime = new Date(time);
      const score = this.calculateTimeScore(checkTime, pattern, complexity, duration);
      
      if (score > bestScore) {
        bestScore = score;
        bestTime = checkTime;
      }
    }

    return bestTime;
  }

  // Calculate how good a specific time is for a notification
  private calculateTimeScore(
    time: Date,
    pattern: UserProductivityPattern,
    complexity: 'low' | 'medium' | 'high',
    duration: number
  ): number {
    const hour = time.getHours();
    const day = time.getDay();

    // Base productivity score for this hour/day
    const hourlyScore = pattern.hourlyProductivity[hour] || 0.5;
    const weeklyScore = pattern.weeklyPattern[day] || 0.5;

    // Complexity matching score
    const preferredComplexity = pattern.taskComplexityPreference[hour];
    let complexityScore = 0.5;
    
    if (preferredComplexity === complexity) {
      complexityScore = 1.0;
    } else if (
      (preferredComplexity === 'high' && complexity === 'medium') ||
      (preferredComplexity === 'medium' && complexity === 'low')
    ) {
      complexityScore = 0.7;
    }

    // Duration matching score (prefer shorter tasks during lower productivity hours)
    const durationScore = hourlyScore > 0.7 ? 1.0 : Math.max(0.3, 1.0 - (duration / 120));

    // Avoid notification fatigue (don't send too many in a short time)
    const fatigueScore = this.calculateFatigueScore(time);

    // Weighted combination
    const totalScore = (
      hourlyScore * 0.3 +
      weeklyScore * 0.2 +
      complexityScore * 0.25 +
      durationScore * 0.15 +
      fatigueScore * 0.1
    );

    return totalScore;
  }

  // Calculate notification fatigue score (lower if too many recent notifications)
  private calculateFatigueScore(time: Date): number {
    const recentWindow = 2 * 60 * 60 * 1000; // 2 hours
    const recentNotifications = this.scheduledNotifications.filter(notif => 
      Math.abs(notif.scheduledTime.getTime() - time.getTime()) < recentWindow
    );

    if (recentNotifications.length === 0) return 1.0;
    if (recentNotifications.length <= 2) return 0.8;
    if (recentNotifications.length <= 4) return 0.5;
    return 0.2;
  }

  // Schedule break reminders based on work patterns
  async scheduleBreakReminders(userId: number): Promise<NotificationSchedule[]> {
    const pattern = this.userPatterns.get(userId) || await this.analyzeUserPatterns(userId);
    const breakReminders: NotificationSchedule[] = [];

    // Schedule breaks during peak productivity hours
    for (const hour of pattern.peakPerformanceHours) {
      const breakTime = new Date();
      breakTime.setHours(hour, 30, 0, 0); // 30 minutes into peak hour
      
      if (breakTime > new Date()) { // Only schedule future breaks
        const reminder: NotificationSchedule = {
          id: `break_${Date.now()}_${hour}`,
          type: 'break',
          title: 'Time for a Power Break! ⚡',
          message: 'You\'ve been productive! Take a 5-10 minute break to recharge.',
          scheduledTime: breakTime,
          priority: 'medium',
          userId,
          sent: false
        };

        breakReminders.push(reminder);
        this.scheduledNotifications.push(reminder);
        this.scheduleNotificationDelivery(reminder);
      }
    }

    return breakReminders;
  }

  // Schedule daily review notifications
  async scheduleDailyReview(userId: number): Promise<NotificationSchedule> {
    const pattern = this.userPatterns.get(userId) || await this.analyzeUserPatterns(userId);
    
    // Find the best evening hour for review (after 6 PM)
    const eveningHours = pattern.hourlyProductivity.slice(18); // 6 PM onwards
    const bestEveningHour = eveningHours.indexOf(Math.max(...eveningHours)) + 18;

    const reviewTime = new Date();
    reviewTime.setHours(bestEveningHour, 0, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (reviewTime <= new Date()) {
      reviewTime.setDate(reviewTime.getDate() + 1);
    }

    const reviewNotification: NotificationSchedule = {
      id: `review_${Date.now()}_daily`,
      type: 'review',
      title: 'Daily Quest Review 📊',
      message: 'How did your productivity journey go today? Review your achievements!',
      scheduledTime: reviewTime,
      priority: 'low',
      userId,
      sent: false
    };

    this.scheduledNotifications.push(reviewNotification);
    this.scheduleNotificationDelivery(reviewNotification);

    return reviewNotification;
  }

  // Schedule the actual delivery of notifications
  private scheduleNotificationDelivery(notification: NotificationSchedule): void {
    const delay = notification.scheduledTime.getTime() - Date.now();
    
    if (delay > 0) {
      setTimeout(async () => {
        await this.deliverNotification(notification);
      }, delay);
    }
  }

  // Deliver the notification
  private async deliverNotification(notification: NotificationSchedule): Promise<void> {
    try {
      // Send notification through the system
      if (notification.type === 'reminder' && notification.taskId) {
        // Task reminder notification
        console.log(`🔔 Task Reminder: ${notification.title}`);
      } else {
        // General notification
        console.log(`🔔 ${notification.title}: ${notification.message}`);
      }

      // Mark as sent
      notification.sent = true;

      // Track delivery
      this.engagementHistory.push({
        time: new Date(),
        type: notification.type,
        response: 'delivered'
      });

      // You could integrate with the actual notification system here
      // await notificationService.notify(notification.title, notification.message);
      
    } catch (error) {
      console.error('Failed to deliver notification:', error);
    }
  }

  // Track user engagement with notifications
  trackEngagement(notificationId: string, response: 'clicked' | 'dismissed' | 'ignored'): void {
    const notification = this.scheduledNotifications.find(n => n.id === notificationId);
    if (notification) {
      notification.engagement = response;
      
      this.engagementHistory.push({
        time: new Date(),
        type: notification.type,
        response
      });

      // Learn from engagement patterns
      this.updateUserPatternFromEngagement(notification, response);
    }
  }

  // Update user patterns based on engagement
  private updateUserPatternFromEngagement(
    notification: NotificationSchedule,
    response: 'clicked' | 'dismissed' | 'ignored'
  ): void {
    const pattern = this.userPatterns.get(notification.userId);
    if (!pattern) return;

    const hour = notification.scheduledTime.getHours();
    const engagementScore = response === 'clicked' ? 1.0 : response === 'dismissed' ? -0.5 : -0.2;

    // Adjust hourly productivity based on engagement
    const currentScore = pattern.hourlyProductivity[hour];
    pattern.hourlyProductivity[hour] = Math.max(0, Math.min(1, currentScore + engagementScore * 0.1));

    pattern.lastUpdated = new Date();
  }

  // Get notification statistics
  getNotificationStats(userId: number): {
    totalScheduled: number;
    totalSent: number;
    engagementRate: number;
    bestHours: number[];
    avgResponseTime: number;
  } {
    const userNotifications = this.scheduledNotifications.filter(n => n.userId === userId);
    const sentNotifications = userNotifications.filter(n => n.sent);
    const engagedNotifications = userNotifications.filter(n => n.engagement === 'clicked');

    return {
      totalScheduled: userNotifications.length,
      totalSent: sentNotifications.length,
      engagementRate: sentNotifications.length > 0 ? engagedNotifications.length / sentNotifications.length : 0,
      bestHours: this.userPatterns.get(userId)?.peakPerformanceHours || [],
      avgResponseTime: 0 // This would need more tracking to implement
    };
  }

  // Clean up old notifications
  cleanup(): void {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    this.scheduledNotifications = this.scheduledNotifications.filter(
      n => n.scheduledTime > oneWeekAgo
    );
    
    this.engagementHistory = this.engagementHistory.filter(
      e => e.time > oneWeekAgo
    );
  }

  // Get upcoming notifications
  getUpcomingNotifications(userId: number, hours: number = 24): NotificationSchedule[] {
    const endTime = new Date(Date.now() + hours * 60 * 60 * 1000);
    
    return this.scheduledNotifications
      .filter(n => 
        n.userId === userId && 
        !n.sent && 
        n.scheduledTime <= endTime &&
        n.scheduledTime >= new Date()
      )
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }
}

// Export singleton instance
export const smartNotificationScheduler = new SmartNotificationScheduler();

// Convenience functions
export const scheduleTaskReminder = (
  userId: number,
  taskId: number,
  taskTitle: string,
  baseTime: Date,
  complexity?: 'low' | 'medium' | 'high',
  duration?: number
) => smartNotificationScheduler.scheduleOptimalReminder(userId, taskId, taskTitle, baseTime, complexity, duration);

export const analyzeUserProductivity = (userId: number) => 
  smartNotificationScheduler.analyzeUserPatterns(userId);

export const getNotificationStats = (userId: number) => 
  smartNotificationScheduler.getNotificationStats(userId);