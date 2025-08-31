import { useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { useGameStore } from '../../../store/gameStore';
import type { Task } from '../../../types';
import { ButtonLoader } from './LoadingSpinner';

interface UpdateProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task;
}

const UpdateProgressModal = ({ isOpen, onClose, task }: UpdateProgressModalProps) => {
  const { updateTaskProgress } = useGameStore();
  const [loading, setLoading] = useState(false);
  const [progressAmount, setProgressAmount] = useState<number>(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (progressAmount <= 0) return;

    setLoading(true);
    try {
      await updateTaskProgress(task.id, progressAmount);
      setProgressAmount(0);
      onClose();
    } catch (error) {
      console.error('Failed to update progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentProgress = task.goal_current || 0;
  const targetProgress = task.goal_target || 100;
  const progressPercent = Math.min(100, (currentProgress / targetProgress) * 100);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-solo-primary border border-gray-800 rounded-lg w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-solo-accent" />
            Update Progress
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-solo-bg rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Task Info */}
          <div className="p-3 bg-solo-bg rounded-lg border border-gray-700">
            <div className="text-sm font-medium mb-2">{task.title}</div>
            <div className="text-xs text-gray-400">
              Current Progress: {currentProgress} / {targetProgress} {task.goal_unit || 'units'}
            </div>
            
            {/* Progress Bar */}
            <div className="mt-3">
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-solo-accent to-solo-secondary transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1 text-right">
                {progressPercent.toFixed(1)}% Complete
              </div>
            </div>
          </div>

          {/* Progress Input */}
          <div>
            <label htmlFor="progress" className="block text-sm font-medium mb-2">
              Add Progress
            </label>
            <div className="flex gap-2">
              <input
                id="progress"
                type="number"
                min="1"
                required
                value={progressAmount || ''}
                onChange={(e) => setProgressAmount(parseInt(e.target.value) || 0)}
                className="flex-1 px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg focus:outline-none focus:border-solo-accent"
                placeholder="Enter amount"
                disabled={loading}
              />
              <div className="px-3 py-2 bg-solo-bg border border-gray-700 rounded-lg text-gray-400">
                {task.goal_unit || 'units'}
              </div>
            </div>
            {progressAmount > 0 && (
              <div className="text-xs text-gray-400 mt-1">
                New total: {currentProgress + progressAmount} / {targetProgress}
                {currentProgress + progressAmount >= targetProgress && (
                  <span className="text-green-400 ml-2">✓ Goal will be completed!</span>
                )}
              </div>
            )}
          </div>

          {/* Quick Add Buttons */}
          <div>
            <div className="text-xs text-gray-400 mb-2">Quick Add:</div>
            <div className="flex gap-2">
              {[10, 25, 50, 100].map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setProgressAmount(amount)}
                  className="flex-1 px-2 py-1 text-sm bg-solo-bg border border-gray-700 rounded hover:border-solo-accent transition-colors"
                  disabled={loading}
                >
                  +{amount}
                </button>
              ))}
            </div>
          </div>
          </div>

          {/* Submit Button - Fixed at bottom */}
          <div className="p-6 border-t border-gray-800 bg-solo-primary">
            <button
            type="submit"
            disabled={loading || progressAmount <= 0}
            className="w-full py-3 bg-gradient-to-r from-solo-accent to-solo-secondary rounded-lg font-semibold hover:shadow-lg hover:shadow-solo-accent/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading && <ButtonLoader />}
            {loading ? 'Updating...' : 'Update Progress'}
          </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UpdateProgressModal;