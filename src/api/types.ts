// --- Groundedness ---

export interface ClaimAssessment {
  claim: string
  label: 'supported' | 'unsupported' | 'contradicted' | 'properly_marked_uncertain'
  severity: 'high' | 'moderate' | 'minor'
  evidence: string
}

export interface GroundednessResult {
  score: number
  supported_rate: number
  weighted_error_rate: number
  claims: ClaimAssessment[]
  reasoning: string
}

// --- Completeness ---

export interface RequiredItemScore {
  item: string
  category: 'steps' | 'hazards' | 'controls' | 'context'
  item_score: number
  weight: number
  evidence: string
}

export interface CompletenessResult {
  score: number
  completeness_pct: number
  required_items: RequiredItemScore[]
  reasoning: string
}

// --- Form Groundedness ---

export interface FormFieldAssessment {
  field_id: string
  field_value: string | boolean | number | unknown[]
  label: 'supported' | 'unsupported' | 'contradicted'
  severity: 'high' | 'moderate' | 'minor'
  evidence: string
}

export interface FormGroundednessResult {
  score: number
  supported_rate: number
  weighted_error_rate: number
  fields: FormFieldAssessment[]
  reasoning: string
}

// --- Form Completeness ---

export interface FormCompletenessItem {
  transcript_item: string
  category: 'task_step' | 'hazard' | 'control' | 'ppe' | 'context'
  item_score: number
  weight: number
  evidence: string
}

export interface FormCompletenessResult {
  score: number
  completeness_pct: number
  items: FormCompletenessItem[]
  reasoning: string
}

// --- Session ---

export interface SessionScores {
  groundedness: number | null
  completeness: number | null
  form_groundedness: number | null
  form_completeness: number | null
}

export interface SessionSummary {
  id: string
  video_name: string
  evaluated_at: string
  scores: SessionScores
  thumbnail_url: string | null
  trace_id: string | null
  run_status: 'running' | 'completed' | 'failed' | null
  judges_completed: number | null
  judges_total: number | null
}

export interface RunEvalResponse {
  eval_session_id: string
  status: string
  message: string
}

export interface TranscriptData {
  observation: string[]
  transcript: string
}

export interface FormField {
  value: string | boolean | number
  confidence: number
  reasoning: string
}

export interface FormTask {
  task: string
  hazard: string
  control: string
  risk: string
}

// --- Langfuse Sessions ---

export interface LangfuseSessionSummary {
  id: string
  name: string | null
  timestamp: string | null
  user_id: string | null
  session_id: string | null
  release: string | null
  version: string | null
  tags: string[]
  latency: number | null
  total_cost: number | null
  input_preview: string | null
  output_preview: string | null
  can_eval: boolean
  eval_session_id: string | null
  run_status: 'running' | 'completed' | 'failed' | null
  judges_completed: number | null
  judges_total: number | null
}

export interface LangfuseSessionDetail {
  id: string
  name: string | null
  timestamp: string | null
  user_id: string | null
  session_id: string | null
  release: string | null
  version: string | null
  tags: string[]
  metadata: unknown
  latency: number | null
  total_cost: number | null
  input: unknown
  output: unknown
  observations: unknown[]
  scores: unknown[]
}

// --- Eval Status ---

export interface JudgeStatus {
  judge_name: string
  display_name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  score: number | null
  error: string | null
  started_at: string | null
  completed_at: string | null
}

export interface EvalStatusDetail {
  eval_session_id: string
  trace_id: string
  run_status: string
  started_at: string | null
  elapsed_seconds: number | null
  judges: JudgeStatus[]
}

// --- Session Detail ---

export interface SessionDetail {
  id: string
  video_name: string
  evaluated_at: string
  model: string
  video_url: string | null
  transcript: TranscriptData | null
  form: {
    humanReadableResponse?: string
    fields?: Record<string, FormField | FormTask[] | unknown>
  } | null
  groundedness: GroundednessResult | null
  completeness: CompletenessResult | null
  form_groundedness: FormGroundednessResult | null
  form_completeness: FormCompletenessResult | null
}
