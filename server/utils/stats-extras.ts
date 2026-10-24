import { pythonRound } from '../../shared/utils/round'
import { fmtMs } from '../../shared/utils/format'
import type { StatsRaceInput } from './stats'

/**
 * The stats page's lap-based numbers, "fun stats" and the narrative
 * "Coach Analyse" card. Ported from the old app's build_stats_context
 * (split_row / fun stats / story_variants sections) and pinned by
 * reference/fixtures/calculations/golden_stats_extras.json, which was
 * produced by running that function. Pure functions: nothing here reads
 * the clock or the database, and randomness is left to the caller.
 *
 * Note these use the RAW lap times (opening = lap 1, "rondes" = laps 2..n),
 * unlike the 400 m-equivalent maths behind the targets progress.
 */

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length

// ---------------------------------------------------------------------------
// Per-distance split stats
// ---------------------------------------------------------------------------

export interface SplitStats {
  avgOpeningS: number | null
  bestOpeningS: number | null
  bestOpeningRaceId: number | null
  avgLapS: number | null
  bestLapS: number | null
  bestLapRaceId: number | null
  avgFadeS: number | null
  /** Average of lap N over all races, N = 1.. (lap 0 is the opening). */
  lapAverages: { lapNo: number; avgS: number }[]
}

/** `rows`: the timed races of ONE distance, oldest first. */
export function buildSplitStats(rows: StatsRaceInput[]): SplitStats {
  const openings: number[] = []
  const fullLaps: number[] = []
  const fades: number[] = []
  const lapValuesByIndex = new Map<number, number[]>()
  let bestOpeningS: number | null = null
  let bestOpeningRaceId: number | null = null
  let bestLapS: number | null = null
  let bestLapRaceId: number | null = null

  for (const row of rows) {
    const laps = row.lapsMs.map((ms) => ms / 1000)
    if (!laps.length) continue
    const raceId = row.id
    openings.push(laps[0]!)
    // Ties go to the lower race id, like the old app.
    if (
      bestOpeningS === null ||
      laps[0]! < bestOpeningS ||
      (laps[0]! === bestOpeningS && raceId < (bestOpeningRaceId ?? raceId + 1))
    ) {
      bestOpeningS = laps[0]!
      bestOpeningRaceId = raceId
    }
    if (laps.length > 1) {
      const splitLaps = laps.slice(1)
      fullLaps.push(...splitLaps)
      const raceBestLap = Math.min(...splitLaps)
      if (
        bestLapS === null ||
        raceBestLap < bestLapS ||
        (raceBestLap === bestLapS && raceId < (bestLapRaceId ?? raceId + 1))
      ) {
        bestLapS = raceBestLap
        bestLapRaceId = raceId
      }
      fades.push(splitLaps[splitLaps.length - 1]! - raceBestLap)
      for (let idx = 1; idx < laps.length; idx++) {
        const list = lapValuesByIndex.get(idx) ?? []
        list.push(laps[idx]!)
        lapValuesByIndex.set(idx, list)
      }
    }
  }

  return {
    avgOpeningS: openings.length ? mean(openings) : null,
    bestOpeningS,
    bestOpeningRaceId,
    avgLapS: fullLaps.length ? mean(fullLaps) : null,
    bestLapS,
    bestLapRaceId,
    avgFadeS: fades.length ? mean(fades) : null,
    lapAverages: [...lapValuesByIndex.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([lapNo, values]) => ({ lapNo, avgS: mean(values) })),
  }
}

// ---------------------------------------------------------------------------
// Fun stats
// ---------------------------------------------------------------------------

export interface FunStats {
  fastestLap: { timeMs: number; distanceM: number; venue: string; raceId: number } | null
  fastestOpener: { timeMs: number; distanceM: number; venue: string; raceId: number } | null
  closestPbMiss: { deltaMs: number; distanceM: number; venue: string; raceId: number } | null
  busiestMonth: { month: string; count: number } | null
  mostSkatedDistance: { distanceM: number; count: number } | null
}

/**
 * `allFiltered`: every race in the filter (DNFs included -- they count
 * towards "busiest month" and "most skated distance", as in the old app).
 * `sortedTimed`: the timed ones, oldest first.
 */
export function buildFunStats(allFiltered: StatsRaceInput[], sortedTimed: StatsRaceInput[]): FunStats {
  let fastestLap: FunStats['fastestLap'] = null
  let fastestOpener: FunStats['fastestOpener'] = null
  for (const row of sortedTimed) {
    const laps = row.lapsMs.map((ms) => ms / 1000)
    if (!laps.length) continue
    const venue = row.venue || '-'
    const openerMs = pythonRound(laps[0]! * 1000)
    if (fastestOpener === null || openerMs < fastestOpener.timeMs) {
      fastestOpener = { timeMs: openerMs, distanceM: row.distanceM, venue, raceId: row.id }
    }
    for (const lap of laps.slice(1)) {
      const lapMs = pythonRound(lap * 1000)
      if (fastestLap === null || lapMs < fastestLap.timeMs) {
        fastestLap = { timeMs: lapMs, distanceM: row.distanceM, venue, raceId: row.id }
      }
    }
  }

  const monthCounts = new Map<string, number>()
  for (const row of allFiltered) {
    const date = (row.competitionDate || '').trim()
    if (date.length >= 7) monthCounts.set(date.slice(0, 7), (monthCounts.get(date.slice(0, 7)) ?? 0) + 1)
  }
  const busiest = [...monthCounts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
  const busiestMonth = busiest ? { month: busiest[0], count: busiest[1] } : null

  const distanceCounts = new Map<number, number>()
  for (const row of allFiltered) distanceCounts.set(row.distanceM, (distanceCounts.get(row.distanceM) ?? 0) + 1)
  const mostSkated = [...distanceCounts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]
  const mostSkatedDistance = mostSkated ? { distanceM: mostSkated[0], count: mostSkated[1] } : null

  let closestPbMiss: FunStats['closestPbMiss'] = null
  const bestBefore = new Map<number, number>()
  for (const row of sortedTimed) {
    const total = row.totalTimeMs!
    const prevBest = bestBefore.get(row.distanceM)
    if (prevBest !== undefined && total > prevBest) {
      const miss = total - prevBest
      if (closestPbMiss === null || miss < closestPbMiss.deltaMs) {
        closestPbMiss = { deltaMs: miss, distanceM: row.distanceM, venue: row.venue || '-', raceId: row.id }
      }
    }
    if (prevBest === undefined || total < prevBest) bestBefore.set(row.distanceM, total)
  }

  return { fastestLap, fastestOpener, closestPbMiss, busiestMonth, mostSkatedDistance }
}

// ---------------------------------------------------------------------------
// "Coach Analyse" story
// ---------------------------------------------------------------------------

export type StoryTone = 'neutral' | 'positive' | 'negative'
export interface StoryPart {
  text: string
  tone: StoryTone
  /** Set when the part links to a race. */
  raceId?: number
}
export interface StoryVariant {
  title: string
  variant: 'commentary' | 'analysis' | 'recap'
  paragraphs: StoryPart[][]
}

const MONTHS_NL = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
]

export function formatMonthLabelNl(monthKey: string | null | undefined): string {
  if (!monthKey) return '-'
  const match = monthKey.match(/^(\d{4})-(\d{2})$/)
  const month = match ? Number.parseInt(match[2]!, 10) : 0
  if (!match || month < 1 || month > 12) return monthKey
  return `${MONTHS_NL[month - 1]} ${Number.parseInt(match[1]!, 10)}`
}

const text = (t: string, tone: StoryTone = 'neutral'): StoryPart => ({ text: t, tone })
const link = (t: string, raceId: number | null | undefined, tone: StoryTone = 'neutral'): StoryPart =>
  raceId === null || raceId === undefined ? { text: t, tone } : { text: t, tone, raceId }

const COACH_TITLE = 'Coach Analyse'

/**
 * All variants that have content (the page shows one of them, picked at
 * random per request). `selectedSeason` is the season actually in effect,
 * '' for "all seasons".
 */
export function buildStoryVariants(fun: FunStats, selectedSeason: string): StoryVariant[] {
  const { fastestLap, fastestOpener, closestPbMiss, busiestMonth, mostSkatedDistance } = fun

  if (!(fastestLap || fastestOpener || closestPbMiss || busiestMonth || mostSkatedDistance)) {
    return [
      {
        title: COACH_TITLE,
        variant: 'commentary',
        paragraphs: [[text('Hier zie je per afstand hoe je tijden, openingen, rondes en verval zich ontwikkelen.')]],
      },
    ]
  }

  const monthLabel = busiestMonth ? formatMonthLabelNl(busiestMonth.month) : null
  const seasonStoryPrefix = selectedSeason ? `In het seizoen ${selectedSeason}` : 'In deze periode'
  const coachIntroPrefix = selectedSeason ? 'Dit seizoen' : 'In deze periode'
  const space = () => text(' ')

  // --- commentary (short) ---------------------------------------------------
  const shortParagraphs: StoryPart[][] = []
  const speedShort: StoryPart[] = []
  if (fastestLap) {
    speedShort.push(
      text(`${seasonStoryPrefix} reed je je snelste ronde`),
      link(fmtMs(fastestLap.timeMs), fastestLap.raceId, 'positive'),
      text(` op de ${fastestLap.distanceM}m in ${fastestLap.venue}.`),
    )
  }
  if (fastestOpener) {
    if (speedShort.length) speedShort.push(space())
    speedShort.push(
      text('Je snelste opening klokte je op'),
      link(fmtMs(fastestOpener.timeMs), fastestOpener.raceId, 'positive'),
      text(` in ${fastestOpener.venue}.`),
    )
  }
  if (closestPbMiss) {
    if (speedShort.length) speedShort.push(space())
    speedShort.push(
      text(`In ${closestPbMiss.venue} kwam je het dichtst bij een nieuw PR: je miste het daar met`),
      link(fmtMs(closestPbMiss.deltaMs), closestPbMiss.raceId, 'negative'),
      text('.'),
    )
  }
  if (speedShort.length) shortParagraphs.push(speedShort)

  const rhythmShort: StoryPart[] = []
  if (busiestMonth && monthLabel) {
    rhythmShort.push(
      text(`${monthLabel} was je drukste maand met`),
      text(String(busiestMonth.count), 'positive'),
      text(' ritten.'),
    )
  }
  if (mostSkatedDistance) {
    if (rhythmShort.length) rhythmShort.push(space())
    rhythmShort.push(
      text('De afstand die je het vaakst reed was de'),
      text(`${mostSkatedDistance.distanceM}m`, 'positive'),
      text(`, in totaal ${mostSkatedDistance.count} keer.`),
    )
  }
  if (rhythmShort.length) shortParagraphs.push(rhythmShort)

  // --- analysis (coach) -----------------------------------------------------
  const coachParagraphs: StoryPart[][] = []
  const coachSpeed: StoryPart[] = []
  if (fastestLap || fastestOpener) {
    coachSpeed.push(text(`${coachIntroPrefix} liet je sterke snelheid zien.`))
    if (fastestLap) {
      coachSpeed.push(
        text(' Je snelste ronde was'),
        link(fmtMs(fastestLap.timeMs), fastestLap.raceId, 'positive'),
        text(` in ${fastestLap.venue}.`),
      )
    }
    if (fastestOpener) {
      coachSpeed.push(
        text(' Je beste opening was'),
        link(fmtMs(fastestOpener.timeMs), fastestOpener.raceId, 'positive'),
        text(` in ${fastestOpener.venue}.`),
      )
    }
  }
  if (coachSpeed.length) coachParagraphs.push(coachSpeed)

  const coachFollowup: StoryPart[] = []
  if (closestPbMiss) {
    coachFollowup.push(
      text(`In ${closestPbMiss.venue} zat je ook het dichtst bij een persoonlijk record:`),
      link(fmtMs(closestPbMiss.deltaMs), closestPbMiss.raceId, 'negative'),
      text(' verwijderd van je PR.'),
    )
  }
  if (busiestMonth && monthLabel) {
    if (coachFollowup.length) coachFollowup.push(space())
    coachFollowup.push(
      text(`${monthLabel} was duidelijk je actiefste maand, met`),
      text(String(busiestMonth.count), 'positive'),
      text(' ritten.'),
    )
  }
  if (mostSkatedDistance) {
    if (coachFollowup.length) coachFollowup.push(space())
    coachFollowup.push(
      text('De'),
      text(`${mostSkatedDistance.distanceM}m`, 'positive'),
      text(` was je meest gereden afstand met ${mostSkatedDistance.count} starts.`),
    )
  }
  if (coachFollowup.length) coachParagraphs.push(coachFollowup)

  // --- recap ------------------------------------------------------------------
  const recapParagraphs: StoryPart[][] = [[text(`${seasonStoryPrefix} kende een aantal opvallende momenten.`)]]
  const recapBody: StoryPart[] = []
  if (fastestLap) {
    recapBody.push(
      text('Je snelste ronde reed je in'),
      text(fastestLap.venue, 'positive'),
      text(', waar je'),
      link(fmtMs(fastestLap.timeMs), fastestLap.raceId, 'positive'),
      text(` noteerde op de ${fastestLap.distanceM}m.`),
    )
  }
  if (fastestOpener) {
    if (recapBody.length) recapBody.push(space())
    recapBody.push(
      text('Je snelste opening was'),
      link(fmtMs(fastestOpener.timeMs), fastestOpener.raceId, 'positive'),
      text(` in ${fastestOpener.venue}.`),
    )
  }
  if (closestPbMiss) {
    if (recapBody.length) recapBody.push(space())
    recapBody.push(
      text('Daar kwam je ook dicht bij een PR, met een marge van'),
      link(fmtMs(closestPbMiss.deltaMs), closestPbMiss.raceId, 'negative'),
      text('.'),
    )
  }
  if (recapBody.length) recapParagraphs.push(recapBody)

  const recapOutro: StoryPart[] = []
  if (busiestMonth && monthLabel) {
    recapOutro.push(
      text(monthLabel, 'positive'),
      text(' was je meest actieve maand, met'),
      text(String(busiestMonth.count), 'positive'),
      text(' ritten.'),
    )
  }
  if (mostSkatedDistance) {
    if (recapOutro.length) recapOutro.push(space())
    recapOutro.push(
      text('Over de hele periode bleek de'),
      text(`${mostSkatedDistance.distanceM}m`, 'positive'),
      text(` je favoriete afstand: die reed je ${mostSkatedDistance.count} keer.`),
    )
  }
  if (recapOutro.length) recapParagraphs.push(recapOutro)

  return [
    { title: COACH_TITLE, variant: 'commentary' as const, paragraphs: shortParagraphs },
    { title: COACH_TITLE, variant: 'analysis' as const, paragraphs: coachParagraphs },
    { title: COACH_TITLE, variant: 'recap' as const, paragraphs: recapParagraphs },
  ].filter((v) => v.paragraphs.length)
}
