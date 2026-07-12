import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import googleCalendarPlugin from '@fullcalendar/google-calendar';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Settings, 
  RefreshCw, 
  Link,
  Unlink,
  Grid3x3,
  List
} from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useCalendarStore } from '../../store/calendarStore';
import { format } from 'date-fns';
import { DIFFICULTY_LEVELS } from '../../types';
import CreateTaskModal from '../../shared/components/ui/CreateTaskModal';
import { useToast } from '../../shared/components/ui/Toast';
import { logger } from '../../utils/logger';
import { FadeIn } from '../../shared/components/ui/AnimatedComponents';

interface CalendarEvent {
  id: string;
  title: string;
  start: Date | string;
  end?: Date | string;
  allDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  extendedProps?: {
    taskId?: number;
    difficulty?: number;
    category?: string;
    isRecurring?: boolean;
    isFromGoogle?: boolean;
    isFromApple?: boolean;
    description?: string;
    xpReward?: number;
    goldReward?: number;
  };
}

const CalendarPage: React.FC = () => {
  const { tasks, fetchTasks } = useGameStore();
  const { 
    googleCalendarConnected, 
    appleCalendarConnected,
    syncedCalendars,
    connectGoogleCalendar,
    disconnectGoogleCalendar,
    connectAppleCalendar,
    disconnectAppleCalendar,
    syncCalendars,
    isSyncing
  } = useCalendarStore();
  
  const toast = useToast();
  const calendarRef = useRef<any>(null);
  const [view, setView] = useState<'month' | 'week' | 'day' | 'list'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [, setSelectedDateForTask] = useState<Date | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Handle view changes
  useEffect(() => {
    if (calendarRef.current) {
      const calendarApi = calendarRef.current.getApi();
      const viewName = view === 'month' ? 'dayGridMonth' : 
                      view === 'week' ? 'timeGridWeek' :
                      view === 'day' ? 'timeGridDay' : 'listWeek';
      calendarApi.changeView(viewName);
      calendarApi.gotoDate(selectedDate);
    }
  }, [view, selectedDate]);

  // Get tasks for selected date
  const getTasksForDate = useCallback((date: Date) => {
    if (!Array.isArray(tasks)) return [];
    
    const dateStr = format(date, 'yyyy-MM-dd');
    return tasks.filter(task => {
      if (task.status !== 'active' || !task.due_date) return false;
      const taskDateStr = format(new Date(task.due_date), 'yyyy-MM-dd');
      return taskDateStr === dateStr;
    });
  }, [tasks]);

  const selectedDateTasks = getTasksForDate(selectedDate);

  // Convert tasks to calendar events
  const calendarEvents = useMemo((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    
    // Add tasks as events - check if tasks is an array first
    if (Array.isArray(tasks)) {
      tasks.forEach(task => {
        if (task.status === 'active' && task.due_date) {
          const difficulty = DIFFICULTY_LEVELS[task.difficulty as keyof typeof DIFFICULTY_LEVELS] || DIFFICULTY_LEVELS[1];
          events.push({
            id: `task-${task.id}`,
            title: task.title,
            start: task.due_date,
            allDay: true,
            backgroundColor: difficulty.color + '20',
            borderColor: difficulty.color,
            textColor: difficulty.color,
            extendedProps: {
              taskId: task.id,
              difficulty: task.difficulty,
              category: task.category,
              isRecurring: task.task_type === 'recurring',
              description: task.description,
              xpReward: task.base_experience_reward,
              goldReward: task.gold_reward
            }
          });
        }
      });
    }

    // Add synced calendar events
    syncedCalendars.forEach(event => {
      events.push({
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: event.allDay,
        backgroundColor: event.source === 'google' ? '#4285F420' : '#A78BFA20',
        borderColor: event.source === 'google' ? '#4285F4' : '#A78BFA',
        textColor: event.source === 'google' ? '#4285F4' : '#A78BFA',
        extendedProps: {
          isFromGoogle: event.source === 'google',
          isFromApple: event.source === 'apple',
          description: event.description
        }
      });
    });

    return events;
  }, [tasks, syncedCalendars]);

  // Handle date click
  const handleDateClick = useCallback((info: any) => {
    setSelectedDate(info.date);
    setView('day');
  }, []);

  // Handle event click
  const handleEventClick = useCallback((info: any) => {
    const { taskId } = info.event.extendedProps;
    if (taskId) {
      // Navigate to task details or open task modal
      logger.info('Calendar event clicked', { taskId }, 'Calendar');
    }
  }, []);

  // Handle Google Calendar connection
  const handleGoogleConnect = async () => {
    try {
      await connectGoogleCalendar();
      toast.success('Connected to Google Calendar');
      await syncCalendars();
    } catch (error) {
      logger.error('Failed to connect Google Calendar', error, 'Calendar');
      toast.error('Failed to connect to Google Calendar');
    }
  };

  const handleGoogleDisconnect = async () => {
    try {
      await disconnectGoogleCalendar();
      toast.success('Disconnected from Google Calendar');
    } catch (error) {
      logger.error('Failed to disconnect Google Calendar', error, 'Calendar');
      toast.error('Failed to disconnect from Google Calendar');
    }
  };

  // Handle Apple Calendar connection
  const handleAppleConnect = async () => {
    try {
      await connectAppleCalendar();
      toast.success('Connected to Apple Calendar');
      await syncCalendars();
    } catch (error) {
      logger.error('Failed to connect Apple Calendar', error, 'Calendar');
      toast.error('Failed to connect to Apple Calendar');
    }
  };

  const handleAppleDisconnect = async () => {
    try {
      await disconnectAppleCalendar();
      toast.success('Disconnected from Apple Calendar');
    } catch (error) {
      logger.error('Failed to disconnect Apple Calendar', error, 'Calendar');
      toast.error('Failed to disconnect from Apple Calendar');
    }
  };

  // Handle sync
  const handleSync = async () => {
    try {
      await syncCalendars();
      toast.success('Calendars synced successfully');
    } catch (error) {
      logger.error('Failed to sync calendars', error, 'Calendar');
      toast.error('Failed to sync calendars');
    }
  };

  return (
    <FadeIn className="h-full flex flex-col bg-theme-primary">
      {/* Header */}
      <div className="bg-theme-secondary border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <CalendarIcon className="w-6 h-6 text-blue-400" />
            <h1 className="text-2xl font-bold text-white">Quest Calendar</h1>
            
            {/* View Toggle */}
            <div className="flex items-center space-x-2 bg-theme-primary rounded-lg p-1">
              <button
                onClick={() => setView('month')}
                className={`px-3 py-1 rounded transition-colors ${
                  view === 'month' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('week')}
                className={`px-3 py-1 rounded transition-colors ${
                  view === 'week' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setView('day')}
                className={`px-3 py-1 rounded transition-colors ${
                  view === 'day' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1 rounded transition-colors ${
                  view === 'list' 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Sync Status */}
            <div className="flex items-center space-x-2 text-sm">
              {googleCalendarConnected && (
                <span className="px-2 py-1 bg-blue-600 bg-opacity-20 text-blue-400 rounded">
                  Google
                </span>
              )}
              {appleCalendarConnected && (
                <span className="px-2 py-1 bg-gray-600 bg-opacity-20 text-gray-400 rounded">
                  Apple
                </span>
              )}
            </div>
            
            {/* Actions */}
            <button
              onClick={handleSync}
              disabled={isSyncing || (!googleCalendarConnected && !appleCalendarConnected)}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>Sync</span>
            </button>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Quest</span>
            </button>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-theme-secondary border-b border-gray-700 p-4">
          <h3 className="text-lg font-semibold text-white mb-4">Calendar Integrations</h3>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Google Calendar */}
            <div className="bg-theme-primary rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    G
                  </div>
                  <span className="text-white font-medium">Google Calendar</span>
                </div>
                {googleCalendarConnected ? (
                  <button
                    onClick={handleGoogleDisconnect}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center space-x-1"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={handleGoogleConnect}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center space-x-1"
                  >
                    <Link className="w-3 h-3" />
                    <span>Connect</span>
                  </button>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {googleCalendarConnected 
                  ? 'Syncing events from your Google Calendar'
                  : 'Connect to sync your Google Calendar events'}
              </p>
            </div>
            
            {/* Apple Calendar */}
            <div className="bg-theme-primary rounded-lg p-4 border border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                    🍎
                  </div>
                  <span className="text-white font-medium">Apple Calendar</span>
                </div>
                {appleCalendarConnected ? (
                  <button
                    onClick={handleAppleDisconnect}
                    className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center space-x-1"
                  >
                    <Unlink className="w-3 h-3" />
                    <span>Disconnect</span>
                  </button>
                ) : (
                  <button
                    onClick={handleAppleConnect}
                    className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 flex items-center space-x-1"
                  >
                    <Link className="w-3 h-3" />
                    <span>Connect</span>
                  </button>
                )}
              </div>
              <p className="text-gray-400 text-sm">
                {appleCalendarConnected 
                  ? 'Syncing events from your Apple Calendar'
                  : 'Connect to sync your Apple Calendar events'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="flex-1 p-4 flex gap-4">
        <div className={`bg-theme-secondary rounded-lg p-4 h-full ${view === 'day' ? 'flex-1' : 'w-full'}`}>
          <FullCalendar
            ref={calendarRef}
            plugins={[
              dayGridPlugin, 
              timeGridPlugin, 
              interactionPlugin,
              googleCalendarPlugin
            ]}
            initialView='dayGridMonth'
            initialDate={selectedDate}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: ''
            }}
            events={calendarEvents}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="100%"
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            themeSystem="standard"
            eventDisplay="block"
            eventTimeFormat={{
              hour: 'numeric',
              minute: '2-digit',
              meridiem: 'short'
            }}
          />
        </div>
        
        {/* Day Tasks List */}
        {view === 'day' && (
          <div className="w-80 bg-theme-secondary rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h3>
              <button
                onClick={() => {
                  setSelectedDateForTask(selectedDate);
                  setShowCreateModal(true);
                }}
                className="p-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                title="Add Quest for this day"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {selectedDateTasks.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <CalendarIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No quests for this day</p>
                  <button
                    onClick={() => {
                      setSelectedDateForTask(selectedDate);
                      setShowCreateModal(true);
                    }}
                    className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Create your first quest
                  </button>
                </div>
              ) : (
                selectedDateTasks.map(task => {
                  const difficulty = DIFFICULTY_LEVELS[task.difficulty as keyof typeof DIFFICULTY_LEVELS] || DIFFICULTY_LEVELS[1];
                  return (
                    <div
                      key={task.id}
                      className="bg-theme-primary rounded-lg p-3 border-l-4 hover:bg-opacity-80 transition-colors cursor-pointer"
                      style={{ borderLeftColor: difficulty.color }}
                      onClick={() => {
                        // Handle task click - could open task details
                        logger.info('Task clicked from day view', { taskId: task.id }, 'Calendar');
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-white text-sm mb-1">{task.title}</h4>
                          {task.description && (
                            <p className="text-gray-400 text-xs mb-2 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 rounded text-white" style={{ backgroundColor: difficulty.color + '40', color: difficulty.color }}>
                              {difficulty.label}
                            </span>
                            <span className="text-gray-400">
                              {task.category}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end text-xs text-gray-400 ml-2">
                          <span>+{task.base_experience_reward} XP</span>
                          <span>+{task.gold_reward} Gold</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <CreateTaskModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedDateForTask(null);
          }}
        />
      )}
    </FadeIn>
  );
};

export default CalendarPage;