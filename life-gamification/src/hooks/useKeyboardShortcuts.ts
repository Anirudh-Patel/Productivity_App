import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../store/gameStore';
import { useToast } from '../shared/components/ui/Toast';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  action: () => void;
  description: string;
  category: 'navigation' | 'tasks' | 'ui' | 'accessibility' | 'gaming';
  preventDefault?: boolean;
  enabled?: boolean;
}

interface KeyboardShortcutsOptions {
  enabled?: boolean;
  showNotifications?: boolean;
}

export const useKeyboardShortcuts = (customShortcuts: KeyboardShortcut[] = [], options: KeyboardShortcutsOptions = {}) => {
  const { enabled = true, showNotifications = false } = options;
  const navigate = useNavigate();
  const toast = useToast();
  const { createTask, completeTask, tasks, fetchTasks, fetchUser } = useGameStore();
  const [shortcutsEnabled, setShortcutsEnabled] = useState(enabled);
  const lastTriggeredRef = useRef<number>(0);

  // Core application shortcuts
  const coreShortcuts: KeyboardShortcut[] = [
    // Navigation shortcuts
    {
      key: 'Home',
      action: () => {
        navigate('/');
        showNotifications && toast.info('Navigation', 'Navigated to Dashboard');
      },
      description: 'Go to Dashboard',
      category: 'navigation'
    },
    {
      key: '1',
      altKey: true,
      action: () => navigate('/'),
      description: 'Dashboard',
      category: 'navigation',
      preventDefault: true
    },
    {
      key: '2',
      altKey: true,
      action: () => navigate('/tasks'),
      description: 'Tasks',
      category: 'navigation',
      preventDefault: true
    },
    {
      key: '3',
      altKey: true,
      action: () => navigate('/calendar'),
      description: 'Calendar',
      category: 'navigation',
      preventDefault: true
    },
    {
      key: '4',
      altKey: true,
      action: () => navigate('/stats'),
      description: 'Stats',
      category: 'navigation',
      preventDefault: true
    },
    {
      key: '5',
      altKey: true,
      action: () => navigate('/equipment'),
      description: 'Equipment',
      category: 'navigation',
      preventDefault: true
    },
    {
      key: '6',
      altKey: true,
      action: () => navigate('/shop'),
      description: 'Shop',
      category: 'navigation',
      preventDefault: true
    },

    // Task management shortcuts
    {
      key: 'n',
      ctrlKey: true,
      action: () => {
        const event = new CustomEvent('open-create-task-modal');
        window.dispatchEvent(event);
        showNotifications && toast.info('Quick Action', 'Opening task creation dialog');
      },
      description: 'Create New Task',
      category: 'tasks',
      preventDefault: true
    },
    {
      key: 'Enter',
      ctrlKey: true,
      action: async () => {
        const firstActiveTask = tasks.active[0];
        if (firstActiveTask) {
          try {
            await completeTask(firstActiveTask.id);
            toast.success('Task Completed! 🎉', `"${firstActiveTask.title}" marked as complete`);
          } catch (error) {
            toast.error('Completion Failed', 'Could not complete the task');
          }
        } else {
          toast.info('No Active Tasks', 'Create a task first to complete it');
        }
      },
      description: 'Complete First Active Task',
      category: 'tasks',
      preventDefault: true
    },
    {
      key: 'r',
      ctrlKey: true,
      action: async () => {
        try {
          await Promise.all([fetchTasks(), fetchUser()]);
          toast.success('Data Refreshed', 'All application data has been refreshed');
        } catch (error) {
          toast.error('Refresh Failed', 'Could not refresh data');
        }
      },
      description: 'Refresh Data',
      category: 'tasks',
      preventDefault: true
    },

    // UI shortcuts
    {
      key: 'q',
      ctrlKey: true,
      action: () => {
        const event = new CustomEvent('open-command-palette');
        window.dispatchEvent(event);
      },
      description: 'Open Command Palette',
      category: 'ui',
      preventDefault: true
    },
    {
      key: 'k',
      ctrlKey: true,
      action: () => {
        // Focus search input if available
        const searchInput = document.querySelector('input[type="search"], input[placeholder*="search" i], input[placeholder*="Search" i]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
          showNotifications && toast.info('Search Focus', 'Search input focused');
        } else {
          const event = new CustomEvent('focus-search');
          window.dispatchEvent(event);
        }
      },
      description: 'Focus Search Input',
      category: 'accessibility',
      preventDefault: true
    },
    {
      key: 'Escape',
      action: () => {
        // Close any open modals, dropdowns, or overlays
        const event = new CustomEvent('close-all-modals');
        window.dispatchEvent(event);
        
        // Also blur any focused input
        const activeElement = document.activeElement as HTMLElement;
        if (activeElement && activeElement.blur) {
          activeElement.blur();
        }
      },
      description: 'Close Modals/Clear Focus',
      category: 'accessibility'
    },

    // Accessibility shortcuts
    {
      key: '/',
      ctrlKey: true,
      action: () => {
        const event = new CustomEvent('toggle-keyboard-help');
        window.dispatchEvent(event);
      },
      description: 'Show/Hide Keyboard Shortcuts',
      category: 'accessibility',
      preventDefault: true
    },
    {
      key: 'h',
      ctrlKey: true,
      shiftKey: true,
      action: () => {
        setShortcutsEnabled(!shortcutsEnabled);
        toast.info(
          'Keyboard Shortcuts',
          shortcutsEnabled ? 'Shortcuts disabled' : 'Shortcuts enabled'
        );
      },
      description: 'Toggle Keyboard Shortcuts',
      category: 'accessibility',
      preventDefault: true
    },

    // Gaming/Fun shortcuts
    {
      key: 'i',
      ctrlKey: true,
      action: () => {
        navigate('/inventory');
        showNotifications && toast.info('Inventory', 'Opening your inventory');
      },
      description: 'Open Inventory',
      category: 'gaming',
      preventDefault: true
    },
    {
      key: 'p',
      ctrlKey: true,
      action: () => {
        const user = useGameStore.getState().user;
        toast.info(
          'Player Profile',
          `Level ${user?.level || 1} • ${user?.experience_points || 0} XP • ${user?.gold || 0} Gold`,
          5000
        );
      },
      description: 'Show Player Stats',
      category: 'gaming',
      preventDefault: true
    },

    // Advanced shortcuts
    {
      key: 'F1',
      action: () => {
        const event = new CustomEvent('show-help-center');
        window.dispatchEvent(event);
      },
      description: 'Open Help Center',
      category: 'accessibility',
      preventDefault: true
    },
    {
      key: 'F5',
      action: (e) => {
        // Allow default F5 behavior but show notification
        showNotifications && toast.info('Page Refresh', 'Refreshing application...');
      },
      description: 'Refresh Page',
      category: 'ui'
    }
  ];

  // Combine core shortcuts with custom shortcuts
  const allShortcuts = [...coreShortcuts, ...customShortcuts].filter(s => s.enabled !== false);

  // Handle keyboard events with debouncing
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!shortcutsEnabled) return;

    // Debounce rapid key presses
    const now = Date.now();
    if (now - lastTriggeredRef.current < 50) return;

    // Don't trigger shortcuts when typing in input fields (with exceptions)
    const target = event.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.isContentEditable;

    if (isInputField) {
      // Allow only certain shortcuts in input fields
      const allowedInInputs = ['Escape', 'Tab', 'F1', 'F5'];
      const isModifierCombo = event.ctrlKey || event.altKey || event.metaKey;
      
      if (!allowedInInputs.includes(event.key) && !isModifierCombo) {
        return;
      }
    }

    // Find matching shortcut
    const matchingShortcut = allShortcuts.find(shortcut => {
      return shortcut.key.toLowerCase() === event.key.toLowerCase() &&
             !!shortcut.ctrlKey === event.ctrlKey &&
             !!shortcut.altKey === event.altKey &&
             !!shortcut.shiftKey === event.shiftKey &&
             !!shortcut.metaKey === event.metaKey;
    });

    if (matchingShortcut) {
      lastTriggeredRef.current = now;
      
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault();
      }
      event.stopPropagation();
      
      try {
        matchingShortcut.action();
      } catch (error) {
        console.error('Error executing keyboard shortcut:', error);
        toast.error('Shortcut Error', 'Failed to execute keyboard shortcut');
      }
    }
  }, [shortcutsEnabled, allShortcuts, navigate, toast, completeTask, tasks.active]);

  // Set up event listeners
  useEffect(() => {
    if (!shortcutsEnabled) return;

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [handleKeyDown, shortcutsEnabled]);

  // Utility function to get formatted key combination
  const getKeyCombo = (shortcut: KeyboardShortcut): string => {
    const modifiers: string[] = [];
    
    if (shortcut.ctrlKey) modifiers.push('Ctrl');
    if (shortcut.altKey) modifiers.push('Alt');
    if (shortcut.shiftKey) modifiers.push('Shift');
    if (shortcut.metaKey) modifiers.push('⌘');
    
    return [...modifiers, shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase()].join(' + ');
  };

  // Get shortcuts by category
  const getShortcutsByCategory = () => {
    return allShortcuts.reduce((acc, shortcut) => {
      if (!acc[shortcut.category]) {
        acc[shortcut.category] = [];
      }
      acc[shortcut.category].push({
        ...shortcut,
        keyCombo: getKeyCombo(shortcut)
      });
      return acc;
    }, {} as Record<string, Array<KeyboardShortcut & { keyCombo: string }>>);
  };

  return {
    shortcuts: allShortcuts,
    shortcutsEnabled,
    setShortcutsEnabled,
    getShortcutsByCategory,
    getKeyCombo
  };
};

// Global keyboard shortcuts hook for app-wide shortcuts
export const useGlobalShortcuts = (callbacks: {
  openNewQuest?: () => void;
  openSearch?: () => void;
  toggleSidebar?: () => void;
  openHelp?: () => void;
}) => {
  const customShortcuts: KeyboardShortcut[] = [
    {
      key: '\\',
      ctrlKey: true,
      action: callbacks.toggleSidebar || (() => {}),
      description: 'Toggle Sidebar',
      category: 'ui',
      preventDefault: true,
      enabled: !!callbacks.toggleSidebar
    },
    {
      key: '?',
      shiftKey: true,
      action: callbacks.openHelp || (() => {}),
      description: 'Show Help',
      category: 'accessibility',
      enabled: !!callbacks.openHelp
    }
  ];

  return useKeyboardShortcuts(customShortcuts, { showNotifications: false });
};

// Utility to format shortcut display
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push('⌘');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.altKey) parts.push('Alt');
  
  parts.push(shortcut.key === ' ' ? 'Space' : shortcut.key.toUpperCase());
  
  return parts.join(' + ');
};