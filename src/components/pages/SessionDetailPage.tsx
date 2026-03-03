import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getEvaluation } from '../../api/client'
import type { SessionDetail } from '../../api/types'
import { RubricPanel } from '../evaluation/RubricPanel'
import { TaskCard, type TaskObject } from '../evaluation/TaskCard'
import './SessionDetailPage.css'

type Tab = 'transcript' | 'form'

function isFormField(val: unknown): val is { value: unknown; confidence?: number; reasoning?: string } {
  return typeof val === 'object' && val !== null && 'value' in val
}

function extractTasks(val: unknown): TaskObject[] {
  // Direct array: [{task, hazard, ...}, ...]
  if (Array.isArray(val)) return val as TaskObject[]
  // Wrapped form field: {value: [{task, hazard, ...}, ...], confidence, reasoning}
  if (isFormField(val) && Array.isArray(val.value)) return val.value as TaskObject[]
  return []
}

function FormFields({ form }: { form: SessionDetail['form'] }) {
  if (!form?.fields) {
    return <p className="detail-empty">No form data available</p>
  }

  const fields = form.fields as Record<string, unknown>
  const entries = Object.entries(fields)

  const contextFields: [string, unknown][] = []
  const hazardFlags: [string, boolean][] = []
  const tasks: TaskObject[] = []

  for (const [key, val] of entries) {
    if (key === 'tasks') {
      tasks.push(...extractTasks(val))
    } else if (isFormField(val) && typeof val.value === 'boolean') {
      hazardFlags.push([key, val.value])
    } else if (isFormField(val)) {
      contextFields.push([key, val])
    }
  }

  return (
    <div className="form-fields">
      {contextFields.length > 0 && (
        <div className="form-section">
          <h4 className="form-section-title">Location & Context</h4>
          <div className="form-field-grid">
            {contextFields.map(([key, val]) => (
              <div key={key} className="form-field-card">
                <span className="form-field-label">{key}</span>
                <span className="form-field-value">
                  {isFormField(val) ? String(val.value) : String(val)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hazardFlags.length > 0 && (
        <div className="form-section">
          <h4 className="form-section-title">Hazard Checklist</h4>
          <div className="form-hazard-grid">
            {hazardFlags.map(([key, val]) => (
              <div key={key} className={`form-hazard-item ${val ? 'active' : ''}`}>
                <span className={`form-hazard-check ${val ? 'checked' : ''}`}>
                  {val ? '✓' : '—'}
                </span>
                <span className="form-hazard-label">
                  {key.replace('RV_', '').replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="form-section">
          <h4 className="form-section-title">Tasks</h4>
          <div className="form-tasks">
            {tasks.map((task, i) => (
              <TaskCard key={i} task={task} index={i} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('transcript')

  useEffect(() => {
    if (!sessionId) return
    getEvaluation(sessionId)
      .then(setSession)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading session...</p>
      </div>
    )
  }

  if (error || !session) {
    return <div className="error-message">{error || 'Session not found'}</div>
  }

  return (
    <div className="detail-page">
      <div className="detail-meta">
        <span className="detail-meta-item">
          <strong>Session:</strong> {session.id}
        </span>
        <span className="detail-meta-item">
          <strong>Model:</strong> {session.model || 'N/A'}
        </span>
        <span className="detail-meta-item">
          <strong>Video:</strong> {session.video_name || 'N/A'}
        </span>
      </div>

      <div className="detail-tabs">
        <button
          className={`detail-tab ${activeTab === 'transcript' ? 'active' : ''}`}
          onClick={() => setActiveTab('transcript')}
        >
          Transcript
        </button>
        <button
          className={`detail-tab ${activeTab === 'form' ? 'active' : ''}`}
          onClick={() => setActiveTab('form')}
        >
          Form
        </button>
      </div>

      {activeTab === 'transcript' && (
        <div className="detail-split">
          <div className="detail-left">
            {session.video_url && (
              <video
                className="detail-video"
                controls
                src={session.video_url}
              />
            )}

            {session.transcript ? (
              <>
                <div className="detail-section">
                  <h3 className="detail-section-title">Transcript</h3>
                  <p className="detail-transcript-text">
                    {session.transcript.transcript}
                  </p>
                </div>

                {session.transcript.observation.length > 0 && (
                  <div className="detail-section">
                    <h3 className="detail-section-title">Observations</h3>
                    <ul className="detail-observations">
                      {session.transcript.observation.map((obs, i) => (
                        <li key={i}>{obs}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="detail-empty">No transcript data available</p>
            )}
          </div>

          <div className="detail-right">
            <RubricPanel title="Groundedness" data={session.groundedness} />
            <RubricPanel title="Completeness" data={session.completeness} />
          </div>
        </div>
      )}

      {activeTab === 'form' && (
        <div className="detail-split">
          <div className="detail-left">
            <FormFields form={session.form} />
          </div>

          <div className="detail-right">
            <RubricPanel
              title="Form Groundedness"
              data={session.form_groundedness}
              tasks={extractTasks(
                (session.form?.fields as Record<string, unknown> | undefined)?.tasks
              )}
            />
            <RubricPanel title="Form Completeness" data={session.form_completeness} />
          </div>
        </div>
      )}
    </div>
  )
}
