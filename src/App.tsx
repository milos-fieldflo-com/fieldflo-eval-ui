import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './components/common/Sidebar'
import { Topbar } from './components/common/Topbar'
import { SessionsPage } from './components/pages/SessionsPage'
import { SessionDetailPage } from './components/pages/SessionDetailPage'

function App() {
  const location = useLocation()

  const getTopbar = () => {
    if (location.pathname === '/sessions') {
      return { title: 'Eval Sessions', subtitle: 'Browse evaluation results' }
    }
    if (location.pathname.startsWith('/sessions/')) {
      return { title: 'Session Detail', subtitle: 'Evaluation results and evidence' }
    }
    return { title: 'Eval Sessions', subtitle: '' }
  }

  const topbar = getTopbar()

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <Topbar title={topbar.title} subtitle={topbar.subtitle} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/sessions" replace />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
