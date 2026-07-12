import { useState } from 'react'
import { 
  Palette, 
  Monitor, 
  Bell, 
  Zap, 
  Eye, 
  Settings, 
  Calendar, 
  CheckSquare, 
  Code,
  Sliders,
  Download,
  Upload,
  RotateCcw,
  Volume2
} from 'lucide-react'
import { usePreferencesStore } from '../../../store/preferencesStore'
import { useTheme } from '../../../contexts/ThemeContext'
import { useToast } from './Toast'
import { FadeIn } from './AnimatedComponents'
import SoundSettings from './SoundSettings'

interface AdvancedPreferencesPanelProps {
  className?: string
}

const AdvancedPreferencesPanel = ({ className = '' }: AdvancedPreferencesPanelProps) => {
  const [activeSection, setActiveSection] = useState('theme')
  const toast = useToast()
  const { currentTheme, setTheme, availableThemes } = useTheme()
  
  const {
    theme,
    ui,
    notifications,
    gamification,
    accessibility,
    performance,
    calendar,
    tasks,
    advanced,
    updateTheme,
    updateUI,
    updateNotifications,
    updateGamification,
    updateAccessibility,
    updatePerformance,
    updateCalendar,
    updateTasks,
    updateAdvanced,
    resetToDefaults,
    exportPreferences,
    importPreferences
  } = usePreferencesStore()

  const sections = [
    { id: 'theme', label: 'Theme & Visual', icon: Palette, color: 'text-purple-400' },
    { id: 'ui', label: 'Interface', icon: Monitor, color: 'text-blue-400' },
    { id: 'audio', label: 'Audio & Sound', icon: Volume2, color: 'text-indigo-400' },
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-green-400' },
    { id: 'gamification', label: 'Gamification', icon: Zap, color: 'text-yellow-400' },
    { id: 'accessibility', label: 'Accessibility', icon: Eye, color: 'text-orange-400' },
    { id: 'performance', label: 'Performance', icon: Settings, color: 'text-red-400' },
    { id: 'calendar', label: 'Calendar', icon: Calendar, color: 'text-pink-400' },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, color: 'text-emerald-400' },
    { id: 'advanced', label: 'Advanced', icon: Code, color: 'text-gray-400' }
  ]

  const handleExportPreferences = () => {
    try {
      const prefsJson = exportPreferences()
      const blob = new Blob([prefsJson], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = url
      link.download = `life-gamification-preferences-${new Date().toISOString().slice(0, 19)}.json`
      link.click()
      
      URL.revokeObjectURL(url)
      toast.success('Preferences Exported! 📁', 'Your preferences have been downloaded')
    } catch (error) {
      toast.error('Export Failed', 'Could not export preferences')
    }
  }

  const handleImportPreferences = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        if (importPreferences(content)) {
          toast.success('Preferences Imported! ✨', 'Your preferences have been restored')
        } else {
          toast.error('Import Failed', 'Invalid preferences file or format')
        }
      } catch (error) {
        toast.error('Import Failed', 'Could not read preferences file')
      }
    }
    reader.readAsText(file)
  }

  const handleResetDefaults = () => {
    if (confirm('Are you sure you want to reset all preferences to defaults? This cannot be undone.')) {
      resetToDefaults()
      toast.success('Reset Complete! 🔄', 'All preferences have been reset to defaults')
    }
  }

  const renderThemeSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Theme Selection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {availableThemes.map((themeOption) => (
            <div
              key={themeOption.id}
              onClick={() => {
                setTheme(themeOption.id)
                updateTheme({ id: themeOption.id })
                toast.success('Theme Changed! 🎨', `Switched to ${themeOption.name}`)
              }}
              className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                currentTheme.id === themeOption.id
                  ? 'border-theme-accent/50 bg-theme-accent/10'
                  : 'border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex gap-1">
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: `rgb(${themeOption.colors.accent})` }}
                  />
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: `rgb(${themeOption.colors.primary})` }}
                  />
                  <div 
                    className="w-4 h-4 rounded-full border"
                    style={{ backgroundColor: `rgb(${themeOption.colors.secondary})` }}
                  />
                </div>
                {currentTheme.id === themeOption.id && (
                  <div className="text-theme-accent text-sm font-medium">Active</div>
                )}
              </div>
              
              <h4 className="font-semibold mb-1">{themeOption.name}</h4>
              <p className="text-sm text-gray-400">{themeOption.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Theme Options</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">High Contrast</label>
              <p className="text-sm text-gray-400">Enhanced color contrast for accessibility</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={theme.highContrast || false}
                onChange={(e) => updateTheme({ highContrast: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderUISection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Animation & Motion</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Enable Animations</label>
              <p className="text-sm text-gray-400">Smooth transitions and effects</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={ui.animations}
                onChange={(e) => updateUI({ animations: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Reduced Motion</label>
              <p className="text-sm text-gray-400">Minimize motion for sensitive users</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={ui.reducedMotion}
                onChange={(e) => updateUI({ reducedMotion: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Layout Options</h3>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Grid Density</label>
            <select 
              value={ui.gridDensity}
              onChange={(e) => updateUI({ gridDensity: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="comfortable">Comfortable</option>
            </select>
          </div>
          
          <div>
            <label className="block font-medium mb-2">Card Style</label>
            <select 
              value={ui.cardStyle}
              onChange={(e) => updateUI({ cardStyle: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="elevated">Elevated</option>
              <option value="outlined">Outlined</option>
              <option value="filled">Filled</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationsSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Notification Types</h3>
        <div className="space-y-4">
          {[
            { key: 'achievements', label: 'Achievement Unlocks', desc: 'When you unlock new achievements' },
            { key: 'levelUps', label: 'Level Up Celebrations', desc: 'When you gain a level' },
            { key: 'taskReminders', label: 'Task Reminders', desc: 'Reminders for upcoming tasks' },
            { key: 'questComplete', label: 'Quest Completions', desc: 'When you complete quests' }
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <label className="font-medium">{label}</label>
                <p className="text-sm text-gray-400">{desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={notifications[key as keyof typeof notifications] as boolean}
                  onChange={(e) => updateNotifications({ [key]: e.target.checked })}
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Notification Behavior</h3>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Position</label>
            <select 
              value={notifications.position}
              onChange={(e) => updateNotifications({ position: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="top-right">Top Right</option>
              <option value="top-left">Top Left</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="center">Center</option>
            </select>
          </div>
          
          <div>
            <label className="block font-medium mb-2">Duration (seconds)</label>
            <input 
              type="range"
              min="2"
              max="10"
              step="1"
              value={notifications.duration / 1000}
              onChange={(e) => updateNotifications({ duration: parseInt(e.target.value) * 1000 })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-1">
              <span>2s</span>
              <span>{notifications.duration / 1000}s</span>
              <span>10s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAccessibilitySection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Visual Accessibility</h3>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Font Size ({accessibility.fontSize}%)</label>
            <input 
              type="range"
              min="75"
              max="150"
              step="5"
              value={accessibility.fontSize}
              onChange={(e) => updateAccessibility({ fontSize: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-1">
              <span>75%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
          </div>
          
          <div>
            <label className="block font-medium mb-2">Line Height</label>
            <input 
              type="range"
              min="1.2"
              max="2.0"
              step="0.1"
              value={accessibility.lineHeight}
              onChange={(e) => updateAccessibility({ lineHeight: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-1">
              <span>1.2</span>
              <span>{accessibility.lineHeight}</span>
              <span>2.0</span>
            </div>
          </div>
          
          <div>
            <label className="block font-medium mb-2">Color Blindness Support</label>
            <select 
              value={accessibility.colorBlindnessSupport}
              onChange={(e) => updateAccessibility({ colorBlindnessSupport: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="none">None</option>
              <option value="protanopia">Protanopia (Red-blind)</option>
              <option value="deuteranopia">Deuteranopia (Green-blind)</option>
              <option value="tritanopia">Tritanopia (Blue-blind)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderGamificationSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">XP & Levels</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Show XP Numbers</label>
              <p className="text-sm text-gray-400">Display exact XP amounts</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={gamification.showXPNumbers}
                onChange={(e) => updateGamification({ showXPNumbers: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Show Level Progress</label>
              <p className="text-sm text-gray-400">Display progress bars for leveling</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={gamification.showLevelProgress}
                onChange={(e) => updateGamification({ showLevelProgress: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>

          <div>
            <label className="block font-medium mb-2">Celebration Intensity</label>
            <select 
              value={gamification.celebrationIntensity}
              onChange={(e) => updateGamification({ celebrationIntensity: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="minimal">Minimal</option>
              <option value="standard">Standard</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderPerformanceSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Data & Analytics</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Enable Analytics</label>
              <p className="text-sm text-gray-400">Anonymous usage statistics</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={performance.enableAnalytics}
                onChange={(e) => updatePerformance({ enableAnalytics: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Auto Save</label>
              <p className="text-sm text-gray-400">Automatically save progress</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={performance.autoSave}
                onChange={(e) => updatePerformance({ autoSave: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>

          <div>
            <label className="block font-medium mb-2">Auto Save Interval (minutes)</label>
            <input 
              type="range"
              min="1"
              max="30"
              step="1"
              value={performance.autoSaveInterval}
              onChange={(e) => updatePerformance({ autoSaveInterval: parseInt(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-400 mt-1">
              <span>1 min</span>
              <span>{performance.autoSaveInterval} min</span>
              <span>30 min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderCalendarSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Calendar Settings</h3>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Week Starts On</label>
            <select 
              value={calendar.weekStartsOn}
              onChange={(e) => updateCalendar({ weekStartsOn: parseInt(e.target.value) as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value={0}>Sunday</option>
              <option value={1}>Monday</option>
            </select>
          </div>
          
          <div>
            <label className="block font-medium mb-2">Time Format</label>
            <select 
              value={calendar.timeFormat}
              onChange={(e) => updateCalendar({ timeFormat: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="12h">12 Hour</option>
              <option value="24h">24 Hour</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-2">Default View</label>
            <select 
              value={calendar.defaultView}
              onChange={(e) => updateCalendar({ defaultView: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
              <option value="day">Day</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Show Week Numbers</label>
              <p className="text-sm text-gray-400">Display week numbers in calendar</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={calendar.showWeekNumbers}
                onChange={(e) => updateCalendar({ showWeekNumbers: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderTasksSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Task Management</h3>
        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-2">Default Difficulty</label>
            <select 
              value={tasks.defaultDifficulty}
              onChange={(e) => updateTasks({ defaultDifficulty: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
              <option value="expert">Expert</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-2">Sort By</label>
            <select 
              value={tasks.sortBy}
              onChange={(e) => updateTasks({ sortBy: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="created">Created Date</option>
              <option value="due">Due Date</option>
              <option value="priority">Priority</option>
              <option value="difficulty">Difficulty</option>
            </select>
          </div>

          <div>
            <label className="block font-medium mb-2">Group By</label>
            <select 
              value={tasks.groupBy}
              onChange={(e) => updateTasks({ groupBy: e.target.value as any })}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            >
              <option value="none">None</option>
              <option value="status">Status</option>
              <option value="difficulty">Difficulty</option>
              <option value="tags">Tags</option>
              <option value="date">Date</option>
            </select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Auto-archive Completed</label>
              <p className="text-sm text-gray-400">Automatically archive completed tasks</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={tasks.autoArchiveCompleted}
                onChange={(e) => updateTasks({ autoArchiveCompleted: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderAdvancedSection = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Developer Options</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Developer Mode</label>
              <p className="text-sm text-gray-400">Enable developer tools and debug info</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={advanced.developerMode}
                onChange={(e) => updateAdvanced({ developerMode: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Experimental Features</label>
              <p className="text-sm text-gray-400">Enable experimental features (may be unstable)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={advanced.experimentalFeatures}
                onChange={(e) => updateAdvanced({ experimentalFeatures: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Verbose Logging</label>
              <p className="text-sm text-gray-400">Enable detailed console logging</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={advanced.verboseLogging}
                onChange={(e) => updateAdvanced({ verboseLogging: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Layout Debugger</label>
              <p className="text-sm text-gray-400">Show layout debugging overlay (dev mode only)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={advanced.showLayoutDebugger}
                onChange={(e) => updateAdvanced({ showLayoutDebugger: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="font-medium">Visual Effects Test Panel</label>
              <p className="text-sm text-gray-400">Show effects test panel (dev mode only)</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={advanced.showEffectsPanel}
                onChange={(e) => updateAdvanced({ showEffectsPanel: e.target.checked })}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const getCurrentSectionContent = () => {
    switch (activeSection) {
      case 'theme': return renderThemeSection()
      case 'ui': return renderUISection()
      case 'audio': return <SoundSettings />
      case 'notifications': return renderNotificationsSection()
      case 'gamification': return renderGamificationSection()
      case 'accessibility': return renderAccessibilitySection()
      case 'performance': return renderPerformanceSection()
      case 'calendar': return renderCalendarSection()
      case 'tasks': return renderTasksSection()
      case 'advanced': return renderAdvancedSection()
      default:
        return (
          <div className="text-center py-12 text-gray-400">
            <Sliders className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Settings for {sections.find(s => s.id === activeSection)?.label} coming soon!</p>
          </div>
        )
    }
  }

  return (
    <div className={`bg-theme-primary rounded-lg border border-gray-800 ${className}`}>
      <div className="flex h-[600px]">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-theme-bg border-r border-gray-800 p-4">
          <div className="space-y-1">
            {sections.map((section) => {
              const Icon = section.icon
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    activeSection === section.id
                      ? 'bg-theme-accent/20 text-theme-accent border border-theme-accent/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${section.color}`} />
                  <span className="text-sm font-medium">{section.label}</span>
                </button>
              )
            })}
          </div>
          
          {/* Action Buttons */}
          <div className="mt-8 pt-4 border-t border-gray-700 space-y-2">
            <button
              onClick={handleExportPreferences}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-green-400 hover:bg-green-500/20 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            
            <label className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImportPreferences}
                className="hidden"
              />
            </label>
            
            <button
              onClick={handleResetDefaults}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">
              {sections.find(s => s.id === activeSection)?.label} Settings
            </h2>
            <p className="text-gray-400 text-sm">
              Customize your {sections.find(s => s.id === activeSection)?.label.toLowerCase()} preferences
            </p>
          </div>
          
          <FadeIn key={activeSection}>
            {getCurrentSectionContent()}
          </FadeIn>
        </div>
      </div>
    </div>
  )
}

export default AdvancedPreferencesPanel