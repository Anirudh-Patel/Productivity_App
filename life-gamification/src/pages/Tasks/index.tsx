import { Plus, Filter, Search, CheckSquare } from 'lucide-react'

const Tasks = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Quests</h1>
          <p className="text-gray-400">Manage your daily quests and challenges</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-solo-accent to-solo-secondary text-white rounded-lg hover:opacity-90 transition-opacity">
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
        {['All', 'Daily', 'Habits', 'To-Do', 'Challenges'].map((category) => (
          <button
            key={category}
            className={`px-4 py-2 rounded-lg transition-colors ${
              category === 'All'
                ? 'bg-solo-accent/20 text-solo-accent border border-solo-accent/30'
                : 'bg-solo-primary text-gray-400 hover:text-solo-text border border-gray-800'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="bg-solo-primary rounded-lg border border-gray-800 p-6">
        <div className="text-center py-12 text-gray-400">
          <CheckSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No quests available</p>
          <p className="text-sm mt-2">Create your first quest to begin your journey!</p>
        </div>
      </div>
    </div>
  )
}

export default Tasks