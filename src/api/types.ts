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
