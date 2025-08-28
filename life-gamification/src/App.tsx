import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './shared/components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Tasks from './pages/Tasks'
import Stats from './pages/Stats'
import Shop from './pages/Shop'
import Settings from './pages/Settings'
import './App.css'

function App() {
  return (
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
  )
}

export default App