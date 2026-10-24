import { asc } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import golden from '../../reference/fixtures/calculations/golden_duplicates.json'
import { createTestDb } from './helpers/test-db'
import { competitions, raceLaps, races, users } from '../../server/db/schema'
import {
  canonicalCompetitionName,
  canonicalCompetitionVenue,
  consolidateDuplicateCompetitions,
} from '../../server/utils/competition-merge'

interface OldComp { id: number; owner: number; name: string; venue: string | null; date: string; notes: string | null }
interface OldRace {
  id: number; competition_id: number; skater_id: number; distance_m: number; total_time_ms: number | null
  lane: string | null; opponent: string | null; laps_ms: number[]; dnf: number; notes: string | null
}

function load(scenario: { competitions: OldComp[]; races: OldRace[] }) {
  const db = createTestDb()
  const now = new Date().toISOString()
  const owners = new Set(scenario.competitions.map((c) => c.owner))
  for (const id of owners) {
    db.insert(users).values({ id, username: `u${id}`, passwordHash: 'x', skaterName: `U${id}`, createdAt: now, updatedAt: now }).run()
  }
  for (const c of scenario.competitions) {
    db.insert(competitions).values({ id: c.id, userId: c.owner, name: c.name, venue: c.venue, date: c.date, notes: c.notes, createdAt: now }).run()
  }
  const ownerOf = new Map(scenario.competitions.map((c) => [c.id, c.owner]))
  for (const r of scenario.races) {
    db.insert(races)
      .values({
        id: r.id, competitionId: r.competition_id, userId: ownerOf.get(r.competition_id)!, distanceM: r.distance_m,
        status: r.dnf ? 'dnf' : 'finished', totalTimeMs: r.total_time_ms, lane: r.lane, opponent: r.opponent, notes: r.notes,
        createdAt: now, updatedAt: now,
      })
      .run()
    r.laps_ms.forEach((lapMs, i) => db.insert(raceLaps).values({ raceId: r.id, lapIndex: i + 1, lapMs }).run())
  }
  return db
}

describe('consolidateDuplicateCompetitions against the old app', () => {
  for (const scenario of golden.scenarios) {
    it(scenario.name, () => {
      const db = load(scenario as never)
      const result = consolidateDuplicateCompetitions(db)
      const want = scenario.expected

      expect({
        merged_competitions: result.mergedCompetitions,
        moved_races: result.movedRaces,
        removed_duplicate_races: result.removedDuplicateRaces,
      }).toEqual(want.counts)
      expect(
        db.select().from(competitions).orderBy(asc(competitions.id)).all().map((c) => ({
          id: c.id, owner: c.userId, name: c.name, venue: c.venue, date: c.date, notes: c.notes,
        })),
      ).toEqual(want.competitions)
      expect(Object.fromEntries(db.select().from(races).orderBy(asc(races.id)).all().map((r) => [String(r.id), r.competitionId]))).toEqual(want.races)
    })
  }

  it('a dry run reports the merge without changing anything', () => {
    const scenario = golden.scenarios[0]!
    const db = load(scenario as never)
    const result = consolidateDuplicateCompetitions(db, { dryRun: true })
    expect(result.mergedCompetitions).toBe(2)
    expect(result.groups).toEqual([{ survivorId: 1, survivorName: 'Herfstcup 2025', mergedIds: [2, 3] }])
    expect(db.select().from(competitions).all()).toHaveLength(3)
    expect(db.select().from(races).all()).toHaveLength(4)
  })

  it('is idempotent', () => {
    const db = load(golden.scenarios[3] as never)
    consolidateDuplicateCompetitions(db)
    expect(consolidateDuplicateCompetitions(db)).toMatchObject({ mergedCompetitions: 0, movedRaces: 0, removedDuplicateRaces: 0 })
  })

  it('keeps same-day race order stable after a merge', () => {
    const db = load(golden.scenarios[3] as never)
    consolidateDuplicateCompetitions(db)
    const sequences = db.select().from(races).orderBy(asc(races.sequenceInDay)).all().map((r) => r.sequenceInDay)
    expect(sequences).toEqual([...sequences.keys()])
  })
})

describe('canonical names', () => {
  it.each([
    ['Herfstcup uitslag 05-10-2025', 'herfstcup'],
    ['Herfstcup 2025', 'herfstcup'],
    ['  KNSB-Cup  (Heerenveen)!', 'knsb cup heerenveen'],
    ['Cup 2e Ronde', 'cup 2e ronde'],
  ])('%j -> %j', (input, expected) => {
    expect(canonicalCompetitionName(input)).toBe(expected)
  })

  it('treats a trailing country code as metadata', () => {
    expect(canonicalCompetitionVenue('Thialf (NED)')).toBe('thialf')
    expect(canonicalCompetitionVenue('Thialf')).toBe('thialf')
    expect(canonicalCompetitionVenue(null)).toBe('')
  })
})
