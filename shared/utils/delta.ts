import { fmtMs } from './format'

/** A difference in ms with an explicit "+" for positive values; "-" for null (the old app's format_delta). */
export function fmtDeltaMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '-'
  return `${ms > 0 ? '+' : ''}${fmtMs(ms)}`
}
