import { useState, useEffect, useRef } from 'react'
import { X, Keyboard, Search, Navigation, Settings, Zap, BookOpen, Target, Gamepad2, Eye, Sparkles } from 'lucide-react'
import { useKeyboardShortcuts, formatShortcut } from '../../../hooks/useKeyboardShortcuts'
import { FadeIn } from './AnimatedComponents'

const KeyboardShortcutsModal = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  const { getShortcutsByCategory, shortcutsEnabled, setShortcutsEnabled } = useKeyboardShortcuts()
  const allShortcuts = getShortcutsByCategory()

  // Filter shortcuts based on search term and selected category
  const filteredShortcuts = Object.entries(allShortcuts).reduce((acc, [category, shortcuts]) => {
    const filtered = shortcuts.filter(shortcut =>
      shortcut.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shortcut.keyCombo.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    if (filtered.length > 0 && (!selectedCategory || category === selectedCategory)) {
      acc[category] = filtered
    }
    return acc
  }, {} as Record<string, typeof allShortcuts[string]>)

  // Handle modal open/close events
  useEffect(() => {
    const handleToggle = () => {
      setIsOpen(!isOpen)
      if (!isOpen) {
        // Focus search input when opening
        setTimeout(() => searchInputRef.current?.focus(), 100)
      }
    }
    
    const handleClose = () => setIsOpen(false)
    
    window.addEventListener('toggle-keyboard-help', handleToggle)
    window.addEventListener('close-all-modals', handleClose)
    
    return () => {
      window.removeEventListener('toggle-keyboard-help', handleToggle)
      window.removeEventListener('close-all-modals', handleClose)
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
      // Allow Ctrl+K to focus search when modal is open
      if (event.ctrlKey && event.key === 'k' && isOpen) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!isOpen) return null

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'navigation':
        return <Navigation className="w-4 h-4" />
      case 'tasks':
        return <Target className="w-4 h-4" />
      case 'ui':
        return <Settings className="w-4 h-4" />
      case 'accessibility':
        return <Eye className="w-4 h-4" />
      case 'gaming':
        return <Gamepad2 className="w-4 h-4" />
      default:
        return <Keyboard className="w-4 h-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'navigation':
        return 'text-blue-400'
      case 'tasks':
        return 'text-green-400'
      case 'ui':
        return 'text-purple-400'
      case 'accessibility':
        return 'text-orange-400'
      case 'gaming':
        return 'text-pink-400'
      default:
        return 'text-gray-400'
    }
  }

  const categories = Object.keys(allShortcuts)
  const totalShortcuts = Object.values(allShortcuts).reduce((sum, shortcuts) => sum + shortcuts.length, 0)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <FadeIn>
        <div className="bg-theme-primary rounded-lg border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gradient-to-r from-theme-primary to-gray-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-theme-accent/20 rounded-lg">
                <Keyboard className="w-6 h-6 text-theme-accent" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
                <p className="text-sm text-gray-400">
                  {totalShortcuts} shortcuts available • {shortcutsEnabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShortcutsEnabled(!shortcutsEnabled)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  shortcutsEnabled 
                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' 
                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                }`}
              >
                {shortcutsEnabled ? 'Enabled' : 'Disabled'}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex h-full max-h-[calc(90vh-120px)]">
            {/* Category Sidebar */}
            <div className="w-48 bg-theme-bg border-r border-gray-800 p-4 overflow-y-auto">
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    selectedCategory === null
                      ? 'bg-theme-accent/20 text-theme-accent'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  All Categories
                </button>
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      selectedCategory === category
                        ? 'bg-theme-accent/20 text-theme-accent'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <span className={getCategoryColor(category)}>
                      {getCategoryIcon(category)}
                    </span>
                    <span className="capitalize">{category}</span>
                    <span className="ml-auto text-xs bg-gray-700 px-1.5 py-0.5 rounded">
                      {allShortcuts[category].length}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
              {/* Search Bar */}
              <div className="p-4 border-b border-gray-800">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search shortcuts... (Ctrl+K)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-theme-bg border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-theme-accent focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Shortcuts List */}
              <div className="flex-1 p-4 overflow-y-auto">
                {Object.keys(filteredShortcuts).length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Keyboard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No shortcuts found</p>
                    <p className="text-sm mt-1">Try adjusting your search terms</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(filteredShortcuts).map(([category, shortcuts]) => (
                      <div key={category}>
                        <h3 className={`flex items-center gap-2 text-lg font-semibold mb-4 ${getCategoryColor(category)}`}>
                          {getCategoryIcon(category)}
                          <span className="capitalize">{category}</span>
                          <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                            {shortcuts.length}
                          </span>
                        </h3>
                        <div className="grid gap-2">
                          {shortcuts.map((shortcut, index) => (
                            <div 
                              key={index} 
                              className="flex items-center justify-between p-4 bg-theme-bg rounded-lg hover:bg-gray-800/70 transition-colors group"
                            >
                              <div className="flex-1">
                                <span className="text-sm font-medium">{shortcut.description}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <kbd className="px-3 py-1.5 bg-gradient-to-r from-gray-700 to-gray-600 rounded-lg text-xs font-mono text-gray-200 border border-gray-600 shadow-sm group-hover:from-gray-600 group-hover:to-gray-500 transition-colors">
                                  {shortcut.keyCombo}
                                </kbd>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-theme-bg border-t border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-4">
                <span>Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs mx-1">Ctrl + /</kbd> to toggle</span>
                <span>Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs mx-1">Ctrl + K</kbd> to search</span>
                <span>Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs mx-1">Esc</kbd> to close</span>
              </div>
              <div>
                Shortcuts can be toggled with <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-xs mx-1">Ctrl + Shift + H</kbd>
              </div>
            </div>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

export default KeyboardShortcutsModal