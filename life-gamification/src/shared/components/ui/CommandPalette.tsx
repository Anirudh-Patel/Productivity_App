import React, { useState, useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Settings, Home, Trophy, Package, 
  BarChart3, User, Zap, Crown, BookOpen,
  Target, Clock, TrendingUp, Star, Gamepad2, Palette
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '../../../store/gameStore';
import { notificationService } from '../../../services/notificationService';

interface CommandItem {
  id: string;
  name: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'tasks' | 'game' | 'system' | 'plugins';
  shortcut?: string;
  disabled?: boolean;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onOpenChange }) => {
  const [value, setValue] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const navigate = useNavigate();
  const { user, completeTask, tasks, fetchUser, fetchAchievements } = useGameStore();

  // Core application commands
  const coreCommands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-dashboard',
      name: 'Go to Dashboard',
      description: 'View your progress and stats',
      icon: <Home className="w-4 h-4" />,
      action: () => navigate('/'),
      category: 'navigation',
      shortcut: 'Alt+1'
    },
    {
      id: 'nav-tasks',
      name: 'Go to Tasks',
      description: 'Manage your quests and activities',
      icon: <Target className="w-4 h-4" />,
      action: () => navigate('/tasks'),
      category: 'navigation',
      shortcut: 'Alt+2'
    },
    {
      id: 'nav-stats',
      name: 'Go to Stats',
      description: 'View detailed analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      action: () => navigate('/stats'),
      category: 'navigation',
      shortcut: 'Alt+3'
    },
    {
      id: 'nav-shop',
      name: 'Go to Shop',
      description: 'Purchase items and upgrades',
      icon: <Package className="w-4 h-4" />,
      action: () => navigate('/shop'),
      category: 'navigation',
      shortcut: 'Alt+4'
    },
    {
      id: 'nav-inventory',
      name: 'Go to Inventory',
      description: 'Manage your items',
      icon: <Package className="w-4 h-4" />,
      action: () => navigate('/inventory'),
      category: 'navigation',
      shortcut: 'Alt+5'
    },
    {
      id: 'nav-settings',
      name: 'Go to Settings',
      description: 'Configure your preferences',
      icon: <Settings className="w-4 h-4" />,
      action: () => navigate('/settings'),
      category: 'navigation',
      shortcut: 'Alt+6'
    },

    // Task Management
    {
      id: 'task-create',
      name: 'Create New Task',
      description: 'Add a new quest to your list',
      icon: <Plus className="w-4 h-4" />,
      action: () => {
        onOpenChange(false);
        // You could open a task creation modal here
        notificationService.notifySystem('Task Creator', 'Opening task creation dialog...');
      },
      category: 'tasks',
      shortcut: 'Ctrl+N'
    },
    {
      id: 'task-complete-random',
      name: 'Complete Random Task',
      description: 'Mark a random active task as complete',
      icon: <Zap className="w-4 h-4" />,
      action: async () => {
        const activeTasks = tasks.active;
        if (activeTasks.length > 0) {
          const randomTask = activeTasks[Math.floor(Math.random() * activeTasks.length)];
          await completeTask(randomTask.id);
          notificationService.notifySystem('Task Completed', `Completed: ${randomTask.title}`);
        }
      },
      category: 'tasks',
      disabled: tasks.active.length === 0
    },

    // Game Actions
    {
      id: 'game-refresh-user',
      name: 'Refresh User Data',
      description: 'Update your character stats',
      icon: <User className="w-4 h-4" />,
      action: async () => {
        await fetchUser();
        notificationService.notifySystem('Data Refreshed', 'User data has been updated');
      },
      category: 'game',
      shortcut: 'Ctrl+R'
    },
    {
      id: 'game-check-achievements',
      name: 'Check Achievements',
      description: 'Look for new unlocked achievements',
      icon: <Trophy className="w-4 h-4" />,
      action: async () => {
        await fetchAchievements();
        notificationService.notifySystem('Achievements', 'Achievement status updated');
      },
      category: 'game'
    },
    {
      id: 'game-level-info',
      name: 'View Level Info',
      description: 'Show current level and XP progress',
      icon: <Star className="w-4 h-4" />,
      action: () => {
        if (user) {
          const xpToNext = user.experience_to_next_level - user.experience_points;
          notificationService.notifySystem(
            `Level ${user.level} Hunter`,
            `${user.experience_points} / ${user.experience_to_next_level} XP (${xpToNext} to next level)`
          );
        }
      },
      category: 'game'
    },

    // System Actions
    {
      id: 'system-toggle-theme',
      name: 'Toggle Theme',
      description: 'Switch between light and dark mode',
      icon: <Palette className="w-4 h-4" />,
      action: () => {
        // Theme toggle logic would go here
        notificationService.notifySystem('Theme', 'Theme toggled (feature coming soon)');
      },
      category: 'system'
    },
    {
      id: 'system-export-data',
      name: 'Export Data',
      description: 'Export your game progress',
      icon: <BookOpen className="w-4 h-4" />,
      action: () => {
        // Data export logic would go here
        notificationService.notifySystem('Data Export', 'Opening export dialog...');
      },
      category: 'system'
    },
  ];

  // Simulated plugin commands (for demonstration)
  const pluginCommands: CommandItem[] = [
    {
      id: 'plugin-pomodoro',
      name: 'Start Pomodoro Timer',
      description: 'Begin a focused work session',
      icon: <Clock className="w-4 h-4" />,
      action: () => {
        notificationService.notifySystem('Pomodoro Plugin', 'Starting 25-minute focus session');
      },
      category: 'plugins'
    },
    {
      id: 'plugin-habit-tracker',
      name: 'Log Daily Habit',
      description: 'Mark a habit as completed for today',
      icon: <TrendingUp className="w-4 h-4" />,
      action: () => {
        notificationService.notifySystem('Habit Tracker', 'Habit logged successfully!');
      },
      category: 'plugins'
    },
    {
      id: 'plugin-mood-log',
      name: 'Log Current Mood',
      description: 'Track your emotional state',
      icon: <Gamepad2 className="w-4 h-4" />,
      action: () => {
        notificationService.notifySystem('Mood Plugin', 'Mood logged for today');
      },
      category: 'plugins'
    }
  ];

  const allCommands = [...coreCommands, ...pluginCommands];

  const categories = [
    { id: 'navigation', name: 'Navigation', icon: <Home className="w-4 h-4" /> },
    { id: 'tasks', name: 'Tasks', icon: <Target className="w-4 h-4" /> },
    { id: 'game', name: 'Game', icon: <Crown className="w-4 h-4" /> },
    { id: 'system', name: 'System', icon: <Settings className="w-4 h-4" /> },
    { id: 'plugins', name: 'Plugins', icon: <Zap className="w-4 h-4" /> }
  ];

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setValue('');
    setSelectedCategory('');
  }, [onOpenChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close on Escape
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
      
      // Execute command shortcuts
      const shortcut = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
      const command = allCommands.find(cmd => cmd.shortcut === shortcut);
      
      if (command && !e.defaultPrevented) {
        e.preventDefault();
        command.action();
        if (isOpen) handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, allCommands]);

  const filteredCommands = selectedCategory 
    ? allCommands.filter(cmd => cmd.category === selectedCategory)
    : allCommands;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={handleClose}
          />
          
          {/* Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[20%] left-1/2 transform -translate-x-1/2 w-full max-w-2xl mx-4 z-50"
          >
            <Command className="bg-gray-900/95 backdrop-blur-xl rounded-lg border border-gray-700 shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center px-4 py-3 border-b border-gray-700">
                <Search className="w-5 h-5 text-gray-400 mr-3" />
                <Command.Input
                  value={value}
                  onValueChange={setValue}
                  placeholder="Type a command or search..."
                  className="flex-1 bg-transparent text-white placeholder-gray-400 outline-none text-lg"
                />
                <div className="text-xs text-gray-500 ml-2">
                  ESC to close
                </div>
              </div>

              <div className="flex">
                {/* Categories Sidebar */}
                <div className="w-48 bg-gray-800/50 border-r border-gray-700">
                  <div className="p-2 space-y-1">
                    <button
                      onClick={() => setSelectedCategory('')}
                      className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                        selectedCategory === '' 
                          ? 'bg-purple-600 text-white' 
                          : 'text-gray-400 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <Search className="w-4 h-4" />
                      <span>All Commands</span>
                    </button>
                    
                    {categories.map(category => (
                      <button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        className={`w-full flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                          selectedCategory === category.id 
                            ? 'bg-purple-600 text-white' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                      >
                        {category.icon}
                        <span>{category.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Commands List */}
                <div className="flex-1">
                  <Command.List className="max-h-[400px] overflow-y-auto p-2">
                    <Command.Empty className="py-8 text-center text-gray-500">
                      No commands found.
                    </Command.Empty>

                    {categories.map(category => (
                      <Command.Group 
                        key={category.id} 
                        heading={selectedCategory === '' ? category.name : undefined}
                        className={selectedCategory !== '' && selectedCategory !== category.id ? 'hidden' : ''}
                      >
                        {filteredCommands
                          .filter(cmd => cmd.category === category.id)
                          .map(command => (
                            <Command.Item
                              key={command.id}
                              value={command.name}
                              onSelect={() => {
                                if (!command.disabled) {
                                  command.action();
                                  handleClose();
                                }
                              }}
                              disabled={command.disabled}
                              className={`flex items-center space-x-3 px-3 py-3 rounded-md cursor-pointer transition-colors ${
                                command.disabled
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-gray-700 data-[selected="true"]:bg-purple-600'
                              }`}
                            >
                              <div className="flex-shrink-0 text-gray-400">
                                {command.icon}
                              </div>
                              
                              <div className="flex-1">
                                <div className="text-white font-medium">{command.name}</div>
                                {command.description && (
                                  <div className="text-sm text-gray-400">{command.description}</div>
                                )}
                              </div>
                              
                              {command.shortcut && (
                                <div className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                                  {command.shortcut}
                                </div>
                              )}
                            </Command.Item>
                          ))
                        }
                      </Command.Group>
                    ))}
                  </Command.List>
                </div>
              </div>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// Hook for managing command palette state
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open with Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { isOpen, setIsOpen };
};