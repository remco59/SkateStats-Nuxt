/**
 * Trend sparkline geometry, ported from build_sparkline in the old app's main.py
 * (checked against reference/fixtures/calculations/golden_dashboard.json).
 *
 * X is proportional to the date (not to the race index), ticks are months --
 * or years when the chart spans all seasons -- and a tick is skipped when it
 * would sit within 28px of the previous one.
 */

export interface SparklineRow {
  id: number
  totalTimeMs: number | null
  competitionDate: string
  competitionName: string
}

export interface SparklineCircle {
  x: number
  y: number
  raceId: number
  totalTimeMs: number
  date: string
  name: string
}

export interface Sparkline {
  width: number
  height: number
  circles: SparklineCircle[]
  ticks: { x: number; label: string }[]
  baselineY: number
  leftPadding: number
  rightPadding: number
  minMs: number
  maxMs: number
  deltaMs: number
}

export interface SparklineOptions {
  rangeStart?: string | null
  rangeEnd?: string | null
  width?: number
  height?: number
  /** Draw faster times higher up. The old app drew them lower; golden tests use false. */
  invert?: boolean
}

const MONTH_LABELS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const MS_PER_DAY = 86_400_000
const MIN_TICK_SPACING_PX = 28

function utcDay(date: string): number {
  const [y, m, d] = date.split('-').map(Number)
  return Date.UTC(y!, m! - 1, d!)
}

export function buildSparkline(rows: SparklineRow[], options: SparklineOptions = {}): Sparkline | null {
  const { rangeStart = null, rangeEnd = null, width = 320, height = 132, invert = false } = options
  const showYearTicks = !rangeStart && !rangeEnd
  const validRows = rows.filter((row) => row.totalTimeMs !== null) as (SparklineRow & { totalTimeMs: number })[]
  if (!validRows.length) return null

  const leftPadding = 8
  const rightPadding = 8
  const topPadding = 12
  const bottomPadding = 28
  const plotWidth = Math.max(width - leftPadding - rightPadding, 20)
  const plotHeight = Math.max(height - topPadding - bottomPadding, 20)

  const values = validRows.map((row) => row.totalTimeMs)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const span = Math.max(maxV - minV, 1)

  let startDay = utcDay(validRows[0]!.competitionDate)
  let endDay = utcDay(validRows[validRows.length - 1]!.competitionDate)
  if (endDay < startDay) [startDay, endDay] = [endDay, startDay]
  if (startDay === endDay) {
    // A single day: spread the chart over that whole month.
    const d = new Date(startDay)
    startDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
    endDay = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)
  }
  const daySpan = Math.max((endDay - startDay) / MS_PER_DAY, 1)

  const ticks: { x: number; label: string }[] = []
  let lastTickX: number | null = null
  const seenMonths = new Set<string>()
  const seenYears = new Set<number>()
  for (const row of validRows) {
    const [year, month] = row.competitionDate.split('-').map(Number) as [number, number]
    let tickDay: number
    let label: string
    if (showYearTicks) {
      if (seenYears.has(year)) continue
      seenYears.add(year)
      tickDay = Date.UTC(year, 0, 1)
      label = String(year)
    } else {
      const key = `${year}-${month}`
      if (seenMonths.has(key)) continue
      seenMonths.add(key)
      tickDay = Date.UTC(year, month - 1, 1)
      label = MONTH_LABELS[month - 1]!
    }
    const offset = Math.min(Math.max((tickDay - startDay) / MS_PER_DAY, 0), daySpan)
    const x = leftPadding + (offset / daySpan) * plotWidth
    if (lastTickX !== null && x - lastTickX < MIN_TICK_SPACING_PX) continue
    lastTickX = x
    ticks.push({ x, label })
  }

  const circles = validRows.map((row): SparklineCircle => {
    const ratio = (utcDay(row.competitionDate) - startDay) / MS_PER_DAY / daySpan
    const x = leftPadding + ratio * plotWidth
    const fraction = (row.totalTimeMs - minV) / span
    const y = invert ? topPadding + fraction * plotHeight : topPadding + plotHeight - fraction * plotHeight
    return { x, y, raceId: row.id, totalTimeMs: row.totalTimeMs, date: row.competitionDate, name: row.competitionName }
  })

  return {
    width,
    height,
    circles,
    ticks,
    baselineY: topPadding + plotHeight,
    leftPadding,
    rightPadding,
    minMs: minV,
    maxMs: maxV,
    deltaMs: values[values.length - 1]! - values[0]!,
  }
}
