import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Filter, Search, CheckSquare, Sword, Clock, Star, TrendingUp } from 'lucide-react'
import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_LEVELS } from '../../types';
import type { Task } from '../../types';
import CreateTaskModal from '../../shared/components/ui/CreateTaskModal';
import UpdateProgressModal from '../../shared/components/ui/UpdateProgressModal';
import { SkeletonCard } from '../../shared/components/ui/Skeleton';
import { ButtonLoader } from '../../shared/components/ui/LoadingSpinner';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { FadeIn, StaggeredList, AnimatedProgressBar } from '../../shared/components/ui/AnimatedComponents';
import { useToast } from '../../shared/components/ui/Toast';
import { logger, logUserAction } from '../../utils/logger';
import { useRenderPerformance, PerformanceMonitor, useDebounce } from '../../utils/performance';

const Tasks = () => {
  // Performance monitoring
  useRenderPerformance('Tasks', process.env.NODE_ENV === 'development');
  
  const { tasks, fetchTasks, completeTask } = useGameStore();
  const [searchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(searchParams.get('new') === 'true');
  const toast = useToast();
  const [progressModal, setProgressModal] = useState<{ isOpen: boolean; task: Task | null }>({ 
    isOpen: false, 
    task: null 
  });
  const [loadingTaskId, setLoadingTaskId] = useState<number | null>(null);
  const [filter, setFilter] = useState<string>('active');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Debounce search term to improve performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Task-specific keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'n',
      action: () => setIsModalOpen(true),
      description: 'Create new quest',
      category: 'Actions'
    },
    {
      key: 'Escape',
      action: () => {
        setIsModalOpen(false);
        setProgressModal({ isOpen: false, task: null });
      },
      description: 'Close modals',
      category: 'Interface'
    }
  ]);

  const handleCompleteTask = async (taskId: number) => {
    setLoadingTaskId(taskId);
    logUserAction('completeTask', { taskId }, 'Tasks');
    
    // Measure task completion performance
    const result = await PerformanceMonitor.measureAsync(
      `completeTask_${taskId}`,
      async () => {
        try {
          await completeTask(taskId);
          toast.success('Quest completed!', 'XP and gold have been awarded.');
          logger.info('Task completed successfully', { taskId }, 'Tasks');
        } catch (error: any) {
          logger.error('Failed to complete task', { error: error.message, taskId }, 'Tasks');
          toast.error('Failed to complete quest', error.userMessage || 'Please try again.');
          throw error;
        }
      },
      200 // Log if operation takes longer than 200ms
    );
    
    setLoadingTaskId(null);
  };

  // Filter and search tasks with performance consideration
  const filteredTasks = (() => {
    let taskList = filter === 'completed' ? tasks.completed : tasks.active;
    
    // Apply search filter if search term exists
    if (debouncedSearchTerm.trim()) {
      taskList = taskList.filter(task => 
        task.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        task.category.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }
    
    return taskList;
  })();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quests</h1>
          <p className="text-gray-400">Manage your daily quests and challenges</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 hover:scale-105 transition-all duration-200 hover:shadow-lg hover:shadow-solo-accent/25"
          title="Create new quest (Ctrl+N or N)">
          <Plus className="w-5 h-5" />
          <span>New Quest</span>
          <kbd className="hidden md:inline-block ml-2 px-1.5 py-0.5 text-xs font-mono bg-white/20 rounded">N</kbd>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search quests..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
          <FadeIn direction="up">
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </FadeIn>
        ) : filteredTasks.length === 0 ? (
          <FadeIn direction="up" delay={200}>
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
          </FadeIn>
        ) : (
          <StaggeredList delay={100}>
            {filteredTasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task} 
                onComplete={() => handleCompleteTask(task.id)}
                onUpdateProgress={() => setProgressModal({ isOpen: true, task })}
                isLoading={loadingTaskId === task.id} 
              />
            ))}
          </StaggeredList>
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
  isLoading?: boolean;
}

const TaskCard = ({ task, onComplete, onUpdateProgress, isLoading = false }: TaskCardProps) => {
  // Performance monitoring for individual task cards
  useRenderPerformance(`TaskCard_${task.id}`, process.env.NODE_ENV === 'development');
  
  const difficultyInfo = DIFFICULTY_LEVELS[task.difficulty as keyof typeof DIFFICULTY_LEVELS];
  
  return (
    <div className="bg-solo-primary rounded-lg border border-gray-800 p-4 hover:border-gray-700 hover:shadow-lg hover:shadow-solo-accent/10 transition-all duration-300 hover:-translate-y-1">
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
              <AnimatedProgressBar
                progress={((task.goal_current || 0) / task.goal_target) * 100}
                duration={800}
              />
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
                disabled={isLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading && <ButtonLoader />}
                {isLoading ? 'Completing...' : 'Complete'}
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