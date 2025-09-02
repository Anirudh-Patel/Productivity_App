import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
  category: string;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement ||
        (event.target as Element)?.contentEditable === 'true'
      ) {
        return;
      }

      const matchingShortcut = shortcuts.find(shortcut => {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrlKey === event.ctrlKey;
        const metaMatch = !!shortcut.metaKey === event.metaKey;
        const shiftMatch = !!shortcut.shiftKey === event.shiftKey;
        const altMatch = !!shortcut.altKey === event.altKey;

        return keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch;
      });

      if (matchingShortcut) {
        event.preventDefault();
        matchingShortcut.action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

// Global keyboard shortcuts
export const useGlobalShortcuts = (callbacks: {
  openNewQuest?: () => void;
  openSearch?: () => void;
  toggleSidebar?: () => void;
  openHelp?: () => void;
}) => {
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      ctrlKey: true,
      action: callbacks.openNewQuest || (() => {}),
      description: 'Create new quest',
      category: 'Actions'
    },
    {
      key: 'k',
      ctrlKey: true,
      action: callbacks.openSearch || (() => {}),
      description: 'Quick search',
      category: 'Navigation'
    },
    {
      key: '\\',
      ctrlKey: true,
      action: callbacks.toggleSidebar || (() => {}),
      description: 'Toggle sidebar',
      category: 'Interface'
    },
    {
      key: '?',
      shiftKey: true,
      action: callbacks.openHelp || (() => {}),
      description: 'Show keyboard shortcuts',
      category: 'Help'
    }
  ].filter(shortcut => shortcut.action.toString() !== '() => {}');

  useKeyboardShortcuts(shortcuts);
  return shortcuts;
};

// Utility to format shortcut display
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  
  if (shortcut.ctrlKey) parts.push('Ctrl');
  if (shortcut.metaKey) parts.push('⌘');
  if (shortcut.shiftKey) parts.push('Shift');
  if (shortcut.altKey) parts.push('Alt');
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(' + ');
};