/** Truncate session ID for display */
export function truncateId(id: string, maxLen = 24): string {
  if (id.length <= maxLen) return id
  return id.slice(0, maxLen) + '...'
}

/** Format ISO date string or YYYY-MM-DD HH:MM:SS */
export function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A'
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

/** Format a float as percentage */
export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
