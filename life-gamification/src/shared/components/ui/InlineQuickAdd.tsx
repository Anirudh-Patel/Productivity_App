import { useState, useRef, useEffect } from 'react';
import { Plus, Zap, X, ChevronDown } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import type { CreateTaskRequest } from '../../../types';

interface InlineQuickAddProps {
  onTaskCreated?: () => void;
}

const SMART_DEFAULTS = {
  morning: { category: 'fitness', difficulty: 5 },    // 6am-12pm
  afternoon: { category: 'work', difficulty: 6 },     // 12pm-6pm
  evening: { category: 'learning', difficulty: 5 },   // 6pm-10pm
  night: { category: 'general', difficulty: 4 },      // 10pm-6am
};

const getTimeBasedDefaults = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return SMART_DEFAULTS.morning;
  if (hour >= 12 && hour < 18) return SMART_DEFAULTS.afternoon;
  if (hour >= 18 && hour < 22) return SMART_DEFAULTS.evening;
  return SMART_DEFAULTS.night;
};

export const InlineQuickAdd = ({ onTaskCreated }: InlineQuickAddProps) => {
  const { createTask } = useGameStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [category, setCategory] = useState('general');
  const [difficulty, setDifficulty] = useState(5);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Global keyboard shortcut: Cmd/Ctrl+K to expand
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsExpanded(true);
      }

      // Escape to close
      if (e.key === 'Escape' && isExpanded) {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || loading) return;

    setLoading(true);
    try {
      const defaults = getTimeBasedDefaults();
      const taskData: CreateTaskRequest = {
        title: title.trim(),
        description: '',
        category: showOptions ? category : defaults.category,
        difficulty: showOptions ? difficulty : defaults.difficulty,
        priority: 3,
        task_type: 'standard',
      };

      await createTask(taskData);

      // Reset form
      setTitle('');
      setIsExpanded(false);
      setShowOptions(false);
      setCategory('general');
      setDifficulty(5);

      onTaskCreated?.();
    } catch (error) {
      console.error('Failed to create quick task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setIsExpanded(false);
    setShowOptions(false);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full px-4 py-3 bg-theme-primary border-2 border-dashed border-gray-700 rounded-lg hover:border-theme-accent hover:bg-theme-accent/5 transition-all group flex items-center justify-center gap-2 text-gray-400 hover:text-theme-accent"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Quick Add Quest (just type + Enter)</span>
        <span className="text-xs bg-gray-800 px-2 py-1 rounded ml-auto">Cmd+K</span>
      </button>
    );
  }

  const defaults = getTimeBasedDefaults();

  return (
    <form onSubmit={handleSubmit} className="w-full bg-theme-primary border-2 border-theme-accent/50 rounded-lg p-4 space-y-3 shadow-lg">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-theme-accent flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you want to accomplish?"
          disabled={loading}
          className="flex-1 bg-transparent border-none focus:outline-none text-theme-fg placeholder-gray-500"
        />
        <button
          type="button"
          onClick={() => setShowOptions(!showOptions)}
          className="p-2 text-gray-400 hover:text-theme-fg transition-colors"
          title="Show options"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="p-2 text-gray-400 hover:text-theme-fg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Smart defaults hint */}
      {!showOptions && (
        <div className="text-xs text-gray-400 flex items-center gap-1">
          <Zap className="w-3 h-3" />
          Smart defaults: {defaults.category} quest, difficulty {defaults.difficulty}/10
        </div>
      )}

      {/* Expanded options */}
      {showOptions && (
        <div className="flex gap-3 pt-2 border-t border-gray-700">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent text-sm"
            >
              <option value="general">General</option>
              <option value="fitness">Fitness</option>
              <option value="learning">Learning</option>
              <option value="work">Work</option>
              <option value="health">Health</option>
              <option value="social">Social</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Difficulty: {difficulty}/10</label>
            <input
              type="range"
              min="1"
              max="10"
              value={difficulty}
              onChange={(e) => setDifficulty(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={!title.trim() || loading}
          className="flex-1 px-4 py-2 bg-theme-accent text-white rounded-lg hover:bg-theme-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Creating...' : 'Create Quest'}
        </button>
        <div className="text-xs text-gray-500 flex items-center">
          or press <kbd className="px-2 py-1 bg-gray-800 rounded ml-1">Enter</kbd>
        </div>
      </div>
    </form>
  );
};
