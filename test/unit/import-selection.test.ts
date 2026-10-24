import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createTestDb, seedUser } from './helpers/test-db'
import {
  addCompetitionToBlacklist,
  classifyImportPayload,
  commitPreviewBatch,
  releaseBlacklistedSelection,
  type ParsedImportCompetition,
  type ParsedImportRace,
} from '../../server/utils/import/pipeline'
import { blacklist, competitions, raceBlacklist, races } from '../../server/db/schema'

function race(distanceM: number, totalTimeMs: number, extra: Partial<ParsedImportRace> = {}): ParsedImportRace {
  return { distanceM, totalTimeMs, status: 'finished', lane: null, opponent: null, lapsMs: null, notes: '', sourceRef: null, ...extra }
}

function comp(results: ParsedImportRace[], name = 'Herfstcup', date = '2025-10-05'): ParsedImportCompetition {
  return { name, venue: 'Thialf', date, sourceRef: null, results }
}

const keys = (preview: ReturnType<typeof classifyImportPayload>) =>
  Object.fromEntries(preview.items.flatMap((i) => i.races.map((r) => [`${r.race.distanceM}`, r.updateChoiceKey])))

describe('import preview: choosing which races to import', () => {
  it('only imports the ticked races', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const preview = classifyImportPayload(db, user.id, { source: 'osta', competitions: [comp([race(500, 40000), race(1000, 82000), race(1500, 130000)])] })
    const k = keys(preview)

    const result = commitPreviewBatch(db, user.id, preview, {}, { selectedRaceKeys: new Set([k['500']!, k['1500']!]) })

    expect(result).toEqual({ importedCompetitions: 1, importedRaces: 2, updatedRaces: 0, skippedRaces: 1 })
    expect(db.select().from(races).all().map((r) => r.distanceM).sort((a, b) => a - b)).toEqual([500, 1500])
  })

  it('creates no competition when none of its races is ticked', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const preview = classifyImportPayload(db, user.id, {
      source: 'osta',
      competitions: [comp([race(500, 40000)], 'A'), comp([race(1000, 82000)], 'B', '2025-10-06')],
    })

    const result = commitPreviewBatch(db, user.id, preview, {}, { selectedRaceKeys: new Set([keys(preview)['1000']!]) })

    expect(result.importedCompetitions).toBe(1)
    expect(db.select().from(competitions).all().map((c) => c.name)).toEqual(['B'])
  })

  it('without a selection every new race is imported (dashboard import-all, OSTA monitor)', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const preview = classifyImportPayload(db, user.id, { source: 'osta', competitions: [comp([race(500, 40000), race(1000, 82000)])] })
    expect(commitPreviewBatch(db, user.id, preview).importedRaces).toBe(2)
  })
})

describe('"toevoegen als nieuwe wedstrijd"', () => {
  it('adds ticked races of an existing competition to a new competition, even ones already present', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const payload = { source: 'osta' as const, competitions: [comp([race(500, 40000), race(1000, 82000)])] }
    commitPreviewBatch(db, user.id, classifyImportPayload(db, user.id, payload))

    const again = classifyImportPayload(db, user.id, payload)
    expect(again.items[0]!.action).toBe('attach_to_existing')
    expect(again.items[0]!.races.every((r) => r.action === 'identical')).toBe(true)

    const result = commitPreviewBatch(db, user.id, again, {}, { selectedRaceKeys: new Set([keys(again)['500']!]), forceNewCompetition: true })

    expect(result).toMatchObject({ importedCompetitions: 1, importedRaces: 1, skippedRaces: 1 })
    expect(db.select().from(competitions).all()).toHaveLength(2)
    expect(db.select().from(races).all()).toHaveLength(3)
  })

  it('leaves competitions alone in which only new races are ticked', () => {
    const db = createTestDb()
    const user = seedUser(db)
    commitPreviewBatch(db, user.id, classifyImportPayload(db, user.id, { source: 'osta', competitions: [comp([race(500, 40000)])] }))

    // Same competition now also has a new 1000m; nothing already present is ticked.
    const again = classifyImportPayload(db, user.id, { source: 'osta', competitions: [comp([race(500, 40000), race(1000, 82000)])] })
    const result = commitPreviewBatch(db, user.id, again, {}, { selectedRaceKeys: new Set([keys(again)['1000']!]), forceNewCompetition: true })

    expect(result).toMatchObject({ importedCompetitions: 0, importedRaces: 1 })
    expect(db.select().from(competitions).all()).toHaveLength(1)
  })

  it('a normal import ignores ticked races that are already present', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const payload = { source: 'osta' as const, competitions: [comp([race(500, 40000)])] }
    commitPreviewBatch(db, user.id, classifyImportPayload(db, user.id, payload))
    const again = classifyImportPayload(db, user.id, payload)

    const result = commitPreviewBatch(db, user.id, again, {}, { selectedRaceKeys: new Set([keys(again)['500']!]) })

    expect(result.importedRaces).toBe(0)
    expect(db.select().from(races).all()).toHaveLength(1)
  })
})

describe('ticking an ignored competition or race', () => {
  it('releases a blacklisted competition and imports the ticked races', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const payload = { source: 'osta' as const, competitions: [comp([race(500, 40000), race(1000, 82000)])] }
    const first = classifyImportPayload(db, user.id, payload)
    addCompetitionToBlacklist(db, user.id, first.items[0]!)

    const blocked = classifyImportPayload(db, user.id, payload)
    expect(blocked.items[0]!.action).toBe('blacklisted')
    const selected = new Set([keys(blocked)['500']!])

    const released = releaseBlacklistedSelection(db, user.id, blocked, selected)
    expect(db.select().from(blacklist).where(eq(blacklist.userId, user.id)).all()).toHaveLength(0)
    expect(released.items[0]!.action).toBe('new_competition')

    const result = commitPreviewBatch(db, user.id, released, {}, { selectedRaceKeys: selected })
    expect(result).toMatchObject({ importedCompetitions: 1, importedRaces: 1 })
  })

  it('releases only the ticked race-level blacklist entries', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const payload = { source: 'osta' as const, competitions: [comp([race(500, 40000), race(1000, 82000)])] }
    const preview = classifyImportPayload(db, user.id, payload)
    for (const r of preview.items[0]!.races) {
      db.insert(raceBlacklist).values({ userId: user.id, competitionSignature: preview.items[0]!.competitionSignature, raceIdentitySignature: r.identitySignature }).run()
    }
    const blocked = classifyImportPayload(db, user.id, payload)
    expect(blocked.items[0]!.races.map((r) => r.action)).toEqual(['blacklisted', 'blacklisted'])

    const released = releaseBlacklistedSelection(db, user.id, blocked, new Set([keys(blocked)['1000']!]))

    expect(released.items[0]!.races.map((r) => r.action)).toEqual(['blacklisted', 'new'])
    expect(db.select().from(raceBlacklist).all()).toHaveLength(1)
  })

  it('leaves everything alone when nothing blacklisted is ticked', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const preview = classifyImportPayload(db, user.id, { source: 'osta', competitions: [comp([race(500, 40000)])] })
    expect(releaseBlacklistedSelection(db, user.id, preview, new Set(Object.values(keys(preview))))).toBe(preview)
  })
})
