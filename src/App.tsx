import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { Sidebar } from './components/common/Sidebar'
import { Topbar } from './components/common/Topbar'
import { SessionsPage } from './components/pages/SessionsPage'
import { SessionDetailPage } from './components/pages/SessionDetailPage'
import { TracesPage } from './components/pages/TracesPage'

function App() {
  const location = useLocation()

  const getTopbar = () => {
    if (location.pathname === '/evaluations') {
      return { title: 'Evaluations', subtitle: 'Browse evaluation results' }
    }
    if (location.pathname.startsWith('/evaluations/')) {
      return { title: 'Evaluation Detail', subtitle: 'Evaluation results and evidence' }
    }
    if (location.pathname === '/sessions') {
      return { title: 'Sessions', subtitle: 'Langfuse JHA chat sessions' }
    }
    return { title: 'FieldFlo Evals', subtitle: '' }
  }

  const topbar = getTopbar()

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <Topbar title={topbar.title} subtitle={topbar.subtitle} />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/evaluations" replace />} />
            <Route path="/evaluations" element={<SessionsPage />} />
            <Route path="/evaluations/:sessionId" element={<SessionDetailPage />} />
            <Route path="/sessions" element={<TracesPage />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default App
