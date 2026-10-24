import { pythonRound } from '../../shared/utils/round'
import { computeRaceMetrics, per400Times, segmentDistances } from './splits'

/**
 * Race comparison ported (scoped) from app/main.py::build_comparison_context
 * / get_pacing_labels / get_sterkste_en_zwakste_onderdelen (old app, commit
 * 4dc6959). Pinned by golden_calculations.json -> race_comparison.
 *
 * The old SVG chart-coordinate builders are NOT ported -- the page draws its
 * charts from the numbers below (app/components/SplitChart.vue). The Dutch
 * prose summary (build_vergelijkings_samenvatting) is ported as
 * buildComparisonSummaryText. All of it is pinned by golden_compare.json,
 * produced by running the old build_comparison_context.
 */

export interface SplitComparisonRow {
  index: number
  distanceM: number | null
  baseSplit: number | null
  compareSplit: number | null
  splitDeltaMs: number | null
  cumulativeDeltaMs: number | null
  base400: number | null
  compare400: number | null
  eqDeltaMs: number | null
}

export interface SummaryRow {
  label: string
  baseMs: number | null
  compareMs: number | null
  deltaMs: number | null
}

export interface ComparisonContext {
  summary: SummaryRow[]
  splits: SplitComparisonRow[]
  highlights: {
    totalDeltaMs: number | null
    openingDeltaMs: number | null
    slotDeltaMs: number | null
    vervalDeltaMs: number | null
  }
  /** One sentence on where time was won or lost. */
  samenvattingTekst: string
  pacing: {
    basisLabels: string[]
    vergelijkingLabels: string[]
    basisOpeningMs: number | null
    vergelijkingOpeningMs: number | null
    basisSlotMs: number | null
    vergelijkingSlotMs: number | null
    basisVervalMs: number | null
    vergelijkingVervalMs: number | null
  }
  onderdelen: {
    sterkste: SplitComparisonRow | null
    zwakste: SplitComparisonRow | null
  }
}

/** Pacing character labels for one race's laps (opening/closing/fade shape). */
export function getPacingLabels(laps: number[], distanceM: number): string[] {
  if (!laps.length) return []
  const per400 = per400Times(laps, distanceM)
  if (!per400.length) return []

  const labels: string[] = []
  const first = per400[0]!
  const last = per400[per400.length - 1]!
  const avg = per400.reduce((a, b) => a + b, 0) / per400.length
  const fade = last - first

  if (first <= avg - 0.3) labels.push('Snelle opening')
  else if (first >= avg + 0.3) labels.push('Controleerde start')
  else labels.push('Gelijkmatige opening')

  if (last <= avg - 0.15) labels.push('Sterke slotronde')
  else if (last >= avg + 0.25) labels.push('Zwakke slotronde')

  if (fade >= 0.5) labels.push('Groot verval')
  else if (fade <= 0.15) labels.push('Gelijkmatige opbouw')

  return [...new Set(labels)]
}

/**
 * The one-sentence verdict, from the same deltas the highlights show.
 * First matching rule wins (order matters).
 */
export function buildComparisonSummaryText(input: {
  totalDeltaMs: number | null
  openingDeltaMs: number | null
  slotDeltaMs: number | null
  vervalDeltaMs: number | null
  splitDeltasMs: number[]
}): string {
  const { totalDeltaMs, openingDeltaMs, slotDeltaMs, vervalDeltaMs, splitDeltasMs } = input
  if (totalDeltaMs === null) return 'Onvoldoende data om een duidelijke vergelijking te maken.'

  const fasterRatio = splitDeltasMs.length ? splitDeltasMs.filter((v) => v < 0).length / splitDeltasMs.length : 0

  if (fasterRatio >= 0.75 && totalDeltaMs <= -300) return 'Sneller over vrijwel de hele rit.'
  if (openingDeltaMs !== null && vervalDeltaMs !== null && openingDeltaMs <= -150 && vervalDeltaMs >= 250) {
    return 'Snellere opening, maar veel verval in de slotfase.'
  }
  if (openingDeltaMs !== null && slotDeltaMs !== null && openingDeltaMs >= 150 && slotDeltaMs <= -120) {
    return 'Rustigere start met een sterkere finish.'
  }
  if (totalDeltaMs <= -250) return 'Vergelijkingsrit was overall sneller met stabielere opbouw.'
  if (totalDeltaMs >= 250) return 'Vergelijkingsrit verloor vooral tijd in meerdere segmenten.'
  return 'Kleine verschillen: het tempoverloop bepaalt hier het resultaat.'
}

export function getStrongestWeakestSegment(rows: SplitComparisonRow[]): {
  sterkste: SplitComparisonRow | null
  zwakste: SplitComparisonRow | null
} {
  const valid = rows.filter((r) => r.splitDeltaMs !== null)
  if (!valid.length) return { sterkste: null, zwakste: null }
  const sterkste = valid.reduce((a, b) => (a.splitDeltaMs! <= b.splitDeltaMs! ? a : b))
  const zwakste = valid.reduce((a, b) => (a.splitDeltaMs! >= b.splitDeltaMs! ? a : b))
  return { sterkste, zwakste }
}

export function buildComparisonContext(
  base: { distanceM: number; totalTimeMs: number | null; laps: number[] },
  compare: { distanceM: number; totalTimeMs: number | null; laps: number[] },
): ComparisonContext {
  const baseMetrics = computeRaceMetrics(base.laps, base.distanceM)
  const compareMetrics = computeRaceMetrics(compare.laps, compare.distanceM)
  const basePer400 = per400Times(base.laps, base.distanceM)
  const comparePer400 = per400Times(compare.laps, compare.distanceM)
  const baseSegments = segmentDistances(base.distanceM, base.laps.length)
  const compareSegments = segmentDistances(compare.distanceM, compare.laps.length)

  const rowCount = Math.max(base.laps.length, compare.laps.length)
  const splits: SplitComparisonRow[] = []
  let cumulativeDeltaMs = 0

  for (let idx = 0; idx < rowCount; idx++) {
    const baseSplit = idx < base.laps.length ? base.laps[idx]! : null
    const compareSplit = idx < compare.laps.length ? compare.laps[idx]! : null
    const base400 = idx < basePer400.length ? basePer400[idx]! : null
    const compare400 = idx < comparePer400.length ? comparePer400[idx]! : null
    const splitDeltaMs =
      baseSplit === null || compareSplit === null ? null : pythonRound((compareSplit - baseSplit) * 1000)
    const eqDeltaMs = base400 === null || compare400 === null ? null : pythonRound((compare400 - base400) * 1000)
    const distanceM = idx < baseSegments.length ? baseSegments[idx]! : (compareSegments[idx] ?? null)

    let cumulativeDeltaValue: number | null = null
    if (splitDeltaMs !== null) {
      cumulativeDeltaMs += splitDeltaMs
      cumulativeDeltaValue = cumulativeDeltaMs
    }

    splits.push({
      index: idx + 1,
      distanceM,
      baseSplit,
      compareSplit,
      splitDeltaMs,
      cumulativeDeltaMs: cumulativeDeltaValue,
      base400,
      compare400,
      eqDeltaMs,
    })
  }

  const totalDeltaMs =
    base.totalTimeMs !== null && compare.totalTimeMs !== null ? compare.totalTimeMs - base.totalTimeMs : null
  const openingDeltaMs =
    !base.laps.length || !compare.laps.length ? null : pythonRound((compare.laps[0]! - base.laps[0]!) * 1000)
  const slotDeltaMs =
    !base.laps.length || !compare.laps.length
      ? null
      : pythonRound((compare.laps[compare.laps.length - 1]! - base.laps[base.laps.length - 1]!) * 1000)
  const vervalDeltaMs =
    baseMetrics.fade400Eq !== null && compareMetrics.fade400Eq !== null
      ? pythonRound((compareMetrics.fade400Eq - baseMetrics.fade400Eq) * 1000)
      : null

  function summaryRow(label: string, baseValue: number | null, compareValue: number | null): SummaryRow {
    return {
      label,
      baseMs: baseValue,
      compareMs: compareValue,
      deltaMs: baseValue === null || compareValue === null ? null : compareValue - baseValue,
    }
  }

  const summary: SummaryRow[] = [
    summaryRow('Totale tijd', base.totalTimeMs, compare.totalTimeMs),
    summaryRow(
      'Opening',
      base.laps.length ? pythonRound(base.laps[0]! * 1000) : null,
      compare.laps.length ? pythonRound(compare.laps[0]! * 1000) : null,
    ),
    summaryRow(
      'Laatste 400-eq',
      baseMetrics.last400Eq !== null ? pythonRound(baseMetrics.last400Eq * 1000) : null,
      compareMetrics.last400Eq !== null ? pythonRound(compareMetrics.last400Eq * 1000) : null,
    ),
    summaryRow(
      'Verval',
      baseMetrics.fade400Eq !== null ? pythonRound(baseMetrics.fade400Eq * 1000) : null,
      compareMetrics.fade400Eq !== null ? pythonRound(compareMetrics.fade400Eq * 1000) : null,
    ),
  ]

  return {
    summary,
    splits,
    highlights: {
      totalDeltaMs,
      openingDeltaMs,
      slotDeltaMs,
      vervalDeltaMs,
    },
    samenvattingTekst: buildComparisonSummaryText({
      totalDeltaMs,
      openingDeltaMs,
      slotDeltaMs,
      vervalDeltaMs,
      splitDeltasMs: splits.map((r) => r.splitDeltaMs).filter((v): v is number => v !== null),
    }),
    pacing: {
      basisLabels: getPacingLabels(base.laps, base.distanceM),
      vergelijkingLabels: getPacingLabels(compare.laps, compare.distanceM),
      basisOpeningMs: base.laps.length ? pythonRound(base.laps[0]! * 1000) : null,
      vergelijkingOpeningMs: compare.laps.length ? pythonRound(compare.laps[0]! * 1000) : null,
      basisSlotMs: base.laps.length ? pythonRound(base.laps[base.laps.length - 1]! * 1000) : null,
      vergelijkingSlotMs: compare.laps.length ? pythonRound(compare.laps[compare.laps.length - 1]! * 1000) : null,
      basisVervalMs: baseMetrics.fade400Eq !== null ? pythonRound(baseMetrics.fade400Eq * 1000) : null,
      vergelijkingVervalMs: compareMetrics.fade400Eq !== null ? pythonRound(compareMetrics.fade400Eq * 1000) : null,
    },
    onderdelen: getStrongestWeakestSegment(splits),
  }
}
