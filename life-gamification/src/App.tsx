import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './shared/components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Stats from './pages/Stats'
import Shop from './pages/Shop'
import Settings from './pages/Settings'
import { ErrorBoundary } from './shared/components/ui/ErrorBoundary'
import { ToastProvider } from './shared/components/ui/Toast'
import { logger } from './utils/logger'
import { startMemoryMonitoring } from './utils/performance'
import './App.css'

function App() {
  // Log app initialization
  logger.info('App initialized', { timestamp: new Date().toISOString() }, 'App');
  
  // Start memory monitoring in development
  if (process.env.NODE_ENV === 'development') {
    startMemoryMonitoring(30000); // Monitor every 30 seconds
  }
  
  return (
    <ErrorBoundary>
      <ToastProvider>
        <HashRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<Tasks />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </HashRouter>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App