/**
 * Parses what a person types into a time field: "40.50", "40,50",
 * "2:12.34". Empty is fine (-> null); anything else that isn't a plain
 * time is reported as invalid so the form can say so, instead of silently
 * saving nothing.
 */
export type TimeInput = { ok: true; ms: number | null } | { ok: false }

const TIME_RE = /^(-)?(?:(\d+):)?(\d+(?:\.\d+)?)$/

/**
 * `signed` also accepts zero and a leading minus -- for a *difference* such
 * as a fade target ("-0.30" = last lap faster than the first), not for a time.
 */
export function parseTimeInput(raw: string | null | undefined, opts: { signed?: boolean } = {}): TimeInput {
  const value = (raw ?? '').trim().replace(',', '.')
  if (!value) return { ok: true, ms: null }
  const match = value.match(TIME_RE)
  if (!match || (match[1] && !opts.signed)) return { ok: false }
  const minutes = match[2] ? Number.parseInt(match[2], 10) : 0
  const seconds = Number.parseFloat(match[3] ?? '0')
  const magnitude = Math.round((minutes * 60 + seconds) * 1000)
  const ms = match[1] ? -magnitude : magnitude
  if (ms === 0) return opts.signed ? { ok: true, ms: 0 } : { ok: false }
  return { ok: true, ms }
}
