import './TaskCard.css'

export interface TaskObject {
  task?: string
  hazard?: string
  control?: string
  risk?: string
}

interface TaskCardProps {
  task: TaskObject
  index: number
  /** Optional: highlight a specific field (e.g. "control") */
  highlightField?: string
}

export function TaskCard({ task, index, highlightField }: TaskCardProps) {
  const rows: { label: string; key: string; value: string }[] = [
    { label: 'Task', key: 'task', value: task.task || 'N/A' },
    { label: 'Hazard', key: 'hazard', value: task.hazard || 'N/A' },
    { label: 'Control', key: 'control', value: task.control || 'N/A' },
    { label: 'Risk', key: 'risk', value: task.risk || 'N/A' },
  ]

  return (
    <div className="task-card">
      <div className="task-card-header">Task {index + 1}</div>
      {rows.map((row) => (
        <div
          key={row.key}
          className={`task-card-row ${highlightField === row.key ? 'highlighted' : ''}`}
        >
          <span className="task-card-label">{row.label}</span>
          <span className="task-card-value">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

/** Parse a field_id like "tasks[0].control" into { index, field } or null */
export function parseTaskFieldId(fieldId: string): { index: number; field: string } | null {
  const match = fieldId.match(/^tasks\[(\d+)\]\.(\w+)$/)
  if (!match) return null
  return { index: parseInt(match[1], 10), field: match[2] }
}
