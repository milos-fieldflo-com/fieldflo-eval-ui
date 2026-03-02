import { useState } from 'react'
import { ErrorItem } from './ErrorItem'
import type { TaskObject } from './TaskCard'

interface ErrorEntry {
  text: string
  evidence: string
  severity?: string
  weight?: number
}

interface ErrorListProps {
  title: string
  errors: ErrorEntry[]
  /** Tasks array from the form, passed through to ErrorItem for structured task rendering */
  tasks?: TaskObject[]
}

export function ErrorList({ title, errors, tasks }: ErrorListProps) {
  const [expanded, setExpanded] = useState(false)

  if (errors.length === 0) return null

  return (
    <div className="error-list">
      <button
        className="error-list-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="error-list-chevron">{expanded ? '▾' : '▸'}</span>
        {title} ({errors.length})
      </button>
      {expanded && (
        <div className="error-list-items">
          {errors.map((err, i) => (
            <ErrorItem
              key={i}
              text={err.text}
              evidence={err.evidence}
              severity={err.severity}
              weight={err.weight}
              tasks={tasks}
            />
          ))}
        </div>
      )}
    </div>
  )
}
