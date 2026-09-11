import { describe, expect, it } from 'vitest'
import { createTestDb, seedUser } from './helpers/test-db'
import {
  classifyImportPayload,
  commitPreviewBatch,
  type ParsedImportCompetition,
  type ParsedImportPayload,
} from '../../server/utils/import/pipeline'
import { blacklist, raceBlacklist } from '../../server/db/schema'
import { competitionIdentitySignature, raceIdentitySignature } from '../../server/utils/dedupe'

function payload(competitions: ParsedImportCompetition[], source: ParsedImportPayload['source'] = 'osta'): ParsedImportPayload {
  return { source, competitions }
}

function comp(overrides: Partial<ParsedImportCompetition> = {}): ParsedImportCompetition {
  return {
    name: 'KNSB Bekerwedstrijd Heerenveen',
    venue: 'Heerenveen (NED)',
    date: '2024-11-16',
    sourceRef: 'https://www.osta.nl/index.php?pid=NL12345',
    results: [
      { distanceM: 1500, totalTimeMs: 133900, status: 'finished', lane: null, opponent: null, lapsMs: [41500, 30200, 30800, 31400], notes: 'Geimporteerd van OSTA', sourceRef: null },
    ],
    ...overrides,
  }
}

describe('import pipeline de-duplication (plan section 6)', () => {
  it('rule 5: importing the same payload twice creates zero new rows the second time (idempotent)', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const p = payload([comp()])

    const preview1 = classifyImportPayload(db, user.id, p)
    expect(preview1.items[0]!.action).toBe('new_competition')
    expect(preview1.items[0]!.races[0]!.action).toBe('new')
    const result1 = commitPreviewBatch(db, user.id, preview1)
    expect(result1).toEqual({ importedCompetitions: 1, importedRaces: 1, updatedRaces: 0, skippedRaces: 0 })

    const preview2 = classifyImportPayload(db, user.id, p)
    expect(preview2.items[0]!.action).toBe('attach_to_existing')
    expect(preview2.items[0]!.races[0]!.action).toBe('identical')
    const result2 = commitPreviewBatch(db, user.id, preview2)
    expect(result2).toEqual({ importedCompetitions: 0, importedRaces: 0, updatedRaces: 0, skippedRaces: 1 })
  })

  it('rule 1: the same competition seen via OSTA then SSR attaches to the SAME competition, not a duplicate', () => {
    const db = createTestDb()
    const user = seedUser(db)

    const ostaPayload = payload([comp()], 'osta')
    commitPreviewBatch(db, user.id, classifyImportPayload(db, user.id, ostaPayload))

    // SSR sees the same competition+race (by distance/time) but with no laps.
    const ssrPayload = payload(
      [
        comp({
          sourceRef: 'https://speedskatingresults.com/index.php?p=6&e=88123',
          results: [
            { distanceM: 1500, totalTimeMs: 133900, status: 'finished', lane: null, opponent: null, lapsMs: null, notes: 'Geimporteerd van SSR', sourceRef: null },
          ],
        }),
      ],
      'ssr',
    )
    const ssrPreview = classifyImportPayload(db, user.id, ssrPayload)
    expect(ssrPreview.items[0]!.action).toBe('attach_to_existing')
    // Same distance/time/status/laps(none vs none-relevant)... SSR has no laps
    // recorded (lapsMs: null -> fingerprint ""), while the existing OSTA race
    // has laps -> different laps fingerprint -> update_candidate, not
    // silently merged and not a blind duplicate either.
    expect(ssrPreview.items[0]!.races[0]!.action).toBe('update_candidate')

    // A genuinely NEW distance from SSR for the same competition is a new race.
    const ssrNewDistance = payload(
      [
        comp({
          results: [
            { distanceM: 500, totalTimeMs: 40550, status: 'finished', lane: null, opponent: null, lapsMs: null, notes: '', sourceRef: null },
          ],
        }),
      ],
      'ssr',
    )
    const preview3 = classifyImportPayload(db, user.id, ssrNewDistance)
    expect(preview3.items[0]!.action).toBe('attach_to_existing')
    expect(preview3.items[0]!.races[0]!.action).toBe('new')
    const result3 = commitPreviewBatch(db, user.id, preview3)
    expect(result3.importedCompetitions).toBe(0) // attached, not duplicated
    expect(result3.importedRaces).toBe(1)
  })

  it('rule 2: two same-day same-distance races with different lane/opponent stay distinct', () => {
    const db = createTestDb()
    const user = seedUser(db)

    const first = comp({
      results: [{ distanceM: 500, totalTimeMs: 41000, status: 'finished', lane: 'gl', opponent: 'Pietersen, Joris', lapsMs: null, notes: '', sourceRef: null }],
    })
    commitPreviewBatch(db, user.id, classifyImportPayload(db, user.id, payload([first])))

    const second = comp({
      results: [{ distanceM: 500, totalTimeMs: 41000, status: 'finished', lane: 'bl', opponent: 'Jansen, Remco', lapsMs: null, notes: '', sourceRef: null }],
    })
    const preview = classifyImportPayload(db, user.id, payload([second]))
    expect(preview.items[0]!.races[0]!.action).toBe('new')
    const result = commitPreviewBatch(db, user.id, preview)
    expect(result.importedRaces).toBe(1)
  })

  it('rule 3: a corrected time for the same slot is an update_candidate, never auto-applied', () => {
    const db = createTestDb()
    const user = seedUser(db)
    commitPreviewBatch(db, user.id, classifyImportPayload(db, user.id, payload([comp()])))

    const corrected = comp({
      results: [{ distanceM: 1500, totalTimeMs: 133850, status: 'finished', lane: null, opponent: null, lapsMs: [41500, 30200, 30800, 31350], notes: 'correctie', sourceRef: null }],
    })
    const preview = classifyImportPayload(db, user.id, payload([corrected]))
    const raceItem = preview.items[0]!.races[0]!
    expect(raceItem.action).toBe('update_candidate')

    // Committing with no explicit choice skips it (default 'skip', never auto-applied).
    const resultSkip = commitPreviewBatch(db, user.id, preview)
    expect(resultSkip.updatedRaces).toBe(0)
    expect(resultSkip.skippedRaces).toBe(1)

    // An explicit 'replace' choice applies the correction.
    const resultReplace = commitPreviewBatch(db, user.id, preview, { [raceItem.identitySignature]: 'replace' })
    expect(resultReplace.updatedRaces).toBe(1)
  })

  it('rule 4: deleting one race blacklists only that race, not the whole competition', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const twoRaceComp = comp({
      results: [
        { distanceM: 1500, totalTimeMs: 133900, status: 'finished', lane: null, opponent: null, lapsMs: [41500, 30200, 30800, 31400], notes: '', sourceRef: null },
        { distanceM: 500, totalTimeMs: 40550, status: 'finished', lane: null, opponent: null, lapsMs: null, notes: '', sourceRef: null },
      ],
    })
    commitPreviewBatch(db, user.id, classifyImportPayload(db, user.id, payload([twoRaceComp])))

    // Simulate the user deleting the 500m race and blacklisting just it.
    const competitionSignature = competitionIdentitySignature(twoRaceComp.date, twoRaceComp.name)
    const raceSignature = raceIdentitySignature({
      distanceM: 500,
      lane: null,
      opponent: null,
      totalTimeMs: 40550,
      status: 'finished',
      lapsMs: null,
    })
    db.insert(raceBlacklist)
      .values({ userId: user.id, competitionSignature, raceIdentitySignature: raceSignature, createdAt: new Date().toISOString() })
      .run()

    // Re-importing the same competition: the competition itself is NOT
    // blacklisted (not in `blacklist` table), so it still attaches; the
    // 500m race IS blacklisted and must not come back, but the 1500m race
    // (already present) still classifies normally.
    expect(db.select().from(blacklist).all()).toHaveLength(0)
    const preview = classifyImportPayload(db, user.id, payload([twoRaceComp]))
    expect(preview.items[0]!.action).toBe('attach_to_existing')
    const race1500 = preview.items[0]!.races.find((r) => r.race.distanceM === 1500)!
    const race500 = preview.items[0]!.races.find((r) => r.race.distanceM === 500)!
    expect(race1500.action).toBe('identical')
    expect(race500.action).toBe('blacklisted')

    const result = commitPreviewBatch(db, user.id, preview)
    expect(result.importedRaces).toBe(0)
  })

  it('rule 6: a commit is one transaction (no partial writes on failure)', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const preview = classifyImportPayload(db, user.id, payload([comp()]))

    expect(() =>
      db.transaction(() => {
        commitPreviewBatch(db, user.id, preview)
        throw new Error('simulated failure mid-batch')
      }),
    ).toThrow()

    // Nothing from the aborted outer transaction should have been persisted.
    const preview2 = classifyImportPayload(db, user.id, payload([comp()]))
    expect(preview2.items[0]!.action).toBe('new_competition')
  })
})
