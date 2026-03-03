import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { listEvaluations, runEvaluation } from '../../api/client'
import type { SessionSummary } from '../../api/types'
import { ScorePill } from '../evaluation/ScorePill'
import { truncateId, formatDate } from '../../utils/format'
import './SessionsPage.css'

export function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningTraces, setRunningTraces] = useState<Set<string>>(new Set())
  const [recentOnly, setRecentOnly] = useState(false)
  const [timeRange, setTimeRange] = useState('7d')
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchSessions = useCallback(() => {
    return listEvaluations(timeRange)
      .then(setSessions)
      .catch((err) => setError(err.message))
  }, [timeRange])

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false))
  }, [fetchSessions])

  // Polling: when any session is running, re-fetch every 3 seconds
  useEffect(() => {
    const hasRunning = sessions.some((s) => s.run_status === 'running')

    if (hasRunning && !pollRef.current) {
      pollRef.current = setInterval(() => {
        fetchSessions()
      }, 3000)
    } else if (!hasRunning && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
      // Clear local running state once backend confirms completion
      setRunningTraces(new Set())
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [sessions, fetchSessions])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      const data = await listEvaluations(timeRange, true)
      setSessions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const handleRun = async (traceId: string) => {
    setRunningTraces((prev) => new Set(prev).add(traceId))
    try {
      await runEvaluation(traceId)
      await fetchSessions()
    } catch (err) {
      setRunningTraces((prev) => {
        const next = new Set(prev)
        next.delete(traceId)
        return next
      })
      alert(err instanceof Error ? err.message : 'Failed to start evaluation')
    }
  }

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

  const baseId = (id: string) => id.split('#')[0]

  const hasScores = (s: SessionSummary) =>
    s.scores.groundedness != null ||
    s.scores.completeness != null ||
    s.scores.form_groundedness != null ||
    s.scores.form_completeness != null

  const isRunning = (s: SessionSummary) => {
    const processRunning = s.run_status === 'running' || (s.trace_id && runningTraces.has(s.trace_id))
    if (!processRunning) return false
    // Show scores once all judges are complete, even if subprocess is still running
    const allJudgesComplete = s.judges_total != null && s.judges_completed === s.judges_total
    return !allJudgesComplete
  }

  const displayed = recentOnly
    ? Object.values(
        sessions.reduce<Record<string, SessionSummary>>((acc, s) => {
          const key = s.video_name || baseId(s.id)
          if (!acc[key] || s.evaluated_at > acc[key].evaluated_at) {
            acc[key] = s
          }
          return acc
        }, {}),
      ).sort((a, b) => b.evaluated_at.localeCompare(a.evaluated_at))
    : sessions

  return (
    <div className="sessions-page">
      <div className="sessions-toolbar">
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="sessions-time-select"
        >
          <option value="1h">Last hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <button
          className="refresh-btn"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh from Langfuse"
        >
          <svg
            className={refreshing ? 'spinning' : ''}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.5 2v6h-6" />
            <path d="M2.5 22v-6h6" />
            <path d="M3.5 12a9 9 0 0 1 15-6.7L21.5 8" />
            <path d="M20.5 12a9 9 0 0 1-15 6.7L2.5 16" />
          </svg>
        </button>
        <label className="sessions-filter-checkbox">
          <input
            type="checkbox"
            checked={recentOnly}
            onChange={(e) => setRecentOnly(e.target.checked)}
          />
          Most recent only
        </label>
      </div>
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
            {displayed.map((s) => (
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
                <td className="sessions-id-cell" title={baseId(s.id)}>
                  {truncateId(baseId(s.id))}
                </td>
                <td>{formatDate(s.evaluated_at)}</td>

                {isRunning(s) ? (
                  <td colSpan={4} className="sessions-progress-cell">
                    <div className="sessions-progress-bar">
                      <div
                        className="sessions-progress-fill"
                        style={{ width: `${((s.judges_completed ?? 0) / (s.judges_total ?? 4)) * 100}%` }}
                      />
                    </div>
                    <span className="sessions-progress-text">
                      {s.judges_completed ?? 0}/{s.judges_total ?? 4} judges
                    </span>
                  </td>
                ) : (
                  <>
                    <td><ScorePill score={s.scores.groundedness} /></td>
                    <td><ScorePill score={s.scores.completeness} /></td>
                    <td><ScorePill score={s.scores.form_groundedness} /></td>
                    <td><ScorePill score={s.scores.form_completeness} /></td>
                  </>
                )}

                <td>
                  {isRunning(s) ? (
                    <span className="sessions-view-btn disabled">View</span>
                  ) : hasScores(s) ? (
                    <Link to={`/evaluations/${baseId(s.id)}`} className="sessions-view-btn">
                      View
                    </Link>
                  ) : s.trace_id ? (
                    <button
                      className="sessions-run-btn"
                      onClick={() => handleRun(s.trace_id!)}
                    >
                      Run
                    </button>
                  ) : (
                    <Link to={`/evaluations/${baseId(s.id)}`} className="sessions-view-btn">
                      View
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
