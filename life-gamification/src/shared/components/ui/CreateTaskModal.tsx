import { useEffect, useState } from 'react';
import { X, Sword, Zap, Repeat, Calendar, Clock, Bell } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import { DIFFICULTY_LEVELS, RecurrencePattern } from '../../../types';
import type { CreateTaskRequest } from '../../../types';
import { ButtonLoader } from './LoadingSpinner';
import { createDefaultRecurrencePatterns, formatRecurrencePattern } from '../../../utils/recurringQuests';
import { QuickCreateQuest } from './QuickCreateQuest';
import { Activity } from 'lucide-react';
import { useHealthStore } from '../../../store/healthStore';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ReminderOption = 'none' | 'at_due' | '15m' | '1h' | '1d';

const REMINDER_OFFSET_MINUTES: Record<Exclude<ReminderOption, 'none'>, number> = {
  at_due: 0,
  '15m': 15,
  '1h': 60,
  '1d': 1440,
};

// SQLite CURRENT_TIMESTAMP-compatible UTC format ("YYYY-MM-DD HH:MM:SS").
const toSqliteUtc = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

// Workout verification (Settings → Health): optional requirement for fitness/health quests.
const VERIFY_WORKOUT_TYPES = [
  { value: 'any', label: 'Any workout' },
  { value: 'run', label: 'Run' },
  { value: 'strength', label: 'Strength' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'walk', label: 'Walk' },
  { value: 'other', label: 'Other' },
] as const;

const CreateTaskModal = ({ isOpen, onClose }: CreateTaskModalProps) => {
  const { createTask, updateEstimatedTime, scheduleNotification, user, tasks, projects, fetchProjects } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [reminderOption, setReminderOption] = useState<ReminderOption>('none');
  const [modalTab, setModalTab] = useState<'manual' | 'quick'>('quick');
  const [taskType, setTaskType] = useState<'standard' | 'goal' | 'recurring'>('standard');
  const [selectedRecurrencePattern, setSelectedRecurrencePattern] = useState<string>('daily');
  const [customRecurrence, setCustomRecurrence] = useState<RecurrencePattern>({
    frequency: 'daily',
    interval: 1
  });
  // Workout verification ('' = disabled) — only shown for fitness/health quests.
  const [verifyWorkoutType, setVerifyWorkoutType] = useState<string>('');
  const [verifyMinMinutes, setVerifyMinMinutes] = useState<string>('');
  const [formData, setFormData] = useState<CreateTaskRequest>({
    title: '',
    description: '',
    category: 'general',
    difficulty: 5,
    priority: 3,
    task_type: 'standard',
  });

  const defaultPatterns = createDefaultRecurrencePatterns();

  // Ensure projects are available for the assignment dropdown.
  useEffect(() => {
    if (isOpen && projects.all.length === 0 && !projects.loading) {
      fetchProjects();
    }
  }, [isOpen, projects.all.length, projects.loading, fetchProjects]);

  const activeProjects = projects.all.filter((p) => p.status === 'active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      const taskData: CreateTaskRequest = {
        ...formData,
        task_type: taskType,
        recurrence_pattern: taskType === 'recurring' 
          ? (selectedRecurrencePattern === 'custom' ? customRecurrence : defaultPatterns[selectedRecurrencePattern])
          : undefined
      };

      const createdTask = await createTask(taskData);

      // Persist the optional time estimate against the newly created task.
      const parsedEstimate = parseInt(estimatedMinutes, 10);
      if (createdTask?.id && !Number.isNaN(parsedEstimate) && parsedEstimate > 0) {
        try {
          await updateEstimatedTime(createdTask.id, parsedEstimate);
        } catch (estimateError) {
          console.error('Failed to set estimated time:', estimateError);
        }
      }

      // Schedule the optional due-date reminder for the new quest.
      if (createdTask?.id && formData.due_date && reminderOption !== 'none') {
        try {
          const dueDate = new Date(formData.due_date);
          const remindAt = new Date(dueDate.getTime() - REMINDER_OFFSET_MINUTES[reminderOption] * 60_000);
          if (!Number.isNaN(remindAt.getTime()) && remindAt.getTime() > Date.now()) {
            await scheduleNotification({
              task_id: createdTask.id,
              notification_type: 'due_soon',
              title: 'Quest Due Soon',
              message: reminderOption === 'at_due'
                ? `"${formData.title}" is due now`
                : `"${formData.title}" is due soon`,
              scheduled_for: toSqliteUtc(remindAt),
              priority: (formData.priority ?? 3) >= 4 ? 'high' : 'medium',
            });
          }
        } catch (reminderError) {
          console.error('Failed to schedule reminder:', reminderError);
        }
      }

      // Attach the optional workout-verification requirement (auto-completes with
      // bonus XP when a matching Apple Health workout is imported).
      const isFitnessCategory = formData.category === 'fitness' || formData.category === 'health';
      if (createdTask?.id && isFitnessCategory && verifyWorkoutType) {
        try {
          const parsedMinMinutes = parseInt(verifyMinMinutes, 10);
          await useHealthStore.getState().setTaskVerification(
            createdTask.id,
            verifyWorkoutType,
            !Number.isNaN(parsedMinMinutes) && parsedMinMinutes > 0 ? parsedMinMinutes : undefined
          );
        } catch (verifyError) {
          console.error('Failed to set workout verification:', verifyError);
        }
      }

      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        category: 'general',
        difficulty: 5,
        priority: 3,
        task_type: 'standard',
        project_id: undefined,
      });
      setEstimatedMinutes('');
      setReminderOption('none');
      setVerifyWorkoutType('');
      setVerifyMinMinutes('');
      setTaskType('standard');
      setSelectedRecurrencePattern('daily');
      setModalTab('quick');
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCreate = async (questData: any) => {
    setLoading(true);
    try {
      await createTask(questData);
      setModalTab('quick');
      onClose();
    } catch (error) {
      console.error('Failed to create quest:', error);
    } finally {
      setLoading(false);
    }
  };

  const difficultyInfo = DIFFICULTY_LEVELS[formData.difficulty as keyof typeof DIFFICULTY_LEVELS];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-solo-primary border border-gray-800 rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sword className="w-6 h-6 text-solo-accent" />
            New Quest
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-solo-bg rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-800">
          <button
            type="button"
            onClick={() => setModalTab('quick')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              modalTab === 'quick'
                ? 'text-theme-accent border-b-2 border-theme-accent bg-theme-accent/5'
                : 'text-gray-400 hover:text-theme-fg'
            }`}
          >
            Quick Create
          </button>
          <button
            type="button"
            onClick={() => setModalTab('manual')}
            className={`flex-1 px-6 py-3 font-medium transition-colors ${
              modalTab === 'manual'
                ? 'text-theme-accent border-b-2 border-theme-accent bg-theme-accent/5'
                : 'text-gray-400 hover:text-theme-fg'
            }`}
          >
            Custom Quest
          </button>
        </div>

        {/* Quick Create Tab */}
        {modalTab === 'quick' && (
          <div className="p-6">
            <QuickCreateQuest
              userLevel={user?.level || 1}
              completedTasks={tasks.completed}
              onCreateQuest={handleQuickCreate}
            />
          </div>
        )}

        {/* Manual Create Tab */}
        {modalTab === 'manual' && (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-2">
                  Quest Title *
                </label>
                <input
                  id="title"
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                  placeholder="e.g., Complete workout session"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent resize-none"
                  rows={3}
                  placeholder="Optional description..."
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium mb-2">
                  Category
                </label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                >
                  <option value="general">General</option>
                  <option value="fitness">Fitness</option>
                  <option value="learning">Learning</option>
                  <option value="work">Work</option>
                  <option value="health">Health</option>
                  <option value="social">Social</option>
                </select>
              </div>

              {/* Workout Verification (fitness/health quests only) */}
              {(formData.category === 'fitness' || formData.category === 'health') && (
                <div className="space-y-3 p-3 bg-solo-bg rounded-lg border border-gray-700">
                  <div className="text-sm font-medium text-solo-accent flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Verify with Workout (optional)
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor="verify-workout-type" className="block text-xs text-gray-400 mb-1">
                        Workout Type
                      </label>
                      <select
                        id="verify-workout-type"
                        value={verifyWorkoutType}
                        onChange={(e) => setVerifyWorkoutType(e.target.value)}
                        className="w-full px-3 py-2 bg-solo-primary border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                      >
                        <option value="">No verification</option>
                        {VERIFY_WORKOUT_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label htmlFor="verify-min-minutes" className="block text-xs text-gray-400 mb-1">
                        Min Minutes
                      </label>
                      <input
                        id="verify-min-minutes"
                        type="number"
                        min="1"
                        disabled={!verifyWorkoutType}
                        value={verifyMinMinutes}
                        onChange={(e) => setVerifyMinMinutes(e.target.value)}
                        className="w-full px-3 py-2 bg-solo-primary border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent disabled:opacity-50"
                        placeholder="e.g. 30"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Auto-completes with +50% bonus XP when a matching Apple Watch workout is
                    imported (set up in Settings → Health).
                  </div>
                </div>
              )}

              {/* Project */}
              {activeProjects.length > 0 && (
                <div>
                  <label htmlFor="project" className="block text-sm font-medium mb-2">
                    Project
                  </label>
                  <select
                    id="project"
                    value={formData.project_id ?? ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        project_id: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                  >
                    <option value="">No project</option>
                    {activeProjects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.icon} {project.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Task Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Quest Type
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTaskType('standard');
                      setFormData({ ...formData, task_type: 'standard', goal_target: undefined, goal_unit: undefined });
                    }}
                    className={`px-3 py-2 rounded-lg border transition-colors text-center ${
                      taskType === 'standard' 
                        ? 'bg-theme-accent/20 border-theme-accent text-theme-accent' 
                        : 'bg-theme-bg border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Sword className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs">Standard</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskType('goal');
                      setFormData({ ...formData, task_type: 'goal' });
                    }}
                    className={`px-3 py-2 rounded-lg border transition-colors text-center ${
                      taskType === 'goal' 
                        ? 'bg-theme-accent/20 border-theme-accent text-theme-accent' 
                        : 'bg-theme-bg border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Zap className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs">Goal-Based</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTaskType('recurring');
                      setFormData({ ...formData, task_type: 'recurring', goal_target: undefined, goal_unit: undefined });
                    }}
                    className={`px-3 py-2 rounded-lg border transition-colors text-center ${
                      taskType === 'recurring' 
                        ? 'bg-theme-accent/20 border-theme-accent text-theme-accent' 
                        : 'bg-theme-bg border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <Repeat className="w-4 h-4 mx-auto mb-1" />
                    <div className="text-xs">Recurring</div>
                  </button>
                </div>
              </div>

              {/* Goal Settings (only shown for goal-based tasks) */}
              {taskType === 'goal' && (
                <div className="space-y-3 p-3 bg-solo-bg rounded-lg border border-gray-700">
                  <div className="text-sm font-medium text-solo-accent">Goal Settings</div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor="goal-target" className="block text-xs text-gray-400 mb-1">
                        Target Amount *
                      </label>
                      <input
                        id="goal-target"
                        type="number"
                        min="1"
                        required={taskType === 'goal'}
                        value={formData.goal_target || ''}
                        onChange={(e) => setFormData({ ...formData, goal_target: parseInt(e.target.value) || undefined })}
                        className="w-full px-3 py-2 bg-solo-primary border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                        placeholder="100"
                      />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="goal-unit" className="block text-xs text-gray-400 mb-1">
                        Unit (e.g., pushups, calories)
                      </label>
                      <input
                        id="goal-unit"
                        type="text"
                        value={formData.goal_unit || ''}
                        onChange={(e) => setFormData({ ...formData, goal_unit: e.target.value })}
                        className="w-full px-3 py-2 bg-solo-primary border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                        placeholder="pushups"
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    Example: "100 pushups", "2000 calories", "10000 steps"
                  </div>
                </div>
              )}

              {/* Recurring Settings (only shown for recurring tasks) */}
              {taskType === 'recurring' && (
                <div className="space-y-3 p-3 bg-theme-bg rounded-lg border border-gray-700">
                  <div className="text-sm font-medium text-theme-accent flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Recurring Settings
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2">
                      Recurrence Pattern
                    </label>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {Object.entries(defaultPatterns).map(([key, pattern]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedRecurrencePattern(key)}
                          className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                            selectedRecurrencePattern === key
                              ? 'bg-theme-accent/20 border-theme-accent text-theme-accent'
                              : 'bg-theme-primary border-gray-700 hover:border-gray-600'
                          }`}
                        >
                          <div className="text-sm font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                          <div className="text-xs text-gray-400">{formatRecurrencePattern(pattern)}</div>
                        </button>
                      ))}
                    </div>
                    
                    {/* Custom Pattern Option */}
                    <button
                      type="button"
                      onClick={() => setSelectedRecurrencePattern('custom')}
                      className={`w-full px-3 py-2 rounded-lg border text-left transition-colors ${
                        selectedRecurrencePattern === 'custom'
                          ? 'bg-theme-accent/20 border-theme-accent text-theme-accent'
                          : 'bg-theme-primary border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-sm font-medium">Custom Pattern</div>
                      <div className="text-xs text-gray-400">Set your own schedule</div>
                    </button>
                    
                    {/* Custom Pattern Settings */}
                    {selectedRecurrencePattern === 'custom' && (
                      <div className="mt-3 space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Frequency</label>
                            <select
                              value={customRecurrence.frequency}
                              onChange={(e) => setCustomRecurrence({
                                ...customRecurrence,
                                frequency: e.target.value as RecurrencePattern['frequency']
                              })}
                              className="w-full px-3 py-2 bg-theme-primary border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs text-gray-400 mb-1">Every X {customRecurrence.frequency === 'daily' ? 'days' : customRecurrence.frequency === 'weekly' ? 'weeks' : 'months'}</label>
                            <input
                              type="number"
                              min="1"
                              value={customRecurrence.interval}
                              onChange={(e) => setCustomRecurrence({
                                ...customRecurrence,
                                interval: parseInt(e.target.value) || 1
                              })}
                              className="w-full px-3 py-2 bg-theme-primary border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Recurring quests help build consistent habits and award streak bonuses!
                  </div>
                </div>
              )}

              {/* Difficulty */}
              <div>
                <label htmlFor="difficulty" className="block text-sm font-medium mb-2">
                  Difficulty Level: <span className={difficultyInfo.color}>{difficultyInfo.label}</span>
                </label>
                <input
                  id="difficulty"
                  type="range"
                  min="1"
                  max="10"
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Trivial</span>
                  <span>Legendary</span>
                </div>
                <div className="text-sm text-gray-400 mt-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4" />
                    <span>XP: {difficultyInfo.xp}</span>
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label htmlFor="priority" className="block text-sm font-medium mb-2">
                  Priority: {formData.priority}/5
                </label>
                <input
                  id="priority"
                  type="range"
                  min="1"
                  max="5"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Low</span>
                  <span>Critical</span>
                </div>
              </div>

              {/* Estimated Time */}
              <div>
                <label htmlFor="estimated-time" className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-solo-accent" />
                  Estimated Time (minutes)
                </label>
                <input
                  id="estimated-time"
                  type="number"
                  min="1"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                  placeholder="Optional, e.g. 30"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Track how long you expect this quest to take. Compare against actual time later.
                </div>
              </div>

              {/* Due Date & Reminder */}
              <div>
                <label htmlFor="due-date" className="block text-sm font-medium mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-solo-accent" />
                  Due Date
                </label>
                <input
                  id="due-date"
                  type="datetime-local"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value || undefined })}
                  className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                />
                <div className="mt-3">
                  <label htmlFor="reminder" className="block text-sm font-medium mb-2 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-solo-accent" />
                    Remind Me
                  </label>
                  <select
                    id="reminder"
                    value={reminderOption}
                    disabled={!formData.due_date}
                    onChange={(e) => setReminderOption(e.target.value as ReminderOption)}
                    className="w-full px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent disabled:opacity-50"
                  >
                    <option value="none">No reminder</option>
                    <option value="at_due">At due time</option>
                    <option value="15m">15 minutes before</option>
                    <option value="1h">1 hour before</option>
                    <option value="1d">1 day before</option>
                  </select>
                  {!formData.due_date && (
                    <div className="text-xs text-gray-400 mt-1">
                      Set a due date to enable reminders.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons - Fixed at bottom */}
            <div className="flex gap-3 p-6 border-t border-gray-800 bg-solo-primary">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-700 rounded-lg hover:bg-solo-bg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !formData.title.trim()}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center"
              >
                {loading && <ButtonLoader />}
                {loading ? 'Creating...' : 'Create Quest'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CreateTaskModal;