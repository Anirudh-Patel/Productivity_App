import { useState, useEffect } from 'react';
import { Plus, Filter, Search, CheckSquare, Sword, Clock, Star, TrendingUp } from 'lucide-react'
import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_LEVELS } from '../../types';
import type { Task } from '../../types';
import CreateTaskModal from '../../shared/components/ui/CreateTaskModal';
import UpdateProgressModal from '../../shared/components/ui/UpdateProgressModal';

const Tasks = () => {
  const { tasks, fetchTasks, completeTask } = useGameStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [progressModal, setProgressModal] = useState<{ isOpen: boolean; task: Task | null }>({ 
    isOpen: false, 
    task: null 
  });
  const [filter, setFilter] = useState<string>('active');

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleCompleteTask = async (taskId: number) => {
    try {
      await completeTask(taskId);
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const filteredTasks = filter === 'completed' ? tasks.completed : tasks.active;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quests</h1>
          <p className="text-gray-400">Manage your daily quests and challenges</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-opacity">
          <Plus className="w-5 h-5" />
          <span>New Quest</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search quests..."
            className="w-full pl-10 pr-4 py-2 bg-solo-primary border border-gray-800 rounded-lg focus:outline-none focus:border-solo-accent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-solo-primary border border-gray-800 rounded-lg hover:bg-solo-bg transition-colors">
          <Filter className="w-5 h-5" />
          <span>Filter</span>
        </button>
      </div>

      {/* Task Categories */}
      <div className="flex gap-2">
        {['active', 'completed'].map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={`px-4 py-2 rounded-lg transition-colors capitalize ${
              category === filter
                ? 'bg-solo-accent/20 text-solo-accent border border-solo-accent/30'
                : 'bg-solo-primary text-gray-400 hover:text-solo-text border border-gray-800'
            }`}
          >
            {category} ({category === 'active' ? tasks.active.length : tasks.completed.length})
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.loading ? (
          <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
            <div className="text-center py-12 text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-solo-accent border-t-transparent rounded-full mx-auto mb-3" />
              <p>Loading quests...</p>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
            <div className="text-center py-12 text-gray-400">
              <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No {filter} quests</p>
              <p className="text-sm mt-2">
                {filter === 'active' 
                  ? 'Create your first quest to begin your journey!' 
                  : 'Complete some quests to see them here!'}
              </p>
            </div>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard 
              key={task.id} 
              task={task} 
              onComplete={() => handleCompleteTask(task.id)}
              onUpdateProgress={() => setProgressModal({ isOpen: true, task })} 
            />
          ))
        )}
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
      
      {progressModal.task && (
        <UpdateProgressModal
          isOpen={progressModal.isOpen}
          onClose={() => setProgressModal({ isOpen: false, task: null })}
          task={progressModal.task}
        />
      )}
    </div>
  )
}

interface TaskCardProps {
  task: Task;
  onComplete: () => void;
  onUpdateProgress: () => void;
}

const TaskCard = ({ task, onComplete, onUpdateProgress }: TaskCardProps) => {
  const difficultyInfo = DIFFICULTY_LEVELS[task.difficulty as keyof typeof DIFFICULTY_LEVELS];
  
  return (
    <div className="bg-solo-primary rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-lg font-semibold">{task.title}</h3>
            <span className={`text-xs px-2 py-1 rounded ${difficultyInfo.color} bg-opacity-20`}>
              {difficultyInfo.label}
            </span>
          </div>
          
          {task.description && (
            <p className="text-gray-400 text-sm mb-3">{task.description}</p>
          )}
          
          {/* Progress bar for goal-based tasks */}
          {task.task_type === 'goal' && task.goal_target && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progress</span>
                <span>
                  {task.goal_current || 0} / {task.goal_target} {task.goal_unit || 'units'}
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-solo-accent to-solo-secondary transition-all duration-500"
                  style={{ 
                    width: `${Math.min(100, ((task.goal_current || 0) / task.goal_target) * 100)}%` 
                  }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1 text-right">
                {Math.min(100, ((task.goal_current || 0) / task.goal_target) * 100).toFixed(1)}% Complete
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <Sword className="w-4 h-4" />
              {task.base_experience_reward} XP
            </span>
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500" />
              {task.gold_reward} Gold
            </span>
            <span className="capitalize">{task.category}</span>
            {task.task_type === 'goal' && (
              <span className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                Goal Quest
              </span>
            )}
            {task.completed_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(task.completed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        {task.status === 'active' && (
          <div className="ml-4 flex flex-col gap-2">
            {task.task_type === 'goal' ? (
              <button
                onClick={onUpdateProgress}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Update Progress
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Complete
              </button>
            )}
          </div>
        )}
        
        {task.status === 'completed' && (
          <div className="ml-4 px-4 py-2 bg-green-600/20 text-green-400 rounded-lg border border-green-600/30">
            ✓ Completed
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks