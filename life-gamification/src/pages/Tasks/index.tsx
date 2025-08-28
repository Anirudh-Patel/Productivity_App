import { useState, useEffect } from 'react';
import { Plus, Filter, Search, CheckSquare, Sword, Clock, Star } from 'lucide-react'
import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_LEVELS } from '../../types';
import type { Task } from '../../types';
import CreateTaskModal from '../../shared/components/ui/CreateTaskModal';

const Tasks = () => {
  const { tasks, fetchTasks, completeTask } = useGameStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
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
            />
          ))
        )}
      </div>

      <CreateTaskModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  )
}

interface TaskCardProps {
  task: Task;
  onComplete: () => void;
}

const TaskCard = ({ task, onComplete }: TaskCardProps) => {
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
            {task.completed_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(task.completed_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        
        {task.status === 'active' && (
          <button
            onClick={onComplete}
            className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
          >
            Complete
          </button>
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