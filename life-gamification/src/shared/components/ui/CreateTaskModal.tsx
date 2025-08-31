import { useState } from 'react';
import { X, Sword, Zap } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import { DIFFICULTY_LEVELS } from '../../../types';
import type { CreateTaskRequest } from '../../../types';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CreateTaskModal = ({ isOpen, onClose }: CreateTaskModalProps) => {
  const { createTask } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [taskType, setTaskType] = useState<'standard' | 'goal'>('standard');
  const [formData, setFormData] = useState<CreateTaskRequest>({
    title: '',
    description: '',
    category: 'general',
    difficulty: 5,
    priority: 3,
    task_type: 'standard',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      await createTask(formData);
      
      // Reset form and close modal
      setFormData({
        title: '',
        description: '',
        category: 'general',
        difficulty: 5,
        priority: 3,
        task_type: 'standard',
      });
      setTaskType('standard');
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
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

          {/* Task Type */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Quest Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTaskType('standard');
                  setFormData({ ...formData, task_type: 'standard', goal_target: undefined, goal_unit: undefined });
                }}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  taskType === 'standard' 
                    ? 'bg-solo-accent/20 border-solo-accent text-solo-accent' 
                    : 'bg-solo-bg border-gray-700 hover:border-gray-600'
                }`}
              >
                Standard Quest
              </button>
              <button
                type="button"
                onClick={() => {
                  setTaskType('goal');
                  setFormData({ ...formData, task_type: 'goal' });
                }}
                className={`flex-1 px-3 py-2 rounded-lg border transition-colors ${
                  taskType === 'goal' 
                    ? 'bg-solo-accent/20 border-solo-accent text-solo-accent' 
                    : 'bg-solo-bg border-gray-700 hover:border-gray-600'
                }`}
              >
                Goal-Based Quest
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
              className="flex-1 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Quest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateTaskModal;