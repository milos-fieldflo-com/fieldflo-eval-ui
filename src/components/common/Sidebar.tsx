import { useLocation, Link } from 'react-router-dom'
import './Sidebar.css'

export function Sidebar() {
  const location = useLocation()
  const isActive = (path: string) => location.pathname.startsWith(path)

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span className="sidebar-logo-text">FieldFlo</span>
        <span className="sidebar-logo-sub">Evals</span>
      </div>
      <nav className="sidebar-nav">
        <Link
          to="/sessions"
          className={`sidebar-nav-item ${isActive('/sessions') ? 'active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Sessions
        </Link>
        <Link
          to="/evaluations"
          className={`sidebar-nav-item ${isActive('/evaluations') ? 'active' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          Evaluations
        </Link>
      </nav>
    </aside>
  )
}
