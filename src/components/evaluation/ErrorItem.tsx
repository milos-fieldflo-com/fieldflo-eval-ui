import { severityDisplay, weightToSeverity } from '../../utils/colors'
import { TaskCard, parseTaskFieldId, type TaskObject } from './TaskCard'

interface ErrorItemProps {
  text: string
  evidence: string
  severity?: string
  weight?: number
  /** For form groundedness errors: the full set of tasks so we can render a TaskCard */
  tasks?: TaskObject[]
}

export function ErrorItem({ text, evidence, severity, weight, tasks }: ErrorItemProps) {
  const sev = severity
    ? severityDisplay(severity)
    : weight
      ? weightToSeverity(weight)
      : severityDisplay('minor')

  // Check if this is a task field error like "tasks[0].control: <value>"
  const colonIdx = text.indexOf(': ')
  const fieldId = colonIdx > 0 ? text.slice(0, colonIdx) : text
  const parsed = parseTaskFieldId(fieldId)

  const taskObj = parsed && tasks?.[parsed.index]

  return (
    <div className="error-item">
      <div className="error-item-header">
        <span
          className="error-severity-badge"
          style={{ backgroundColor: sev.color, color: sev.color === '#F0AD4E' ? '#000' : '#fff' }}
        >
          {sev.label}
        </span>
        <span className="error-item-text">
          {parsed ? `${fieldId}` : text}
        </span>
      </div>
      {taskObj && (
        <div className="error-item-task">
          <TaskCard task={taskObj} index={parsed!.index} highlightField={parsed!.field} />
        </div>
      )}
      <div className="error-item-evidence">
        {evidence || 'No evidence available'}
      </div>
    </div>
  )
}
