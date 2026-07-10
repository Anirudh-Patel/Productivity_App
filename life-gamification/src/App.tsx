import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './shared/components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Stats from './pages/Stats'
import SkillTreePage from './pages/SkillTree'
import Equipment from './pages/Equipment'
import Inventory from './pages/Inventory'
import Shop from './pages/Shop'
import Settings from './pages/Settings'
import Calendar from './pages/Calendar'
import Finance from './pages/Finance'
import { ErrorBoundary } from './shared/components/ui/ErrorBoundary'
import { ToastProvider } from './shared/components/ui/Toast'
import { ThemeProvider } from './contexts/ThemeContext'
import { NotificationProvider } from './providers/NotificationProvider'
import { VisualEffectsProvider, EffectsTestPanel } from './shared/components/ui/VisualEffectsManager'
import { AudioProvider } from './shared/components/audio/AudioManager'
import { LayoutDebugger } from './shared/components/debug/LayoutDebugger'
import KeyboardShortcutsModal from './shared/components/ui/KeyboardShortcutsModal'
import { CommandPalette, useCommandPalette } from './shared/components/ui/CommandPalette'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useAdvancedPreferences } from './store/preferencesStore'
import { logger } from './utils/logger'
import { startMemoryMonitoring } from './utils/performance'
import { initializeAccessibility } from './utils/accessibility'
import { useEffect } from 'react'
import './App.css'

// Component to initialize features inside Router context
function AppContent() {
  // Initialize keyboard shortcuts (now inside Router context)
  useKeyboardShortcuts([], { enabled: true, showNotifications: false });
  
  // Initialize command palette
  const { isOpen: commandPaletteOpen, setIsOpen: setCommandPaletteOpen } = useCommandPalette();
  
  // Get advanced preferences for debugging tools
  const { showLayoutDebugger, showEffectsPanel } = useAdvancedPreferences();

  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/finance" element={<Finance />} />
          <Route path="/skills" element={<SkillTreePage />} />
          <Route path="/equipment" element={<Equipment />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
      {/* Global UI Components */}
      <KeyboardShortcutsModal />
      <CommandPalette 
        isOpen={commandPaletteOpen} 
        onOpenChange={setCommandPaletteOpen} 
      />
      {process.env.NODE_ENV === 'development' && showLayoutDebugger && <LayoutDebugger />}
      {process.env.NODE_ENV === 'development' && showEffectsPanel && <EffectsTestPanel />}
    </>
  )
}

function App() {
  // Log app initialization
  logger.info('App initialized', { timestamp: new Date().toISOString() }, 'App');
  
  // Initialize accessibility features
  useEffect(() => {
    initializeAccessibility();
    logger.info('Accessibility features initialized', {}, 'App');
  }, []);
  
  // Start memory monitoring in development
  if (process.env.NODE_ENV === 'development') {
    startMemoryMonitoring(30000); // Monitor every 30 seconds
  }
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AudioProvider>
          <VisualEffectsProvider>
            <ToastProvider>
              <NotificationProvider>
                <HashRouter>
                  <AppContent />
                </HashRouter>
              </NotificationProvider>
            </ToastProvider>
          </VisualEffectsProvider>
        </AudioProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App