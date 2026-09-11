/**
 * Season boundary rules ported from app/main.py (old app, commit 4dc6959):
 * current_season_bounds, season_label_for_date, season_bounds_from_label.
 * A season runs September 1 -> April 30 and spans two calendar years.
 * See REBUILD_PLAN.md section 5.3 and the `season_labeling` fixture cases.
 */

/** date must be "YYYY-MM-DD" */
export function seasonLabelForDate(date: string): string {
  const parts = date.split('-')
  const year = Number.parseInt(parts[0] ?? '', 10)
  const month = Number.parseInt(parts[1] ?? '', 10)
  const startYear = month >= 9 ? year : year - 1
  return `${startYear}-${startYear + 1}`
}

export function seasonBoundsFromLabel(label: string): [string, string] {
  const match = label.trim().match(/^(\d{4})-(\d{4})$/)
  if (!match) throw new Error(`invalid season label: ${label}`)
  const startYear = Number.parseInt(match[1] ?? '', 10)
  const endYear = Number.parseInt(match[2] ?? '', 10)
  if (endYear !== startYear + 1) throw new Error(`invalid season label: ${label}`)
  return [`${startYear}-09-01`, `${endYear}-04-30`]
}

export function currentSeasonBounds(today: Date = new Date()): [string, string] {
  const month = today.getMonth() + 1
  const year = today.getFullYear()
  let startYear: number
  let endYear: number
  if (month >= 9) {
    startYear = year
    endYear = year + 1
  } else {
    startYear = year - 1
    endYear = year
  }
  return [`${startYear}-09-01`, `${endYear}-04-30`]
}
