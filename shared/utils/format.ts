/** Formats ms as "m:ss.hh" (or "ss.hh" under a minute); "-" for null/undefined. */
export function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-'
  const sign = ms < 0 ? '-' : ''
  const totalSeconds = Math.abs(ms) / 1000
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  if (minutes > 0) {
    return `${sign}${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
  }
  return `${sign}${seconds.toFixed(2)}`
}

/** "YYYY-MM-DD" -> "DD-MM-YYYY"; "-" for empty input. */
export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}-${m}-${y}`
}
