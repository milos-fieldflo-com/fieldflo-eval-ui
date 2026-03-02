/** Score 1-5 to hex color */
export function scoreColor(score: number | null): string {
  if (score === null) return '#CCCCCC'
  switch (score) {
    case 5: return '#01BDAE'
    case 4: return '#0acf97'
    case 3: return '#F0AD4E'
    case 2: return '#f8ac59'
    case 1: return '#D9534F'
    default: return '#CCCCCC'
  }
}

/** Severity string to label and color */
export function severityDisplay(severity: string): { label: string; color: string } {
  switch (severity) {
    case 'high':
      return { label: 'Critical', color: '#D9534F' }
    case 'moderate':
      return { label: 'Major', color: '#F0AD4E' }
    case 'minor':
    default:
      return { label: 'Minor', color: '#01BDAE' }
  }
}

/** Weight number to severity display */
export function weightToSeverity(weight: number): { label: string; color: string } {
  switch (weight) {
    case 3: return severityDisplay('high')
    case 2: return severityDisplay('moderate')
    default: return severityDisplay('minor')
  }
}
