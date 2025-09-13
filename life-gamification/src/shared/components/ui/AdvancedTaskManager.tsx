import { useState, useMemo, useCallback } from 'react'
import {
  CheckSquare,
  Filter,
  Search,
  MoreVertical,
  Check,
  Archive,
  Trash2,
  Star,
  Calendar,
  Tag,
  SortAsc,
  SortDesc,
  Grid,
  List,
  X,
  ChevronDown,
  Zap,
  Target,
  Clock,
  AlertTriangle
} from 'lucide-react'
import type { Task } from '../../../types'
import { useGameStore } from '../../../store/gameStore'
import { useTaskPreferences } from '../../../store/preferencesStore'
import { useToast } from './Toast'
import { FadeIn, StaggeredList } from './AnimatedComponents'
import { ButtonLoader } from './LoadingSpinner'

interface AdvancedTaskManagerProps {
  tasks: Task[]
  onTaskAction: (action: string, taskIds: number[]) => Promise<void>
  onRefresh: () => void
  className?: string
}

type ViewMode = 'grid' | 'list'
type SortOption = 'created' | 'due' | 'priority' | 'difficulty' | 'title' | 'category'
type FilterCategory = 'all' | 'active' | 'completed' | 'overdue' | 'today' | 'week'

interface SmartFilter {
  id: string
  name: string
  description: string
  icon: any
  color: string
  filter: (task: Task) => boolean
}

const AdvancedTaskManager = ({ 
  tasks, 
  onTaskAction, 
  onRefresh, 
  className = '' 
}: AdvancedTaskManagerProps) => {
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [sortBy, setSortBy] = useState<SortOption>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all')
  const [showFilters, setShowFilters] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())
  const [selectedDifficulties, setSelectedDifficulties] = useState<Set<string>>(new Set())
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  
  const toast = useToast()
  const taskPrefs = useTaskPreferences()

  // Smart filters for enhanced task management
  const smartFilters: SmartFilter[] = [
    {
      id: 'all',
      name: 'All Tasks',
      description: 'Show all tasks',
      icon: CheckSquare,
      color: 'text-gray-400',
      filter: () => true
    },
    {
      id: 'active',
      name: 'Active',
      description: 'Tasks in progress',
      icon: Zap,
      color: 'text-blue-400',
      filter: (task) => task.status === 'active'
    },
    {
      id: 'completed',
      name: 'Completed',
      description: 'Finished tasks',
      icon: Check,
      color: 'text-green-400',
      filter: (task) => task.status === 'completed'
    },
    {
      id: 'overdue',
      name: 'Overdue',
      description: 'Tasks past due date',
      icon: AlertTriangle,
      color: 'text-red-400',
      filter: (task) => task.due_date && new Date(task.due_date) < new Date() && task.status === 'active'
    },
    {
      id: 'today',
      name: 'Due Today',
      description: 'Tasks due today',
      icon: Calendar,
      color: 'text-yellow-400',
      filter: (task) => {
        if (!task.due_date) return false
        const today = new Date().toDateString()
        return new Date(task.due_date).toDateString() === today
      }
    },
    {
      id: 'week',
      name: 'This Week',
      description: 'Tasks due this week',
      icon: Clock,
      color: 'text-purple-400',
      filter: (task) => {
        if (!task.due_date) return false
        const now = new Date()
        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        const dueDate = new Date(task.due_date)
        return dueDate >= now && dueDate <= weekFromNow
      }
    }
  ]

  // Get unique categories, difficulties, and tags from tasks
  const availableCategories = useMemo(() => 
    [...new Set(tasks.map(task => task.category))].sort()
  , [tasks])

  const availableDifficulties = useMemo(() =>
    [...new Set(tasks.map(task => task.difficulty))].sort()
  , [tasks])

  const availableTags = useMemo(() => {
    const allTags = tasks.flatMap(task => task.tags || [])
    return [...new Set(allTags)].sort()
  }, [tasks])

  // Advanced filtering and sorting logic
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = tasks

    // Apply smart filter
    const smartFilter = smartFilters.find(f => f.id === activeFilter)
    if (smartFilter) {
      filtered = filtered.filter(smartFilter.filter)
    }

    // Apply search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(search) ||
        task.description?.toLowerCase().includes(search) ||
        task.category.toLowerCase().includes(search) ||
        task.tags?.some(tag => tag.toLowerCase().includes(search))
      )
    }

    // Apply category filter
    if (selectedCategories.size > 0) {
      filtered = filtered.filter(task => selectedCategories.has(task.category))
    }

    // Apply difficulty filter
    if (selectedDifficulties.size > 0) {
      filtered = filtered.filter(task => selectedDifficulties.has(task.difficulty))
    }

    // Apply tags filter
    if (selectedTags.size > 0) {
      filtered = filtered.filter(task => 
        task.tags?.some(tag => selectedTags.has(tag))
      )
    }

    // Sort tasks
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'created':
          comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
          break
        case 'due':
          const dateA = a.due_date ? new Date(a.due_date).getTime() : Infinity
          const dateB = b.due_date ? new Date(b.due_date).getTime() : Infinity
          comparison = dateA - dateB
          break
        case 'priority':
          const priorityOrder = { low: 1, medium: 2, high: 3, urgent: 4 }
          comparison = (priorityOrder[a.priority as keyof typeof priorityOrder] || 0) - 
                     (priorityOrder[b.priority as keyof typeof priorityOrder] || 0)
          break
        case 'difficulty':
          const difficultyOrder = { easy: 1, medium: 2, hard: 3, expert: 4 }
          comparison = (difficultyOrder[a.difficulty as keyof typeof difficultyOrder] || 0) - 
                      (difficultyOrder[b.difficulty as keyof typeof difficultyOrder] || 0)
          break
        case 'title':
          comparison = a.title.localeCompare(b.title)
          break
        case 'category':
          comparison = a.category.localeCompare(b.category)
          break
        default:
          comparison = 0
      }

      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [tasks, activeFilter, searchTerm, selectedCategories, selectedDifficulties, selectedTags, sortBy, sortOrder])

  // Handle task selection
  const toggleTaskSelection = useCallback((taskId: number) => {
    setSelectedTasks(prev => {
      const newSelected = new Set(prev)
      if (newSelected.has(taskId)) {
        newSelected.delete(taskId)
      } else {
        newSelected.add(taskId)
      }
      return newSelected
    })
  }, [])

  const selectAllTasks = useCallback(() => {
    setSelectedTasks(new Set(filteredAndSortedTasks.map(task => task.id)))
  }, [filteredAndSortedTasks])

  const deselectAllTasks = useCallback(() => {
    setSelectedTasks(new Set())
  }, [])

  // Bulk operations
  const handleBulkAction = async (action: string) => {
    if (selectedTasks.size === 0) {
      toast.warning('No tasks selected', 'Please select tasks to perform bulk actions')
      return
    }

    setIsLoading(true)
    try {
      await onTaskAction(action, Array.from(selectedTasks))
      
      let actionName = ''
      switch (action) {
        case 'complete': actionName = 'completed'; break
        case 'archive': actionName = 'archived'; break
        case 'delete': actionName = 'deleted'; break
        case 'favorite': actionName = 'favorited'; break
        default: actionName = 'updated'
      }
      
      toast.success(`Tasks ${actionName}!`, `${selectedTasks.size} tasks have been ${actionName}`)
      setSelectedTasks(new Set())
      onRefresh()
    } catch (error) {
      toast.error('Bulk action failed', 'Please try again')
    } finally {
      setIsLoading(false)
    }
  }

  // Clear all filters
  const clearFilters = () => {
    setActiveFilter('all')
    setSearchTerm('')
    setSelectedCategories(new Set())
    setSelectedDifficulties(new Set())
    setSelectedTags(new Set())
  }

  const hasActiveFilters = activeFilter !== 'all' || 
                         searchTerm.trim() !== '' || 
                         selectedCategories.size > 0 || 
                         selectedDifficulties.size > 0 || 
                         selectedTags.size > 0

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Advanced Search and Filters Bar */}
      <div className="bg-theme-primary rounded-lg border border-gray-800 p-4">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Search */}
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks by title, description, category, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-theme-bg border border-gray-700 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-l-lg transition-colors ${
                viewMode === 'list' ? 'bg-theme-accent/20 text-theme-accent' : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-r-lg transition-colors ${
                viewMode === 'grid' ? 'bg-theme-accent/20 text-theme-accent' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-2 bg-theme-bg border border-gray-700 rounded-lg focus:outline-none focus:border-theme-accent text-sm"
            >
              <option value="created">Created Date</option>
              <option value="due">Due Date</option>
              <option value="priority">Priority</option>
              <option value="difficulty">Difficulty</option>
              <option value="title">Title</option>
              <option value="category">Category</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-2 bg-theme-bg border border-gray-700 rounded-lg hover:bg-gray-700 transition-colors"
            >
              {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
            </button>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-theme-accent/20 text-theme-accent border-theme-accent/30'
                : 'bg-theme-bg border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-theme-accent rounded-full"></span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <FadeIn className="mt-4 pt-4 border-t border-gray-700">
            <div className="space-y-4">
              {/* Smart Filters */}
              <div>
                <label className="block text-sm font-medium mb-2">Smart Filters</label>
                <div className="flex flex-wrap gap-2">
                  {smartFilters.map((filter) => {
                    const Icon = filter.icon
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setActiveFilter(filter.id as FilterCategory)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeFilter === filter.id
                            ? 'bg-theme-accent/20 text-theme-accent border border-theme-accent/30'
                            : 'bg-theme-bg border border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${filter.color}`} />
                        {filter.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Categories</label>
                <div className="flex flex-wrap gap-2">
                  {availableCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategories(prev => {
                          const newSelected = new Set(prev)
                          if (newSelected.has(category)) {
                            newSelected.delete(category)
                          } else {
                            newSelected.add(category)
                          }
                          return newSelected
                        })
                      }}
                      className={`px-3 py-1 rounded-full text-xs transition-colors ${
                        selectedCategories.has(category)
                          ? 'bg-theme-accent/20 text-theme-accent border border-theme-accent/30'
                          : 'bg-theme-bg border border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty Filter */}
              <div>
                <label className="block text-sm font-medium mb-2">Difficulty</label>
                <div className="flex flex-wrap gap-2">
                  {availableDifficulties.map((difficulty) => (
                    <button
                      key={difficulty}
                      onClick={() => {
                        setSelectedDifficulties(prev => {
                          const newSelected = new Set(prev)
                          if (newSelected.has(difficulty)) {
                            newSelected.delete(difficulty)
                          } else {
                            newSelected.add(difficulty)
                          }
                          return newSelected
                        })
                      }}
                      className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                        selectedDifficulties.has(difficulty)
                          ? 'bg-theme-accent/20 text-theme-accent border border-theme-accent/30'
                          : 'bg-theme-bg border border-gray-700 text-gray-400 hover:text-white'
                      }`}
                    >
                      {difficulty}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags Filter */}
              {availableTags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {availableTags.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setSelectedTags(prev => {
                            const newSelected = new Set(prev)
                            if (newSelected.has(tag)) {
                              newSelected.delete(tag)
                            } else {
                              newSelected.add(tag)
                            }
                            return newSelected
                          })
                        }}
                        className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs transition-colors ${
                          selectedTags.has(tag)
                            ? 'bg-theme-accent/20 text-theme-accent border border-theme-accent/30'
                            : 'bg-theme-bg border border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Clear Filters */}
              {hasActiveFilters && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>
          </FadeIn>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedTasks.size > 0 && (
        <FadeIn>
          <div className="bg-theme-accent/10 border border-theme-accent/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-theme-accent font-medium">
                  {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllTasks}
                    className="text-sm text-theme-accent hover:underline"
                  >
                    Select All ({filteredAndSortedTasks.length})
                  </button>
                  <span className="text-gray-400">|</span>
                  <button
                    onClick={deselectAllTasks}
                    className="text-sm text-theme-accent hover:underline"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction('complete')}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading && <ButtonLoader />}
                  <Check className="w-4 h-4" />
                  Complete
                </button>
                <button
                  onClick={() => handleBulkAction('archive')}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Archive className="w-4 h-4" />
                  Archive
                </button>
                <button
                  onClick={() => handleBulkAction('favorite')}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Star className="w-4 h-4" />
                  Favorite
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          Showing {filteredAndSortedTasks.length} of {tasks.length} tasks
          {hasActiveFilters && ' (filtered)'}
        </span>
        <div className="flex items-center gap-4">
          <span>Sort: {sortBy} ({sortOrder})</span>
          <span>View: {viewMode}</span>
        </div>
      </div>

      {/* Task List/Grid */}
      <div className={`${
        viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' 
          : 'space-y-4'
      }`}>
        {filteredAndSortedTasks.length === 0 ? (
          <div className="col-span-full">
            <FadeIn>
              <div className="bg-theme-primary rounded-lg border border-gray-800 p-8 text-center">
                <CheckSquare className="w-12 h-12 mx-auto mb-4 text-gray-400 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
                <p className="text-gray-400 mb-4">
                  {hasActiveFilters
                    ? "Try adjusting your filters or search terms."
                    : "Create your first task to get started!"}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-4 py-2 bg-theme-accent/20 text-theme-accent rounded-lg hover:bg-theme-accent/30 transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            </FadeIn>
          </div>
        ) : (
          <StaggeredList delay={50}>
            {filteredAndSortedTasks.map((task) => (
              <TaskListItem
                key={task.id}
                task={task}
                isSelected={selectedTasks.has(task.id)}
                onToggleSelect={() => toggleTaskSelection(task.id)}
                viewMode={viewMode}
              />
            ))}
          </StaggeredList>
        )}
      </div>
    </div>
  )
}

interface TaskListItemProps {
  task: Task
  isSelected: boolean
  onToggleSelect: () => void
  viewMode: ViewMode
}

const TaskListItem = ({ task, isSelected, onToggleSelect, viewMode }: TaskListItemProps) => {
  return (
    <div className={`bg-theme-primary rounded-lg border transition-all duration-200 hover:shadow-lg hover:shadow-theme-accent/10 ${
      isSelected 
        ? 'border-theme-accent/50 bg-theme-accent/5' 
        : 'border-gray-800 hover:border-gray-700'
    } ${viewMode === 'grid' ? 'p-4' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        {/* Selection Checkbox */}
        <button
          onClick={onToggleSelect}
          className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? 'bg-theme-accent border-theme-accent text-white'
              : 'border-gray-600 hover:border-theme-accent'
          }`}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold truncate ${
                task.status === 'completed' ? 'text-gray-400 line-through' : ''
              }`}>
                {task.title}
              </h3>
              {task.description && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
            
            {/* Task Status Badge */}
            <span className={`px-2 py-1 text-xs rounded-full flex-shrink-0 ${
              task.status === 'completed'
                ? 'bg-green-500/20 text-green-400'
                : task.due_date && new Date(task.due_date) < new Date()
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {task.status === 'completed' 
                ? 'Completed' 
                : task.due_date && new Date(task.due_date) < new Date()
                ? 'Overdue'
                : 'Active'
              }
            </span>
          </div>

          {/* Task Metadata */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
            <span className="capitalize">{task.category}</span>
            <span className="capitalize">{task.difficulty}</span>
            {task.due_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              {task.base_experience_reward} XP
            </span>
          </div>

          {/* Task Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {task.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs bg-gray-700/50 text-gray-300 rounded"
                >
                  {tag}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="px-2 py-1 text-xs bg-gray-700/50 text-gray-300 rounded">
                  +{task.tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AdvancedTaskManager