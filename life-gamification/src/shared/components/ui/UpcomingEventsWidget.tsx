import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, CheckCircle2, Plus, ExternalLink, Zap } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import { useCalendarStore } from '../../../store/calendarStore';
import { format, isToday, isTomorrow, isThisWeek, parseISO } from 'date-fns';

interface UpcomingEventsWidgetProps {
  maxEvents?: number;
  onEventClick?: (eventId: string) => void;
}

interface CalendarEventWithSource {
  id: string;
  title: string;
  start: Date;
  end?: Date;
  source: 'quest' | 'google' | 'apple';
  taskId?: number;
  category?: string;
  difficulty?: number;
  xpReward?: number;
  description?: string;
}

export const UpcomingEventsWidget = ({
  maxEvents = 5,
  onEventClick
}: UpcomingEventsWidgetProps) => {
  const { tasks, completeTask, createTask } = useGameStore();
  const { syncedCalendars, syncCalendars, isSyncing, lastSyncTime } = useCalendarStore();
  const [converting, setConverting] = useState<string | null>(null);

  // Combine quests and synced calendar events
  const upcomingEvents = useMemo((): CalendarEventWithSource[] => {
    const events: CalendarEventWithSource[] = [];
    const now = new Date();

    // Add active quests with due dates
    if (Array.isArray(tasks)) {
      tasks.forEach(task => {
        if (task.status === 'active' && task.due_date) {
          const dueDate = parseISO(task.due_date);
          if (dueDate >= now) {
            events.push({
              id: `quest-${task.id}`,
              title: task.title,
              start: dueDate,
              source: 'quest',
              taskId: task.id,
              category: task.category,
              difficulty: task.difficulty,
              xpReward: task.base_experience_reward,
              description: task.description
            });
          }
        }
      });
    }

    // Add synced calendar events
    syncedCalendars.forEach(event => {
      const eventStart = typeof event.start === 'string' ? parseISO(event.start) : event.start;
      if (eventStart >= now) {
        events.push({
          id: event.id,
          title: event.title,
          start: eventStart,
          end: event.end ? (typeof event.end === 'string' ? parseISO(event.end) : event.end) : undefined,
          source: event.source as 'google' | 'apple',
          description: event.description
        });
      }
    });

    // Sort by start time and take first N events
    return events
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, maxEvents);
  }, [tasks, syncedCalendars, maxEvents]);

  const handleCompleteQuest = async (taskId: number) => {
    try {
      await completeTask(taskId);
    } catch (error) {
      console.error('Failed to complete quest:', error);
    }
  };

  const handleConvertToQuest = async (event: CalendarEventWithSource) => {
    setConverting(event.id);
    try {
      await createTask({
        title: event.title,
        description: event.description,
        category: 'general',
        difficulty: 3,
        priority: 3,
        task_type: 'standard',
        due_date: event.start.toISOString(),
      });
    } catch (error) {
      console.error('Failed to convert event:', error);
    } finally {
      setConverting(null);
    }
  };

  const getEventIcon = (source: string) => {
    switch (source) {
      case 'quest':
        return <Zap className="w-4 h-4 text-theme-accent" />;
      case 'google':
        return <Calendar className="w-4 h-4 text-blue-400" />;
      case 'apple':
        return <Calendar className="w-4 h-4 text-gray-400" />;
      default:
        return <Calendar className="w-4 h-4 text-gray-400" />;
    }
  };

  const getEventColor = (source: string) => {
    switch (source) {
      case 'quest':
        return 'border-theme-accent bg-theme-accent/5';
      case 'google':
        return 'border-blue-500 bg-blue-500/5';
      case 'apple':
        return 'border-gray-500 bg-gray-500/5';
      default:
        return 'border-gray-700 bg-gray-700/5';
    }
  };

  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'MMM d');
  };

  if (upcomingEvents.length === 0) {
    return (
      <div className="bg-theme-primary rounded-lg p-6 border-2 border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-theme-fg">Upcoming Events</h3>
        </div>
        <div className="text-center py-8 text-gray-400">
          <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No upcoming events</p>
          <p className="text-sm mt-1">Create quests or sync your calendar to see events here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-theme-primary rounded-lg p-6 border-2 border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-bold text-theme-fg">Upcoming Events</h3>
        </div>
        <button
          onClick={() => syncCalendars()}
          disabled={isSyncing}
          className="text-xs text-gray-400 hover:text-theme-fg transition-colors flex items-center gap-1"
          title={lastSyncTime ? `Last synced: ${format(lastSyncTime, 'h:mm a')}` : 'Not synced yet'}
        >
          <ExternalLink className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
          {isSyncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      <div className="space-y-3">
        {upcomingEvents.map((event) => (
          <div
            key={event.id}
            className={`rounded-lg p-3 border-2 transition-all hover:shadow-md cursor-pointer ${getEventColor(event.source)}`}
            onClick={() => onEventClick?.(event.id)}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-1">
                {getEventIcon(event.source)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-theme-fg text-sm truncate">
                      {event.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{getDateLabel(event.start)}</span>
                      <span>•</span>
                      <span>{format(event.start, 'h:mm a')}</span>
                    </div>
                    {event.category && (
                      <div className="mt-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700/50 text-gray-300">
                          {event.category}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {event.source === 'quest' && event.taskId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompleteQuest(event.taskId!);
                      }}
                      className="flex-shrink-0 p-1.5 rounded-full hover:bg-green-600/20 text-green-400 transition-colors"
                      title="Complete quest"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {(event.source === 'google' || event.source === 'apple') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertToQuest(event);
                      }}
                      disabled={converting === event.id}
                      className="flex-shrink-0 p-1.5 rounded-full hover:bg-theme-accent/20 text-theme-accent transition-colors disabled:opacity-50"
                      title="Convert to quest"
                    >
                      {converting === event.id ? (
                        <div className="w-4 h-4 border-2 border-theme-accent border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* XP reward for quests */}
                {event.xpReward && (
                  <div className="mt-2 text-xs text-blue-400">
                    +{event.xpReward} XP
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-theme-accent" />
            <span>Quest</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-blue-400" />
            <span>Google</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-gray-400" />
            <span>Apple</span>
          </div>
        </div>
        {lastSyncTime && (
          <span>Synced {format(lastSyncTime, 'h:mm a')}</span>
        )}
      </div>
    </div>
  );
};
