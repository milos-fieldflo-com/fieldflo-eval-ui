import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listSessions } from '../../api/client'
import type { SessionSummary } from '../../api/types'
import { ScorePill } from '../evaluation/ScorePill'
import { truncateId, formatDate } from '../../utils/format'
import './SessionsPage.css'

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading sessions...</p>
      </div>
    )
  }

  if (error) {
    return <div className="error-message">Failed to load sessions: {error}</div>
  }

  return (
    <div className="sessions-page">
      <div className="sessions-table-wrapper">
        <table className="sessions-table">
          <thead>
            <tr>
              <th>Video</th>
              <th>Session ID</th>
              <th>Date Evaluated</th>
              <th>Groundedness</th>
              <th>Completeness</th>
              <th>Form Ground.</th>
              <th>Form Compl.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td className="sessions-video-cell">
                  {s.thumbnail_url ? (
                    <img
                      src={s.thumbnail_url}
                      alt=""
                      className="sessions-thumbnail"
                    />
                  ) : (
                    <div className="sessions-thumbnail-placeholder">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    </div>
                  )}
                  <span className="sessions-video-name">{s.video_name || 'No video'}</span>
                </td>
                <td className="sessions-id-cell" title={s.id}>
                  {truncateId(s.id)}
                </td>
                <td>{formatDate(s.evaluated_at)}</td>
                <td><ScorePill score={s.scores.groundedness} /></td>
                <td><ScorePill score={s.scores.completeness} /></td>
                <td><ScorePill score={s.scores.form_groundedness} /></td>
                <td><ScorePill score={s.scores.form_completeness} /></td>
                <td>
                  <Link to={`/sessions/${s.id}`} className="sessions-view-btn">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
