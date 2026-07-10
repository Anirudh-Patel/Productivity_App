import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Palette, User, Bell, Shield, Monitor, Database, Github, Calendar as CalendarIcon, RefreshCw, Link } from 'lucide-react';
import GithubSettingsPanel from '../../shared/components/ui/GithubSettingsPanel';
import { Activity, ListChecks } from 'lucide-react';
import HealthSettingsPanel from '../../shared/components/ui/HealthSettingsPanel';
import { Inbox } from 'lucide-react';
import CaptureSettingsPanel from '../../shared/components/ui/CaptureSettingsPanel';
import RemindersSettingsPanel from '../../shared/components/ui/RemindersSettingsPanel';
import { useTheme } from '../../contexts/ThemeContext';
import { useGameStore } from '../../store/gameStore';
import { useCalendarStore } from '../../store/calendarStore';
import { useRenderPerformance } from '../../utils/performance';
import { FadeIn } from '../../shared/components/ui/AnimatedComponents';
import { AvatarSelector } from '../../shared/components/ui/AvatarSelector';
import DataExportModal from '../../shared/components/ui/DataExportModal';
import AdvancedPreferencesPanel from '../../shared/components/ui/AdvancedPreferencesPanel';
import NotificationSettingsPanel from '../../shared/components/ui/NotificationSettingsPanel';

const Settings = () => {
  useRenderPerformance('Settings', process.env.NODE_ENV === 'development');
  
  const { currentTheme, setTheme, availableThemes } = useTheme();
  const { user } = useGameStore();
  const [activeSection, setActiveSection] = useState('appearance');
  const [selectedAvatar, setSelectedAvatar] = useState('hunter-1');
  const [isDataExportModalOpen, setIsDataExportModalOpen] = useState(false);

  // Calendar (macOS Calendar.app) two-way sync settings
  const {
    appleCalendarConnected,
    appleCalendars,
    importRules,
    connectAppleCalendar,
    fetchAppleCalendars,
    fetchImportRules,
    setImportRule,
    runAutoImport,
  } = useCalendarStore();
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<string | null>(null);

  useEffect(() => {
    if (activeSection !== 'calendar' || !appleCalendarConnected) return;
    fetchAppleCalendars().catch(() => {});
    fetchImportRules().catch(() => {});
  }, [activeSection, appleCalendarConnected, fetchAppleCalendars, fetchImportRules]);

  const handleCalendarConnect = async () => {
    setCalendarBusy(true);
    setCalendarStatus(null);
    try {
      await connectAppleCalendar();
      await fetchImportRules().catch(() => {});
      setCalendarStatus('Connected to Calendar.app');
    } catch {
      setCalendarStatus('Could not access Calendar.app — check System Settings > Privacy & Security > Automation.');
    } finally {
      setCalendarBusy(false);
    }
  };

  const handleImportNow = async () => {
    setCalendarBusy(true);
    setCalendarStatus(null);
    try {
      const imported = await runAutoImport();
      setCalendarStatus(
        imported > 0
          ? `Imported ${imported} event${imported === 1 ? '' : 's'} as quests.`
          : 'No new events to import (enable a calendar below first).'
      );
    } catch {
      setCalendarStatus('Import failed — is Calendar.app accessible?');
    } finally {
      setCalendarBusy(false);
    }
  };

  const sections = [
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'data', label: 'Data Management', icon: Database },
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'health', label: 'Health', icon: Activity },
    { id: 'capture', label: 'Quick Capture', icon: Inbox },
    { id: 'reminders', label: 'Reminders', icon: ListChecks },
    { id: 'preferences', label: 'Preferences', icon: Monitor },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
    { id: 'advanced', label: 'Advanced', icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-gray-400">Customize your experience</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <FadeIn delay={0}>
          <div className="bg-theme-primary rounded-lg border border-gray-800 p-4">
            <h3 className="font-semibold mb-4">Categories</h3>
            <nav className="space-y-2">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-solo-accent/20 text-theme-accent border border-theme-accent/30'
                        : 'text-gray-400 hover:text-theme-fg hover:bg-theme-bg'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </FadeIn>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          {activeSection === 'appearance' && (
            <FadeIn delay={100}>
              <div className="space-y-6">
                {/* Theme Selection */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Theme Selection
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Choose your preferred anime/manhwa theme
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableThemes.map((theme) => (
                      <div
                        key={theme.id}
                        onClick={() => setTheme(theme.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:scale-105 ${
                          currentTheme.id === theme.id
                            ? 'border-theme-accent/50 bg-solo-accent/10'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {/* Theme Preview */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className="flex gap-1">
                            <div 
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: `rgb(${theme.colors.accent})` }}
                            />
                            <div 
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: `rgb(${theme.colors.primary})` }}
                            />
                            <div 
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: `rgb(${theme.colors.secondary})` }}
                            />
                          </div>
                          {currentTheme.id === theme.id && (
                            <div className="text-theme-accent text-sm font-medium">Active</div>
                          )}
                        </div>
                        
                        <h4 className="font-semibold mb-1">{theme.name}</h4>
                        <p className="text-sm text-gray-400">{theme.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Theme Customization */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4">Customization</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Animations</p>
                        <p className="text-sm text-gray-400">Enable smooth transitions and effects</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-solo-accent"></div>
                      </label>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Reduced Motion</p>
                        <p className="text-sm text-gray-400">Minimize animations for better performance</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-solo-accent"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Profile Section */}
          {activeSection === 'profile' && (
            <FadeIn delay={100}>
              <div className="space-y-6">
                {/* User Info */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Profile Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Username</label>
                        <input
                          type="text"
                          defaultValue={user?.username || 'Shadow Warrior'}
                          className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Level</label>
                        <div className="px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg text-gray-400">
                          {user?.level || 1} (Read-only)
                        </div>
                      </div>
                    </div>
                    
                    {/* Current Avatar Display */}
                    <div className="flex flex-col items-center">
                      <div className="w-24 h-24 bg-solo-accent/20 rounded-full flex items-center justify-center text-4xl border-2 border-theme-accent/30 mb-3">
                        🗡️
                      </div>
                      <p className="text-sm text-gray-400">Current Avatar</p>
                      <p className="text-xs text-gray-500">Shadow Hunter</p>
                    </div>
                  </div>
                </div>

                {/* Avatar Selection */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4">Character Avatar</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Choose your character avatar. Unlock new avatars by leveling up!
                  </p>
                  
                  <AvatarSelector
                    currentTheme={currentTheme.id}
                    userLevel={user?.level || 1}
                    selectedAvatar={selectedAvatar}
                    onAvatarSelect={setSelectedAvatar}
                  />
                </div>
              </div>
            </FadeIn>
          )}

          {/* Calendar Section */}
          {activeSection === 'calendar' && (
            <FadeIn delay={100}>
              <div className="space-y-6">
                {/* Connection */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5" />
                    Apple Calendar (Calendar.app)
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Two-way sync with macOS Calendar.app. All calendars added there (iCloud, Google, ...)
                    become available — no API keys needed. The first connection triggers a one-time macOS
                    permission prompt.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleCalendarConnect}
                      disabled={calendarBusy}
                      className="px-4 py-2 bg-theme-accent/20 hover:bg-theme-accent/30 text-theme-accent border border-theme-accent/30 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <Link className="w-4 h-4" />
                      {appleCalendarConnected ? 'Reconnect' : 'Connect Calendar.app'}
                    </button>
                    {appleCalendarConnected && (
                      <button
                        onClick={handleImportNow}
                        disabled={calendarBusy}
                        className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <RefreshCw className={`w-4 h-4 ${calendarBusy ? 'animate-spin' : ''}`} />
                        Import Events Now
                      </button>
                    )}
                    {appleCalendarConnected && (
                      <span className="text-sm text-green-400">Connected</span>
                    )}
                  </div>
                  {calendarStatus && (
                    <p className="text-sm text-gray-400 mt-3">{calendarStatus}</p>
                  )}
                </div>

                {/* Per-calendar import rules */}
                {appleCalendarConnected && (
                  <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                    <h3 className="text-lg font-semibold mb-2">Auto-Import Rules</h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Import upcoming events (next 30 days) from a calendar as quests. Off by default —
                      events are deduplicated, and your "Quests" calendar is never imported.
                    </p>
                    {appleCalendars.length === 0 ? (
                      <p className="text-sm text-gray-400">No calendars found in Calendar.app.</p>
                    ) : (
                      <div className="space-y-3">
                        {appleCalendars
                          .filter((name) => name !== 'Quests')
                          .map((name) => {
                            const enabled = importRules.find((r) => r.calendar_name === name)?.enabled ?? false;
                            return (
                              <div key={name} className="flex justify-between items-center p-3 bg-theme-bg rounded-lg">
                                <div>
                                  <p className="font-medium">{name}</p>
                                  <p className="text-sm text-gray-400">
                                    {enabled ? 'Importing events as quests' : 'Not importing'}
                                  </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={enabled}
                                    onChange={(e) => {
                                      setImportRule(name, e.target.checked).catch(() =>
                                        setCalendarStatus('Failed to save import rule.')
                                      );
                                    }}
                                  />
                                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
                                </label>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>
                )}

                {/* Push info */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-2">Pushing Quests to Calendar</h3>
                  <p className="text-gray-400 text-sm">
                    Quests with a due date can be added to a dedicated "Quests" calendar via the
                    "Add to Calendar" action on a quest card, or the "Put on calendar" toggle when
                    creating one. Completing a linked quest marks its event with ✅.
                  </p>
                </div>
              </div>
            </FadeIn>
          )}

          {/* Data Management Section */}
          {activeSection === 'data' && (
            <FadeIn delay={100}>
              <div className="space-y-6">
                {/* Export/Import */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Data Export & Import
                  </h3>
                  <p className="text-gray-400 text-sm mb-6">
                    Backup your progress and settings, or import data from another device
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Export Card */}
                    <div className="bg-theme-bg rounded-lg border border-gray-700 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                          <Database className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold">Export Data</h4>
                          <p className="text-sm text-gray-400">Download your data as backup</p>
                        </div>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span>Format Options:</span>
                          <span className="text-gray-400">JSON, CSV, XML</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Data Types:</span>
                          <span className="text-gray-400">All categories</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsDataExportModalOpen(true)}
                        className="w-full bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 rounded-lg px-4 py-2 transition-colors"
                      >
                        Export Data
                      </button>
                    </div>

                    {/* Import Card */}
                    <div className="bg-theme-bg rounded-lg border border-gray-700 p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Database className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold">Import Data</h4>
                          <p className="text-sm text-gray-400">Restore data from backup</p>
                        </div>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span>Supported:</span>
                          <span className="text-gray-400">JSON, CSV, XML</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Merge Mode:</span>
                          <span className="text-gray-400">Safe import</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setIsDataExportModalOpen(true)}
                        className="w-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg px-4 py-2 transition-colors"
                      >
                        Import Data
                      </button>
                    </div>
                  </div>
                </div>

                {/* Storage Usage */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4">Storage Usage</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-theme-bg rounded-lg">
                      <div>
                        <p className="font-medium">Tasks & Quests</p>
                        <p className="text-sm text-gray-400">Active and completed tasks</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">2.4 MB</p>
                        <p className="text-xs text-gray-400">1,247 records</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-theme-bg rounded-lg">
                      <div>
                        <p className="font-medium">Achievements</p>
                        <p className="text-sm text-gray-400">Unlocked achievements and progress</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">512 KB</p>
                        <p className="text-xs text-gray-400">89 records</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-theme-bg rounded-lg">
                      <div>
                        <p className="font-medium">Inventory & Equipment</p>
                        <p className="text-sm text-gray-400">Items and gear</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">1.1 MB</p>
                        <p className="text-xs text-gray-400">345 records</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-theme-bg rounded-lg">
                      <div>
                        <p className="font-medium">Calendar Events</p>
                        <p className="text-sm text-gray-400">Scheduled events and reminders</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm">768 KB</p>
                        <p className="text-xs text-gray-400">156 records</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 pt-4 border-t border-gray-700">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold">Total Storage Used</p>
                      <p className="font-mono text-lg text-theme-accent">4.8 MB</p>
                    </div>
                  </div>
                </div>

                {/* Data Privacy */}
                <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                  <h3 className="text-lg font-semibold mb-4">Data Privacy</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Analytics Collection</p>
                        <p className="text-sm text-gray-400">Anonymous usage statistics</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
                      </label>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Auto Backup</p>
                        <p className="text-sm text-gray-400">Automatically backup data locally</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-theme-accent"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </FadeIn>
          )}

          {/* GitHub Section */}
          {activeSection === 'github' && (
            <FadeIn delay={100}>
              <GithubSettingsPanel />
            </FadeIn>
          )}

          {/* Health Section */}
          {activeSection === 'health' && (
            <FadeIn delay={100}>
              <HealthSettingsPanel />
            </FadeIn>
          )}

          {/* Quick Capture Section */}
          {activeSection === 'capture' && (
            <FadeIn delay={100}>
              <CaptureSettingsPanel />
            </FadeIn>
          )}

          {/* Reminders Section */}
          {activeSection === 'reminders' && (
            <FadeIn delay={100}>
              <RemindersSettingsPanel />
            </FadeIn>
          )}

          {/* Preferences Section */}
          {activeSection === 'preferences' && (
            <FadeIn delay={100}>
              <AdvancedPreferencesPanel className="p-0" />
            </FadeIn>
          )}

          {/* Notifications Section */}
          {activeSection === 'notifications' && (
            <FadeIn delay={100}>
              <NotificationSettingsPanel />
            </FadeIn>
          )}

          {/* Other sections placeholder */}
          {!['appearance', 'profile', 'calendar', 'data', 'github', 'health', 'capture', 'reminders', 'preferences', 'notifications'].includes(activeSection) && (
            <FadeIn delay={100}>
              <div className="bg-theme-primary rounded-lg border border-gray-800 p-6">
                <div className="text-center py-12 text-gray-400">
                  <SettingsIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{sections.find(s => s.id === activeSection)?.label} settings coming soon!</p>
                </div>
              </div>
            </FadeIn>
          )}
        </div>
      </div>
      
      {/* Data Export Modal */}
      <DataExportModal 
        isOpen={isDataExportModalOpen}
        onClose={() => setIsDataExportModalOpen(false)}
      />
    </div>
  )
}

export default Settings