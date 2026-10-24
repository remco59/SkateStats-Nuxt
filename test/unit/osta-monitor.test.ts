import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, seedUser } from './helpers/test-db'
import { competitions, importPreviewBatches, ostaProfileLinks, races } from '../../server/db/schema'
import { detectOstaUpdatesForUser } from '../../server/utils/osta-monitor'
import {
  addCompetitionToBlacklist,
  commitPreviewBatch,
  loadPreviewBatch,
  updatePreviewBatch,
  withCompetitionBlacklisted,
} from '../../server/utils/import/pipeline'

const FIXTURES = join(__dirname, '../../reference/fixtures/osta')

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

const LAND_PID = '86651033-b5c2-4819-2162-08ddeb0685e4'
const SOFTELS_500_ID = 'e8db8523-9ac1-4287-b8c7-a24859a259e0'

describe('OSTA monitor detection (plan section 8)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        if (parsed.searchParams.has('ZoekStr')) return new Response(fixture('search_results_single.html'))
        if (parsed.searchParams.get('pid') === LAND_PID && parsed.searchParams.has('Seizoen')) {
          return new Response(fixture('results_list.html'))
        }
        if (parsed.pathname.endsWith('/rit.php') && parsed.searchParams.get('ID') === SOFTELS_500_ID) {
          return new Response(fixture('race_detail.html'))
        }
        return new Response('<html><body><div id="main"></div></body></html>')
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('finds new data on the first check, then nothing new after committing it', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    db.insert(ostaProfileLinks)
      .values({
        userId: user.id,
        pid: LAND_PID,
        searchName: 'Land, Remco',
        season: '2025',
        monitorMode: 'notify',
        createdAt: new Date().toISOString(),
      })
      .run()

    const first = await detectOstaUpdatesForUser(db, user.id)
    expect(first.hasNew).toBe(true)
    expect(first.newCompetitionsCount).toBe(4)
    expect(first.batchId).not.toBeNull()
    expect(first.errors).toEqual([])

    // lastCheckedAt should now be set.
    const link = db.select().from(ostaProfileLinks).all()[0]!
    expect(link.lastCheckedAt).not.toBeNull()

    const preview = loadPreviewBatch(db, user.id, first.batchId!)!
    commitPreviewBatch(db, user.id, preview)

    const second = await detectOstaUpdatesForUser(db, user.id)
    expect(second.hasNew).toBe(false)
    expect(second.batchId).toBeNull()
  })

  it('a monitorMode of "off" is skipped entirely', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    db.insert(ostaProfileLinks)
      .values({
        userId: user.id,
        pid: 'NL12345',
        searchName: 'Jansen, Remco',
        season: '2024',
        monitorMode: 'off',
        createdAt: new Date().toISOString(),
      })
      .run()

    const result = await detectOstaUpdatesForUser(db, user.id)
    expect(result.checked).toBe(0)
    expect(result.hasNew).toBe(false)
  })

  function link(db: ReturnType<typeof createTestDb>, userId: number, monitorMode: string, pid = LAND_PID) {
    db.insert(ostaProfileLinks)
      .values({ userId, pid, searchName: 'Land, Remco', season: '2025', monitorMode, createdAt: new Date().toISOString() })
      .run()
  }

  it('lists each new competition with its date and new race count', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    link(db, user.id, 'notify')

    const result = await detectOstaUpdatesForUser(db, user.id)
    expect(result.available).toHaveLength(4)
    expect(result.newCompetitionsCount).toBe(4)
    expect(result.newRacesCount).toBe(result.available.reduce((n, a) => n + a.newRaceCount, 0))
    for (const a of result.available) {
      expect(a.competitionSignature).toBeTruthy()
      expect(a.name).toBeTruthy()
      expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(a.newRaceCount).toBeGreaterThan(0)
      expect(a.isNewCompetition).toBe(true)
    }
    expect(result.autoImported).toBeNull()
  })

  it('auto_import brings the new data in right away, and only once', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    link(db, user.id, 'auto_import')

    const first = await detectOstaUpdatesForUser(db, user.id)
    expect(first.autoImported).not.toBeNull()
    expect(first.autoImported!.competitions).toBe(4)
    expect(db.select().from(competitions).all()).toHaveLength(4)
    expect(db.select().from(races).all()).toHaveLength(first.autoImported!.races)
    // Nothing left to offer, and no batch to import.
    expect(first.hasNew).toBe(false)
    expect(first.batchId).toBeNull()

    const second = await detectOstaUpdatesForUser(db, user.id)
    expect(second.autoImported).toBeNull()
    expect(db.select().from(competitions).all()).toHaveLength(4)
  })

  it('an ignored competition is not imported with the rest, and not offered again', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    link(db, user.id, 'notify')

    const first = await detectOstaUpdatesForUser(db, user.id)
    const ignored = first.available[0]!
    const batch = loadPreviewBatch(db, user.id, first.batchId!)!
    const item = batch.items.find((i) => i.competitionSignature === ignored.competitionSignature)!
    addCompetitionToBlacklist(db, user.id, item)
    updatePreviewBatch(db, user.id, first.batchId!, withCompetitionBlacklisted(batch, ignored.competitionSignature))

    // "Importeer alles" on the same batch...
    const result = commitPreviewBatch(db, user.id, loadPreviewBatch(db, user.id, first.batchId!)!)
    expect(result.importedCompetitions).toBe(3)
    expect(db.select().from(competitions).all().map((c) => c.name)).not.toContain(ignored.name)

    // ...and the next check does not bring it back.
    const second = await detectOstaUpdatesForUser(db, user.id)
    expect(second.hasNew).toBe(false)
    expect(second.available).toEqual([])
  })

  it('keeps one "new data" batch per user instead of one per check', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    link(db, user.id, 'notify')

    const a = await detectOstaUpdatesForUser(db, user.id)
    const b = await detectOstaUpdatesForUser(db, user.id)
    const c = await detectOstaUpdatesForUser(db, user.id)
    expect(db.select().from(importPreviewBatches).all()).toHaveLength(1)
    expect(loadPreviewBatch(db, user.id, a.batchId!)).toBeNull()
    expect(loadPreviewBatch(db, user.id, b.batchId!)).toBeNull()
    expect(loadPreviewBatch(db, user.id, c.batchId!)).not.toBeNull()
  })

  it('a stored batch expires', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    link(db, user.id, 'notify')
    const result = await detectOstaUpdatesForUser(db, user.id)

    const inTwoHours = new Date(Date.now() + 2 * 3600_000)
    const inTwoDays = new Date(Date.now() + 48 * 3600_000)
    expect(loadPreviewBatch(db, user.id, result.batchId!, inTwoHours)).not.toBeNull()
    expect(loadPreviewBatch(db, user.id, result.batchId!, inTwoDays)).toBeNull()
  })

  it('an empty season is not an error, a failing request is', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    link(db, user.id, 'notify', 'some-other-pid')
    const quiet = await detectOstaUpdatesForUser(db, user.id)
    expect(quiet.hasNew).toBe(false)
    expect(quiet.errors).toEqual([])

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('netwerk weg') }))
    const loud = await detectOstaUpdatesForUser(db, user.id)
    expect(loud.errors).toHaveLength(1)
    expect(loud.errors[0]!.message).toContain('OSTA niet bereiken')
  })
})
