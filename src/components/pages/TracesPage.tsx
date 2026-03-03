import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { listLangfuseSessions, getLangfuseSession, runEvaluation, getEvalStatus } from '../../api/client'
import type { LangfuseSessionSummary, LangfuseSessionDetail, EvalStatusDetail } from '../../api/types'
import './TracesPage.css'

function formatLatency(seconds: number | null): string {
  if (seconds === null) return '-'
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
  return `${seconds.toFixed(1)}s`
}

function formatCost(cost: number | null): string {
  if (cost === null) return '-'
  return `$${cost.toFixed(4)}`
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return '-'
  const d = new Date(ts)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs.toString().padStart(2, '0')}s`
}

function JsonBlock({ data }: { data: unknown }) {
  if (data === null || data === undefined) return <span className="modal-null">null</span>
  return (
    <pre className="modal-json">
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  )
}

function SessionModal({
  detail,
  loading,
  error,
  onClose,
}: {
  detail: LangfuseSessionDetail | null
  loading: boolean
  error: string | null
  onClose: () => void
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Session Detail</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {loading && (
          <div className="modal-loading">
            <div className="loading-spinner" />
            <p>Loading trace data...</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {detail && (
          <div className="modal-body">
            <div className="modal-meta-grid">
              <div className="modal-meta-item">
                <span className="modal-meta-label">Trace ID</span>
                <span className="modal-meta-value modal-mono">{detail.id}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Name</span>
                <span className="modal-meta-value">{detail.name || '-'}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Timestamp</span>
                <span className="modal-meta-value">{formatTimestamp(detail.timestamp)}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Latency</span>
                <span className="modal-meta-value">{formatLatency(detail.latency)}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Cost</span>
                <span className="modal-meta-value">{formatCost(detail.total_cost)}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">User</span>
                <span className="modal-meta-value modal-mono">{detail.user_id || '-'}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Session</span>
                <span className="modal-meta-value modal-mono">{detail.session_id || '-'}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Release</span>
                <span className="modal-meta-value">{detail.release || '-'}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Version</span>
                <span className="modal-meta-value">{detail.version || '-'}</span>
              </div>
              <div className="modal-meta-item">
                <span className="modal-meta-label">Tags</span>
                <span className="modal-meta-value">
                  {detail.tags.length > 0 ? (
                    <span className="traces-tags">
                      {detail.tags.map((tag) => (
                        <span key={tag} className="traces-tag">{tag}</span>
                      ))}
                    </span>
                  ) : '-'}
                </span>
              </div>
            </div>

            <div className="modal-section">
              <h3 className="modal-section-title">Input</h3>
              <JsonBlock data={detail.input} />
            </div>

            <div className="modal-section">
              <h3 className="modal-section-title">Output</h3>
              <JsonBlock data={detail.output} />
            </div>

            {detail.metadata != null && (
              <div className="modal-section">
                <h3 className="modal-section-title">Metadata</h3>
                <JsonBlock data={detail.metadata} />
              </div>
            )}

            {detail.observations.length > 0 && (
              <div className="modal-section">
                <h3 className="modal-section-title">
                  Observations ({detail.observations.length})
                </h3>
                {detail.observations.map((obs, i) => {
                  const o = obs as Record<string, unknown>
                  return (
                  <details key={i} className="modal-observation">
                    <summary className="modal-observation-summary">
                      {String(o?.name || `Observation ${i + 1}`)}
                      {o?.type != null && (
                        <span className="modal-obs-type">
                          {String(o.type)}
                        </span>
                      )}
                    </summary>
                    <JsonBlock data={obs} />
                  </details>
                  )
                })}
              </div>
            )}

            {detail.scores.length > 0 && (
              <div className="modal-section">
                <h3 className="modal-section-title">Scores ({detail.scores.length})</h3>
                <JsonBlock data={detail.scores} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EvalStatusModal({
  traceId,
  onClose,
}: {
  traceId: string
  onClose: () => void
}) {
  const [evalStatus, setEvalStatus] = useState<EvalStatusDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(() => {
    getEvalStatus(traceId)
      .then((data) => {
        setEvalStatus(data)
        if (data.elapsed_seconds != null) {
          setElapsed(data.elapsed_seconds)
        }
      })
      .catch((err) => setError(err.message))
  }, [traceId])

  // Initial fetch + polling
  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchStatus])

  // Stop polling when eval completes
  useEffect(() => {
    if (evalStatus && evalStatus.run_status !== 'running') {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [evalStatus])

  // Live elapsed timer (updates every second)
  useEffect(() => {
    if (evalStatus?.run_status === 'running') {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [evalStatus?.run_status])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const toggleError = (judgeName: string) => {
    setExpandedErrors((prev) => {
      const next = new Set(prev)
      if (next.has(judgeName)) {
        next.delete(judgeName)
      } else {
        next.add(judgeName)
      }
      return next
    })
  }

  const completedCount = evalStatus?.judges.filter((j) => j.status === 'completed').length ?? 0
  const totalCount = evalStatus?.judges.length ?? 4

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <span className="judge-icon judge-icon-done">&#10003;</span>
      case 'error': return <span className="judge-icon judge-icon-error">&#10007;</span>
      case 'running': return <span className="judge-icon-spinner" />
      case 'pending':
      default: return <span className="judge-icon-spinner judge-icon-pending" />
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content eval-status-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header eval-status-header">
          <div>
            <h2 className="modal-title">Evaluation Status</h2>
            {evalStatus && (
              <span className="eval-status-session-id">
                {evalStatus.eval_session_id}
              </span>
            )}
          </div>
          <div className="eval-status-header-right">
            {evalStatus?.run_status === 'running' && (
              <span className="eval-elapsed-badge">
                Running for {formatElapsed(elapsed)}
              </span>
            )}
            {evalStatus?.run_status === 'completed' && (
              <span className="eval-elapsed-badge eval-elapsed-done">
                Completed in {formatElapsed(elapsed)}
              </span>
            )}
            {evalStatus?.run_status === 'failed' && (
              <span className="eval-elapsed-badge eval-elapsed-failed">
                Failed after {formatElapsed(elapsed)}
              </span>
            )}
            <button className="modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>

        {error && <div className="error-message" style={{ margin: '16px 24px' }}>{error}</div>}

        {!evalStatus && !error && (
          <div className="modal-loading">
            <div className="loading-spinner" />
            <p>Loading eval status...</p>
          </div>
        )}

        {evalStatus && (
          <div className="modal-body">
            <div className="eval-status-judges">
              {evalStatus.judges.map((judge) => (
                <div
                  key={judge.judge_name}
                  className={`judge-card judge-card-${judge.status}`}
                >
                  <div className="judge-card-header">
                    {statusIcon(judge.status)}
                    <span className="judge-card-name">{judge.display_name}</span>
                  </div>
                  <div className="judge-card-body">
                    <span className={`judge-card-status-label judge-card-status-${judge.status}`}>
                      {judge.status}
                    </span>
                    {judge.status === 'completed' && judge.score != null && (
                      <span className="judge-card-score">{judge.score}/5</span>
                    )}
                  </div>
                  {judge.status === 'error' && judge.error && (
                    <div
                      className={`judge-card-error ${expandedErrors.has(judge.judge_name) ? 'expanded' : ''}`}
                      onClick={() => toggleError(judge.judge_name)}
                      title="Click to expand"
                    >
                      {judge.error}
                    </div>
                  )}
                  {judge.started_at && (
                    <div className="judge-card-timestamp">
                      {formatTimestamp(judge.started_at)}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="eval-status-progress">
              <div className="eval-status-progress-bar">
                <div
                  className={`eval-status-progress-fill ${evalStatus.run_status === 'running' ? 'animated' : ''}`}
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="eval-status-progress-text">
                {completedCount}/{totalCount} judges completed
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

type FilterMode = 'jha-chat' | 'all'

export function TracesPage() {
  const [sessions, setSessions] = useState<LangfuseSessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('jha-chat')
  const [timeRange, setTimeRange] = useState('7d')
  const [evaluableOnly, setEvaluableOnly] = useState(true)
  const [runningTraces, setRunningTraces] = useState<Set<string>>(new Set())

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedIsRunning, setSelectedIsRunning] = useState(false)
  const [detail, setDetail] = useState<LangfuseSessionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const fetchSessions = useCallback(() => {
    return listLangfuseSessions(
      filterMode === 'jha-chat' ? 'jha-chat' : undefined,
      timeRange,
    )
      .then(setSessions)
      .catch((err) => setError(err.message))
  }, [filterMode, timeRange])

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchSessions().finally(() => setLoading(false))
  }, [fetchSessions])

  // When backend confirms a run is no longer "running", remove from optimistic set
  useEffect(() => {
    const confirmed = new Set<string>()
    for (const s of sessions) {
      if (s.run_status && s.run_status !== 'running' && runningTraces.has(s.id)) {
        confirmed.add(s.id)
      }
    }
    if (confirmed.size > 0) {
      setRunningTraces((prev) => {
        const next = new Set(prev)
        for (const id of confirmed) next.delete(id)
        return next
      })
    }
  }, [sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling: when any trace has a running eval, re-fetch every 5 seconds
  useEffect(() => {
    const hasRunning = sessions.some(
      (s) => s.run_status === 'running' || runningTraces.has(s.id)
    )

    if (!hasRunning) {
      return // no cleanup needed, no interval to create
    }

    const interval = setInterval(() => {
      fetchSessions()
    }, 5000)

    return () => clearInterval(interval)
  }, [sessions, fetchSessions, runningTraces])

  const handleRun = async (e: React.MouseEvent, traceId: string) => {
    e.stopPropagation() // Don't open the detail modal
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
      console.error('Failed to start evaluation:', err)
    }
  }

  const isRunning = (t: LangfuseSessionSummary) => {
    return t.run_status === 'running' || runningTraces.has(t.id)
  }

  const openDetail = (trace: LangfuseSessionSummary) => {
    setSelectedId(trace.id)
    if (isRunning(trace)) {
      setSelectedIsRunning(true)
    } else {
      setSelectedIsRunning(false)
      setDetail(null)
      setDetailError(null)
      setDetailLoading(true)
      getLangfuseSession(trace.id)
        .then(setDetail)
        .catch((err) => setDetailError(err.message))
        .finally(() => setDetailLoading(false))
    }
  }

  const closeDetail = () => {
    setSelectedId(null)
    setSelectedIsRunning(false)
    setDetail(null)
    setDetailError(null)
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

  const showAll = filterMode === 'all'
  const displayed = evaluableOnly ? sessions.filter((s) => s.can_eval) : sessions

  return (
    <div className="traces-page">
      <div className="traces-toolbar">
        <div className="traces-toggle">
          <button
            className={`traces-toggle-btn ${!showAll ? 'active' : ''}`}
            onClick={() => setFilterMode('jha-chat')}
          >
            JHA Chat
          </button>
          <button
            className={`traces-toggle-btn ${showAll ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Traces
          </button>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="traces-time-select"
        >
          <option value="1h">Last hour</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
        <label className="traces-filter-checkbox">
          <input
            type="checkbox"
            checked={evaluableOnly}
            onChange={(e) => setEvaluableOnly(e.target.checked)}
          />
          Evaluable only
        </label>
      </div>

      <div className="traces-table-wrapper">
        <table className="traces-table">
          <thead>
            <tr>
              {showAll && <th>Name</th>}
              <th>Timestamp</th>
              <th>Latency</th>
              <th>Cost</th>
              <th>Tags</th>
              <th>Input</th>
              <th>Output</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((t) => (
              <tr
                key={t.id}
                className="traces-clickable-row"
                onClick={() => openDetail(t)}
              >
                {showAll && <td className="traces-name-cell">{t.name || '-'}</td>}
                <td className="traces-ts-cell">{formatTimestamp(t.timestamp)}</td>
                <td>{formatLatency(t.latency)}</td>
                <td>{formatCost(t.total_cost)}</td>
                <td>
                  {t.tags.length > 0 ? (
                    <div className="traces-tags">
                      {t.tags.map((tag) => (
                        <span key={tag} className="traces-tag">{tag}</span>
                      ))}
                    </div>
                  ) : '-'}
                </td>
                <td className="traces-preview-cell" title={t.input_preview || ''}>
                  {t.input_preview || '-'}
                </td>
                <td className="traces-preview-cell" title={t.output_preview || ''}>
                  {t.output_preview || '-'}
                </td>
                <td className="traces-action-cell">
                  {isRunning(t) ? (
                    <div className="traces-running-indicator">
                      <div className={`traces-progress-bar ${(t.judges_completed ?? 0) === 0 ? 'indeterminate' : ''}`}>
                        <div
                          className="traces-progress-fill"
                          style={{ width: `${((t.judges_completed ?? 0) / (t.judges_total ?? 4)) * 100}%` }}
                        />
                      </div>
                      <span className="traces-progress-text">
                        {t.judges_completed ?? 0}/{t.judges_total ?? 4}
                      </span>
                    </div>
                  ) : t.can_eval ? (
                    <div className="traces-action-buttons">
                      <button
                        className="traces-run-btn"
                        onClick={(e) => handleRun(e, t.id)}
                        title="Run evaluation judges on this trace"
                      >
                        Run Eval
                      </button>
                      {t.eval_session_id && (
                        <Link
                          to={`/evaluations/${t.eval_session_id}`}
                          className="traces-view-link"
                          onClick={(e) => e.stopPropagation()}
                          title="View evaluation results"
                        >
                          Results
                        </Link>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && selectedIsRunning && (
        <EvalStatusModal
          traceId={selectedId}
          onClose={closeDetail}
        />
      )}

      {selectedId && !selectedIsRunning && (
        <SessionModal
          detail={detail}
          loading={detailLoading}
          error={detailError}
          onClose={closeDetail}
        />
      )}
    </div>
  )
}
