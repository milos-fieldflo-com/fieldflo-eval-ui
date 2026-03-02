import { ScorePill } from './ScorePill'
import { ErrorList } from './ErrorList'
import type { TaskObject } from './TaskCard'
import { formatPct } from '../../utils/format'
import type {
  GroundednessResult,
  CompletenessResult,
  FormGroundednessResult,
  FormCompletenessResult,
} from '../../api/types'
import './RubricPanel.css'

interface RubricPanelProps {
  title: string
  data:
    | GroundednessResult
    | CompletenessResult
    | FormGroundednessResult
    | FormCompletenessResult
    | null
  /** Tasks from form data, for rendering task field errors structurally */
  tasks?: TaskObject[]
}

function getStats(data: RubricPanelProps['data']): { label: string; value: string }[] {
  if (!data) return []
  const stats: { label: string; value: string }[] = []

  if ('supported_rate' in data) {
    stats.push({ label: 'Supported Rate', value: formatPct(data.supported_rate) })
    stats.push({ label: 'Weighted Error Rate', value: formatPct(data.weighted_error_rate) })
  }
  if ('completeness_pct' in data) {
    stats.push({ label: 'Completeness', value: formatPct(data.completeness_pct) })
  }

  return stats
}

interface ErrorEntry {
  text: string
  evidence: string
  severity?: string
  weight?: number
}

function getErrors(data: RubricPanelProps['data']): ErrorEntry[] {
  if (!data) return []

  // Groundedness: unsupported/contradicted claims
  if ('claims' in data) {
    return data.claims
      .filter((c) => c.label === 'unsupported' || c.label === 'contradicted')
      .map((c) => ({ text: c.claim, evidence: c.evidence, severity: c.severity }))
  }

  // Completeness: items with score 0
  if ('required_items' in data) {
    return data.required_items
      .filter((item) => item.item_score === 0)
      .map((item) => ({ text: item.item, evidence: item.evidence, weight: item.weight }))
  }

  // Form Groundedness: unsupported/contradicted fields
  if ('fields' in data) {
    return data.fields
      .filter((f) => f.label === 'unsupported' || f.label === 'contradicted')
      .map((f) => ({
        text: `${f.field_id}: ${String(f.field_value)}`,
        evidence: f.evidence,
        severity: f.severity,
      }))
  }

  // Form Completeness: items with score 0
  if ('items' in data) {
    return data.items
      .filter((item) => item.item_score === 0)
      .map((item) => ({
        text: item.transcript_item,
        evidence: item.evidence,
        weight: item.weight,
      }))
  }

  return []
}

export function RubricPanel({ title, data, tasks }: RubricPanelProps) {
  if (!data) {
    return (
      <div className="rubric-panel rubric-panel-empty">
        <div className="rubric-panel-header">
          <h3 className="rubric-panel-title">{title}</h3>
          <ScorePill score={null} />
        </div>
        <p className="rubric-panel-na">No evaluation data available</p>
      </div>
    )
  }

  const stats = getStats(data)
  const errors = getErrors(data)

  return (
    <div className="rubric-panel">
      <div className="rubric-panel-header">
        <h3 className="rubric-panel-title">{title}</h3>
        <ScorePill score={data.score} />
      </div>

      {stats.length > 0 && (
        <div className="rubric-panel-stats">
          {stats.map((s) => (
            <div key={s.label} className="rubric-stat">
              <span className="rubric-stat-label">{s.label}</span>
              <span className="rubric-stat-value">{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {data.reasoning && (
        <p className="rubric-panel-reasoning">{data.reasoning}</p>
      )}

      <ErrorList title="Errors" errors={errors} tasks={tasks} />
    </div>
  )
}
