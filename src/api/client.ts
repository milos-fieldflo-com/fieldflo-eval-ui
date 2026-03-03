import { config } from '../config'
import type { SessionSummary, SessionDetail, LangfuseSessionSummary, LangfuseSessionDetail, RunEvalResponse, EvalStatusDetail } from './types'

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.apiBaseUrl}${endpoint}`
  const response = await fetch(url, { ...options })

  if (!response.ok) {
    let detail: string | undefined
    try {
      const text = await response.text()
      try {
        const errorData = JSON.parse(text)
        detail = errorData.detail || JSON.stringify(errorData)
      } catch {
        detail = text
      }
    } catch {
      detail = `HTTP ${response.status}`
    }
    throw new ApiError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
      detail,
    )
  }

  return response.json()
}

// Evaluations (filesystem-based eval sessions)
export async function listEvaluations(timeRange?: string): Promise<SessionSummary[]> {
  const params = timeRange ? `?time_range=${encodeURIComponent(timeRange)}` : ''
  return fetchApi<SessionSummary[]>(`/api/v1/evaluations${params}`)
}

export async function getEvaluation(sessionId: string): Promise<SessionDetail> {
  return fetchApi<SessionDetail>(`/api/v1/evaluations/${sessionId}`)
}

// Run evaluation
export async function runEvaluation(traceId: string): Promise<RunEvalResponse> {
  return fetchApi<RunEvalResponse>('/api/v1/evaluations/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trace_id: traceId }),
  })
}

// Langfuse sessions (jha-chat traces)
export async function listLangfuseSessions(filter?: string, timeRange?: string): Promise<LangfuseSessionSummary[]> {
  const params = new URLSearchParams()
  if (filter != null) params.set('filter', filter)
  else params.set('filter', '')
  if (timeRange) params.set('time_range', timeRange)
  return fetchApi<LangfuseSessionSummary[]>(`/api/v1/langfuse-sessions?${params}`)
}

export async function getLangfuseSession(traceId: string): Promise<LangfuseSessionDetail> {
  return fetchApi<LangfuseSessionDetail>(`/api/v1/langfuse-sessions/${traceId}`)
}

export async function getEvalStatus(traceId: string): Promise<EvalStatusDetail> {
  return fetchApi<EvalStatusDetail>(`/api/v1/langfuse-sessions/${traceId}/eval-status`)
}
