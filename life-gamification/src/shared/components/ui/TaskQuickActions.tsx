import { useState } from 'react'
import {
  Zap,
  Clock,
  Calendar,
  Star,
  Repeat,
  Target,
  Filter,
  TrendingUp,
  Award,
  BookOpen,
  CheckSquare2,
  Plus,
  ArrowRight,
  Timer,
  AlertTriangle,
  Sparkles
} from 'lucide-react'
import { useGameStore } from '../../../store/gameStore'
import { useToast } from './Toast'
import { FadeIn } from './AnimatedComponents'
import type { Task } from '../../../types'

interface TaskQuickActionsProps {
  onQuickCreate: (template: Partial<Task>) => void
  className?: string
}

interface QuickAction {
  id: string
  name: string
  description: string
  icon: any
  color: string
  bgColor: string
  action: () => void
}

interface TaskTemplate {
  id: string
  name: string
  description: string
  icon: any
  color: string
  template: Partial<Task>
}

const TaskQuickActions = ({ onQuickCreate, className = '' }: TaskQuickActionsProps) => {
  const [activeView, setActiveView] = useState<'actions' | 'templates'>('actions')
  const { tasks, user } = useGameStore()
  const toast = useToast()

  // Quick action templates for common tasks
  const taskTemplates: TaskTemplate[] = [
    {
      id: 'daily-workout',
      name: '💪 Daily Workout',
      description: '30-minute exercise session',
      icon: Target,
      color: 'text-red-400',
      template: {
        title: 'Daily Workout Session',
        description: 'Complete a 30-minute workout to stay healthy and energized',
        category: 'health',
        difficulty: 'medium',
        task_type: 'simple',
        base_experience_reward: 50,
        gold_reward: 25,
        tags: ['health', 'fitness', 'daily'],
        priority: 'medium'
      }
    },
    {
      id: 'read-book',
      name: '📚 Reading Session',
      description: 'Read for 30 minutes',
      icon: BookOpen,
      color: 'text-blue-400',
      template: {
        title: 'Reading Session',
        description: 'Read for 30 minutes to expand knowledge and relax',
        category: 'learning',
        difficulty: 'easy',
        task_type: 'simple',
        base_experience_reward: 30,
        gold_reward: 15,
        tags: ['learning', 'books', 'knowledge'],
        priority: 'low'
      }
    },
    {
      id: 'coding-practice',
      name: '💻 Coding Practice',
      description: '1 hour coding session',
      icon: Zap,
      color: 'text-purple-400',
      template: {
        title: 'Coding Practice Session',
        description: 'Practice coding skills for 1 hour',
        category: 'work',
        difficulty: 'hard',
        task_type: 'simple',
        base_experience_reward: 80,
        gold_reward: 40,
        tags: ['coding', 'practice', 'skills'],
        priority: 'high'
      }
    },
    {
      id: 'meditation',
      name: '🧘 Meditation',
      description: '15-minute mindfulness session',
      icon: Sparkles,
      color: 'text-green-400',
      template: {
        title: 'Meditation Session',
        description: '15 minutes of mindfulness and relaxation',
        category: 'wellness',
        difficulty: 'easy',
        task_type: 'simple',
        base_experience_reward: 25,
        gold_reward: 12,
        tags: ['mindfulness', 'wellness', 'meditation'],
        priority: 'medium'
      }
    },
    {
      id: 'water-goal',
      name: '💧 Daily Hydration',
      description: 'Drink 8 glasses of water',
      icon: Target,
      color: 'text-cyan-400',
      template: {
        title: 'Daily Hydration Goal',
        description: 'Stay hydrated by drinking 8 glasses of water',
        category: 'health',
        difficulty: 'easy',
        task_type: 'goal',
        goal_target: 8,
        goal_unit: 'glasses',
        goal_current: 0,
        base_experience_reward: 40,
        gold_reward: 20,
        tags: ['health', 'hydration', 'daily'],
        priority: 'medium'
      }
    },
    {
      id: 'learning-streak',
      name: '🎯 Learning Streak',
      description: 'Daily learning habit',
      icon: TrendingUp,
      color: 'text-orange-400',
      template: {
        title: 'Learning Streak',
        description: 'Maintain daily learning habit',
        category: 'learning',
        difficulty: 'medium',
        task_type: 'recurring',
        recurrence_pattern: 'daily',
        base_experience_reward: 60,
        gold_reward: 30,
        tags: ['learning', 'streak', 'habit'],
        priority: 'high'
      }
    }
  ]

  // Smart quick actions based on user data
  const quickActions: QuickAction[] = [
    {
      id: 'complete-overdue',
      name: 'Complete Overdue Tasks',
      description: 'Bulk complete overdue tasks',
      icon: AlertTriangle,
      color: 'text-red-400',
      bgColor: 'bg-red-500/20',
      action: () => {
        const overdueTasks = tasks.active.filter(task => 
          task.due_date && new Date(task.due_date) < new Date()
        )
        if (overdueTasks.length === 0) {
          toast.info('No overdue tasks', 'All your tasks are up to date!')
        } else {
          toast.info(`${overdueTasks.length} overdue tasks found`, 'Consider completing or rescheduling them')
        }
      }
    },
    {
      id: 'daily-goals',
      name: 'Set Daily Goals',
      description: 'Create 3 goals for today',
      icon: Calendar,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/20',
      action: () => {
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        
        for (let i = 1; i <= 3; i++) {
          onQuickCreate({
            title: `Daily Goal ${i}`,
            description: 'Set and achieve your daily goal',
            category: 'personal',
            difficulty: 'medium',
            due_date: today.toISOString(),
            base_experience_reward: 40,
            gold_reward: 20
          })
        }
        
        toast.success('Daily goals created!', '3 goal templates have been added')
      }
    },
    {
      id: 'pomodoro-session',
      name: 'Pomodoro Session',
      description: 'Start focused work session',
      icon: Timer,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
      action: () => {
        onQuickCreate({
          title: 'Pomodoro Focus Session',
          description: '25-minute focused work session',
          category: 'productivity',
          difficulty: 'medium',
          base_experience_reward: 50,
          gold_reward: 25,
          tags: ['pomodoro', 'focus', 'productivity']
        })
        
        toast.success('Pomodoro session created!', 'Time to focus for 25 minutes')
      }
    },
    {
      id: 'habit-builder',
      name: 'Build New Habit',
      description: 'Create recurring habit task',
      icon: Repeat,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
      action: () => {
        onQuickCreate({
          title: 'New Daily Habit',
          description: 'Build a new positive habit',
          category: 'personal',
          difficulty: 'easy',
          task_type: 'recurring',
          recurrence_pattern: 'daily',
          base_experience_reward: 35,
          gold_reward: 18,
          tags: ['habit', 'recurring', 'self-improvement']
        })
        
        toast.success('Habit template created!', 'Start building your new habit today')
      }
    },
    {
      id: 'skill-challenge',
      name: 'Skill Challenge',
      description: 'Weekly skill improvement',
      icon: Award,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
      action: () => {
        const nextWeek = new Date()
        nextWeek.setDate(nextWeek.getDate() + 7)
        
        onQuickCreate({
          title: 'Weekly Skill Challenge',
          description: 'Dedicated time to improve a specific skill',
          category: 'learning',
          difficulty: 'hard',
          due_date: nextWeek.toISOString(),
          base_experience_reward: 100,
          gold_reward: 50,
          tags: ['skill', 'challenge', 'improvement']
        })
        
        toast.success('Skill challenge created!', 'Level up your skills this week')
      }
    },
    {
      id: 'quick-win',
      name: 'Quick Win',
      description: '5-minute easy task',
      icon: Zap,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
      action: () => {
        onQuickCreate({
          title: 'Quick Win Task',
          description: 'A simple 5-minute task for instant satisfaction',
          category: 'personal',
          difficulty: 'easy',
          base_experience_reward: 20,
          gold_reward: 10,
          tags: ['quick', 'easy', 'win']
        })
        
        toast.success('Quick win created!', 'Get that instant satisfaction')
      }
    }
  ]

  // Stats for motivation
  const stats = {
    totalTasks: tasks.active.length + tasks.completed.length,
    completedTasks: tasks.completed.length,
    activeStreak: user?.current_streak || 0,
    totalXP: user?.experience || 0
  }

  const completionRate = stats.totalTasks > 0 ? 
    Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Stats */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Task Dashboard</h2>
            <p className="text-gray-400">Quick actions and templates to boost productivity</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-theme-accent">{completionRate}%</div>
            <div className="text-sm text-gray-400">Completion Rate</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-theme-bg rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{stats.activeStreak}</div>
            <div className="text-sm text-gray-400">Day Streak</div>
          </div>
          <div className="bg-theme-bg rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.completedTasks}</div>
            <div className="text-sm text-gray-400">Completed</div>
          </div>
          <div className="bg-theme-bg rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.totalXP.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Total XP</div>
          </div>
          <div className="bg-theme-bg rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{tasks.active.length}</div>
            <div className="text-sm text-gray-400">Active</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-4">
        <button
          onClick={() => setActiveView('actions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'actions'
              ? 'bg-theme-accent/20 text-theme-accent border border-theme-accent/30'
              : 'text-gray-400 hover:text-theme-fg'
          }`}
        >
          <Zap className="w-4 h-4" />
          Quick Actions
        </button>
        <button
          onClick={() => setActiveView('templates')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeView === 'templates'
              ? 'bg-theme-accent/20 text-theme-accent border border-theme-accent/30'
              : 'text-gray-400 hover:text-theme-fg'
          }`}
        >
          <CheckSquare2 className="w-4 h-4" />
          Task Templates
        </button>
      </div>

      {/* Quick Actions View */}
      {activeView === 'actions' && (
        <FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.id}
                  onClick={action.action}
                  className={`${action.bgColor} border border-gray-700 rounded-lg p-4 text-left transition-all duration-200 hover:scale-105 hover:border-gray-600 hover:shadow-lg`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg bg-black/20`}>
                      <Icon className={`w-5 h-5 ${action.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{action.name}</h3>
                      <p className="text-sm text-gray-400">{action.description}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              )
            })}
          </div>
        </FadeIn>
      )}

      {/* Task Templates View */}
      {activeView === 'templates' && (
        <FadeIn>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-gray-400">Choose from pre-made task templates to get started quickly</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {taskTemplates.map((template) => {
                const Icon = template.icon
                return (
                  <button
                    key={template.id}
                    onClick={() => {
                      onQuickCreate(template.template)
                      toast.success('Template added!', `${template.name} has been created`)
                    }}
                    className="bg-theme-primary border border-gray-800 rounded-lg p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:border-gray-700 hover:shadow-lg"
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{template.name.split(' ')[0]}</div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 flex items-center gap-2">
                          {template.name.split(' ').slice(1).join(' ')}
                          <Icon className={`w-4 h-4 ${template.color}`} />
                        </h3>
                        <p className="text-sm text-gray-400 mb-3">{template.description}</p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span className="capitalize">{template.template.category}</span>
                          <span className="capitalize">{template.template.difficulty}</span>
                          <span>{template.template.base_experience_reward} XP</span>
                          {template.template.task_type === 'goal' && (
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">Goal</span>
                          )}
                          {template.template.task_type === 'recurring' && (
                            <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">Recurring</span>
                          )}
                        </div>
                      </div>
                      <Plus className="w-4 h-4 text-theme-accent" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}

export default TaskQuickActions