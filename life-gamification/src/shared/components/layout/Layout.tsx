import { ReactNode, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useGlobalShortcuts } from '../../../hooks/useKeyboardShortcuts'
import { useGithubSync } from '../../../hooks/useGithubSync'
import { useHealthSync } from '../../../hooks/useHealthSync'
import { useCaptureSync } from '../../../hooks/useCaptureSync'
import { useRemindersSync } from '../../../hooks/useRemindersSync'
import { useConnectionsSync } from '../../../hooks/useConnectionsSync'
import KeyboardShortcutsModal from '../ui/KeyboardShortcutsModal'
import TimerWidget from '../ui/TimerWidget'

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  // GitHub issues -> tasks sync (on start + every 30 min)
  useGithubSync();

  // Apple Health workout scan -> fitness quest verification (on start + every 15 min)
  useHealthSync();

  // Quick-capture inbox scan -> quests (on start + every 5 min)
  useCaptureSync();
  // Apple Reminders -> quests sync (on start + every 15 min)
  useRemindersSync();

  // Live connections (SimpleFIN bank sync) — on start + every 6 h
  useConnectionsSync();

  // Global keyboard shortcuts. The shortcuts modal manages its own visibility
  // via the 'toggle-keyboard-help' window event.
  useGlobalShortcuts({
    openNewQuest: () => navigate('/tasks?new=true'),
    toggleSidebar: () => setSidebarCollapsed(!sidebarCollapsed),
    openHelp: () => window.dispatchEvent(new CustomEvent('toggle-keyboard-help'))
  });

  return (
    <>
      <div className="grid grid-cols-[auto_1fr] h-screen bg-theme-bg text-theme-fg">
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="flex flex-col h-full overflow-hidden">
          <Header onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)} />
          <main className="flex-1 p-6 overflow-y-auto bg-theme-bg">
            {children}
          </main>
        </div>
      </div>
      
      <KeyboardShortcutsModal />

      <TimerWidget />
    </>
  )
}

export default Layout