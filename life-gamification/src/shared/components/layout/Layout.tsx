import { ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useGlobalShortcuts } from '../../../hooks/useKeyboardShortcuts'
import KeyboardShortcutsModal from '../ui/KeyboardShortcutsModal'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const navigate = useNavigate();

  // Global keyboard shortcuts
  const shortcuts = useGlobalShortcuts({
    openNewQuest: () => navigate('/tasks?new=true'),
    toggleSidebar: () => setSidebarCollapsed(!sidebarCollapsed),
    openHelp: () => setShowShortcuts(true)
  });

  return (
    <>
      <div className="flex h-screen bg-theme-bg text-theme-fg">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex-1 flex flex-col">
          <Header onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
      
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
        shortcuts={shortcuts}
      />
    </>
  )
}

export default Layout