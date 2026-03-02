import { config } from '../config'
import type { SessionSummary, SessionDetail } from './types'

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
      const errorData = await response.json()
      detail = errorData.detail || JSON.stringify(errorData)
    } catch {
      detail = await response.text()
    }
    throw new ApiError(
      `API error: ${response.status} ${response.statusText}`,
      response.status,
      detail,
    )
  }

  return response.json()
}

export async function listSessions(): Promise<SessionSummary[]> {
  return fetchApi<SessionSummary[]>('/api/v1/sessions')
}

export async function getSession(sessionId: string): Promise<SessionDetail> {
  return fetchApi<SessionDetail>(`/api/v1/sessions/${sessionId}`)
}
