import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { useDb } from '../db/client'
import { competitions, raceLaps, races } from '../db/schema'
import { buildSplitRows, computeRaceMetrics } from './splits'
import { buildPrProgress, collectSbRaceIds, type RaceForPr } from './pr'

export interface RaceWithContext {
  id: number
  competitionId: number
  competitionName: string
  venue: string | null
  competitionDate: string
  distanceM: number
  status: string
  totalTimeMs: number | null
  trackType: string
  lane: string | null
  opponent: string | null
  category: string | null
  className: string | null
  tag: string | null
  notes: string | null
  source: string
  sourceRef: string | null
  sequenceInDay: number
  lapsMs: number[]
  isPr: boolean
  isSb: boolean
  previousPrMs: number | null
  deltaVsPreviousPrMs: number | null
}

/** All of a user's races, joined with competition info, laps, and PR/SB flags. */
export function listUserRacesWithContext(userId: number): RaceWithContext[] {
  const db = useDb()

  const rows = db
    .select({
      id: races.id,
      competitionId: races.competitionId,
      competitionName: competitions.name,
      venue: competitions.venue,
      competitionDate: competitions.date,
      distanceM: races.distanceM,
      status: races.status,
      totalTimeMs: races.totalTimeMs,
      trackType: races.trackType,
      lane: races.lane,
      opponent: races.opponent,
      category: races.category,
      className: races.className,
      tag: races.tag,
      notes: races.notes,
      source: races.source,
      sourceRef: races.sourceRef,
      sequenceInDay: races.sequenceInDay,
    })
    .from(races)
    .innerJoin(competitions, eq(races.competitionId, competitions.id))
    .where(eq(races.userId, userId))
    .all()

  const raceIds = rows.map((r) => r.id)
  const lapRows = raceIds.length
    ? db.select().from(raceLaps).where(inArray(raceLaps.raceId, raceIds)).all()
    : []
  const lapsByRace = new Map<number, number[]>()
  for (const lap of lapRows) {
    const list = lapsByRace.get(lap.raceId) ?? []
    list[lap.lapIndex - 1] = lap.lapMs
    lapsByRace.set(lap.raceId, list)
  }

  const forPr: RaceForPr[] = rows.map((r) => ({
    id: r.id,
    distanceM: r.distanceM,
    totalTimeMs: r.totalTimeMs,
    status: r.status,
    competitionDate: r.competitionDate,
    sequenceInDay: r.sequenceInDay,
  }))
  const prProgress = buildPrProgress(forPr)
  const sbIds = collectSbRaceIds(forPr)

  return rows.map((r) => {
    const progress = prProgress.get(r.id)
    return {
      ...r,
      lapsMs: lapsByRace.get(r.id) ?? [],
      isPr: progress?.isPr ?? false,
      isSb: sbIds.has(r.id),
      previousPrMs: progress?.previousPrMs ?? null,
      deltaVsPreviousPrMs: progress?.deltaVsPreviousPrMs ?? null,
    }
  })
}

export function getRaceWithContext(userId: number, raceId: number): RaceWithContext | null {
  return listUserRacesWithContext(userId).find((r) => r.id === raceId) ?? null
}

export interface RaceDetail extends RaceWithContext {
  splitRows: ReturnType<typeof buildSplitRows>
  metrics: ReturnType<typeof computeRaceMetrics>
}

export function buildRaceDetail(race: RaceWithContext): RaceDetail {
  const laps = race.lapsMs.map((ms) => ms / 1000)
  return {
    ...race,
    splitRows: buildSplitRows(laps, race.distanceM),
    metrics: computeRaceMetrics(laps, race.distanceM),
  }
}

/** Replace a race's laps with a new ordered list of millisecond values. */
export function setRaceLaps(raceId: number, lapsMs: number[]): void {
  const db = useDb()
  db.delete(raceLaps).where(eq(raceLaps.raceId, raceId)).run()
  if (!lapsMs.length) return
  db.insert(raceLaps)
    .values(lapsMs.map((lapMs, i) => ({ raceId, lapIndex: i + 1, lapMs })))
    .run()
}

/** Next sequence_in_day value for races already on this date for this user (plan section 5.4/7). */
export function nextSequenceInDay(userId: number, competitionDate: string): number {
  const db = useDb()
  const sameDay = db
    .select({ sequenceInDay: races.sequenceInDay })
    .from(races)
    .innerJoin(competitions, eq(races.competitionId, competitions.id))
    .where(and(eq(races.userId, userId), eq(competitions.date, competitionDate)))
    .orderBy(desc(races.sequenceInDay))
    .limit(1)
    .all()
  return (sameDay[0]?.sequenceInDay ?? -1) + 1
}

export function orderedRaceIdsForCompetition(competitionId: number) {
  const db = useDb()
  return db
    .select({ id: races.id })
    .from(races)
    .where(eq(races.competitionId, competitionId))
    .orderBy(asc(races.distanceM))
    .all()
}
