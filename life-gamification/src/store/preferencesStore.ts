// Enhanced User Preferences Store
// Manages comprehensive user customization settings including themes, UI preferences, and behavior settings

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface UserPreferences {
  // Theme and Visual Settings
  theme: {
    id: string;
    customColors?: {
      primary?: string;
      secondary?: string;
      accent?: string;
      background?: string;
      foreground?: string;
    };
    darkMode?: boolean;
    highContrast?: boolean;
  };
  
  // UI and Layout Preferences
  ui: {
    animations: boolean;
    reducedMotion: boolean;
    compactMode: boolean;
    sidebarCollapsed: boolean;
    showTooltips: boolean;
    gridDensity: 'comfortable' | 'standard' | 'compact';
    cardStyle: 'elevated' | 'outlined' | 'filled';
    cornerRadius: 'sharp' | 'rounded' | 'circular';
  };
  
  // Notification Settings
  notifications: {
    enabled: boolean;
    achievements: boolean;
    levelUps: boolean;
    taskReminders: boolean;
    questComplete: boolean;
    systemAlerts: boolean;
    soundEnabled: boolean;
    vibrateEnabled: boolean;
    position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
    duration: number; // in milliseconds
  };
  
  // Gamification Settings
  gamification: {
    showXPNumbers: boolean;
    showLevelProgress: boolean;
    enableAchievementPopups: boolean;
    questDifficultySuggestions: boolean;
    autoCompleteRewards: boolean;
    celebrationIntensity: 'minimal' | 'standard' | 'enthusiastic';
    showStatistics: boolean;
  };
  
  // Accessibility Settings
  accessibility: {
    fontSize: number; // percentage scale
    lineHeight: number;
    focusRingVisible: boolean;
    skipLinksEnabled: boolean;
    screenReaderOptimizations: boolean;
    keyboardNavigation: boolean;
    colorBlindnessSupport: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  };
  
  // Performance and Data
  performance: {
    enableAnalytics: boolean;
    autoSave: boolean;
    autoSaveInterval: number; // minutes
    enableDebugMode: boolean;
    showPerformanceMetrics: boolean;
    enableOfflineMode: boolean;
    cacheEnabled: boolean;
  };
  
  // Calendar and Time Settings
  calendar: {
    weekStartsOn: 0 | 1; // 0 = Sunday, 1 = Monday
    timeFormat: '12h' | '24h';
    defaultView: 'month' | 'week' | 'day';
    showWeekNumbers: boolean;
    highlightToday: boolean;
    showNonWorkingDays: boolean;
    eventColors: Record<string, string>;
  };
  
  // Task Management Preferences
  tasks: {
    defaultDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
    autoArchiveCompleted: boolean;
    archiveAfterDays: number;
    showSubtasks: boolean;
    enableQuickAdd: boolean;
    defaultTags: string[];
    sortBy: 'created' | 'due' | 'priority' | 'difficulty';
    groupBy: 'none' | 'status' | 'difficulty' | 'tags' | 'date';
  };
  
  // Advanced Settings
  advanced: {
    developerMode: boolean;
    experimentalFeatures: boolean;
    betaUpdates: boolean;
    verboseLogging: boolean;
    customCSS?: string;
    shortcuts: Record<string, string>;
  };
}

interface PreferencesState extends UserPreferences {
  // Actions
  updateTheme: (theme: Partial<UserPreferences['theme']>) => void;
  updateUI: (ui: Partial<UserPreferences['ui']>) => void;
  updateNotifications: (notifications: Partial<UserPreferences['notifications']>) => void;
  updateGamification: (gamification: Partial<UserPreferences['gamification']>) => void;
  updateAccessibility: (accessibility: Partial<UserPreferences['accessibility']>) => void;
  updatePerformance: (performance: Partial<UserPreferences['performance']>) => void;
  updateCalendar: (calendar: Partial<UserPreferences['calendar']>) => void;
  updateTasks: (tasks: Partial<UserPreferences['tasks']>) => void;
  updateAdvanced: (advanced: Partial<UserPreferences['advanced']>) => void;
  
  // Utility actions
  resetToDefaults: () => void;
  exportPreferences: () => string;
  importPreferences: (preferences: string) => boolean;
  validatePreferences: (preferences: any) => boolean;
}

// Default preferences
const defaultPreferences: UserPreferences = {
  theme: {
    id: 'solo-leveling',
    darkMode: true,
    highContrast: false
  },
  
  ui: {
    animations: true,
    reducedMotion: false,
    compactMode: false,
    sidebarCollapsed: false,
    showTooltips: true,
    gridDensity: 'standard',
    cardStyle: 'elevated',
    cornerRadius: 'rounded'
  },
  
  notifications: {
    enabled: true,
    achievements: true,
    levelUps: true,
    taskReminders: true,
    questComplete: true,
    systemAlerts: true,
    soundEnabled: true,
    vibrateEnabled: false,
    position: 'top-right',
    duration: 4000
  },
  
  gamification: {
    showXPNumbers: true,
    showLevelProgress: true,
    enableAchievementPopups: true,
    questDifficultySuggestions: true,
    autoCompleteRewards: true,
    celebrationIntensity: 'standard',
    showStatistics: true
  },
  
  accessibility: {
    fontSize: 100,
    lineHeight: 1.5,
    focusRingVisible: true,
    skipLinksEnabled: true,
    screenReaderOptimizations: false,
    keyboardNavigation: true,
    colorBlindnessSupport: 'none'
  },
  
  performance: {
    enableAnalytics: true,
    autoSave: true,
    autoSaveInterval: 5,
    enableDebugMode: false,
    showPerformanceMetrics: false,
    enableOfflineMode: true,
    cacheEnabled: true
  },
  
  calendar: {
    weekStartsOn: 0,
    timeFormat: '12h',
    defaultView: 'month',
    showWeekNumbers: false,
    highlightToday: true,
    showNonWorkingDays: true,
    eventColors: {
      'personal': '#3b82f6',
      'work': '#f59e0b',
      'health': '#10b981',
      'social': '#8b5cf6'
    }
  },
  
  tasks: {
    defaultDifficulty: 'medium',
    autoArchiveCompleted: true,
    archiveAfterDays: 30,
    showSubtasks: true,
    enableQuickAdd: true,
    defaultTags: [],
    sortBy: 'created',
    groupBy: 'status'
  },
  
  advanced: {
    developerMode: false,
    experimentalFeatures: false,
    betaUpdates: false,
    verboseLogging: false,
    shortcuts: {}
  }
};

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set, get) => ({
      ...defaultPreferences,
      
      updateTheme: (theme) => set((state) => ({
        theme: { ...state.theme, ...theme }
      })),
      
      updateUI: (ui) => set((state) => ({
        ui: { ...state.ui, ...ui }
      })),
      
      updateNotifications: (notifications) => set((state) => ({
        notifications: { ...state.notifications, ...notifications }
      })),
      
      updateGamification: (gamification) => set((state) => ({
        gamification: { ...state.gamification, ...gamification }
      })),
      
      updateAccessibility: (accessibility) => set((state) => ({
        accessibility: { ...state.accessibility, ...accessibility }
      })),
      
      updatePerformance: (performance) => set((state) => ({
        performance: { ...state.performance, ...performance }
      })),
      
      updateCalendar: (calendar) => set((state) => ({
        calendar: { ...state.calendar, ...calendar }
      })),
      
      updateTasks: (tasks) => set((state) => ({
        tasks: { ...state.tasks, ...tasks }
      })),
      
      updateAdvanced: (advanced) => set((state) => ({
        advanced: { ...state.advanced, ...advanced }
      })),
      
      resetToDefaults: () => set(defaultPreferences),
      
      exportPreferences: () => {
        const state = get();
        const exportData = {
          theme: state.theme,
          ui: state.ui,
          notifications: state.notifications,
          gamification: state.gamification,
          accessibility: state.accessibility,
          performance: state.performance,
          calendar: state.calendar,
          tasks: state.tasks,
          advanced: state.advanced,
          exportMetadata: {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            source: 'life-gamification-app'
          }
        };
        return JSON.stringify(exportData, null, 2);
      },
      
      importPreferences: (preferencesJson: string) => {
        try {
          const importedPrefs = JSON.parse(preferencesJson);
          
          if (!get().validatePreferences(importedPrefs)) {
            return false;
          }
          
          // Apply valid preferences
          set((state) => ({
            theme: { ...state.theme, ...(importedPrefs.theme || {}) },
            ui: { ...state.ui, ...(importedPrefs.ui || {}) },
            notifications: { ...state.notifications, ...(importedPrefs.notifications || {}) },
            gamification: { ...state.gamification, ...(importedPrefs.gamification || {}) },
            accessibility: { ...state.accessibility, ...(importedPrefs.accessibility || {}) },
            performance: { ...state.performance, ...(importedPrefs.performance || {}) },
            calendar: { ...state.calendar, ...(importedPrefs.calendar || {}) },
            tasks: { ...state.tasks, ...(importedPrefs.tasks || {}) },
            advanced: { ...state.advanced, ...(importedPrefs.advanced || {}) }
          }));
          
          return true;
        } catch (error) {
          console.error('Failed to import preferences:', error);
          return false;
        }
      },
      
      validatePreferences: (prefs: any) => {
        // Basic validation to ensure the preferences object structure is valid
        if (!prefs || typeof prefs !== 'object') {
          return false;
        }
        
        // Validate specific critical values
        if (prefs.accessibility?.fontSize && 
            (prefs.accessibility.fontSize < 50 || prefs.accessibility.fontSize > 200)) {
          return false;
        }
        
        if (prefs.notifications?.duration && 
            (prefs.notifications.duration < 1000 || prefs.notifications.duration > 30000)) {
          return false;
        }
        
        if (prefs.performance?.autoSaveInterval && 
            (prefs.performance.autoSaveInterval < 1 || prefs.performance.autoSaveInterval > 60)) {
          return false;
        }
        
        return true;
      }
    }),
    {
      name: 'life-gamification-preferences',
      version: 1,
      // Migrate function for handling preference updates
      migrate: (persistedState: any, version: number) => {
        if (version === 0) {
          // Migrate from version 0 to 1
          return {
            ...defaultPreferences,
            ...persistedState,
            // Ensure new fields are added with defaults
          };
        }
        return persistedState;
      }
    }
  )
);

// Selectors for easier access to specific preference categories
export const useThemePreferences = () => usePreferencesStore((state) => state.theme);
export const useUIPreferences = () => usePreferencesStore((state) => state.ui);
export const useNotificationPreferences = () => usePreferencesStore((state) => state.notifications);
export const useGamificationPreferences = () => usePreferencesStore((state) => state.gamification);
export const useAccessibilityPreferences = () => usePreferencesStore((state) => state.accessibility);
export const usePerformancePreferences = () => usePreferencesStore((state) => state.performance);
export const useCalendarPreferences = () => usePreferencesStore((state) => state.calendar);
export const useTaskPreferences = () => usePreferencesStore((state) => state.tasks);
export const useAdvancedPreferences = () => usePreferencesStore((state) => state.advanced);