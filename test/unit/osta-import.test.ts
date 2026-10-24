import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, seedUser } from './helpers/test-db'
import { ostaProfileLinks } from '../../server/db/schema'
import { createOstaPreview, linkOstaProfile } from '../../server/utils/import/osta-import'
import { loadPreviewBatch } from '../../server/utils/import/pipeline'

const FIXTURES = join(__dirname, '../../reference/fixtures/osta')
const fixture = (name: string) => readFileSync(join(FIXTURES, name), 'utf-8')

const PID_A = '86651033-b5c2-4819-2162-08ddeb0685e4'
const PID_B = 'aaaaaaaa-0000-0000-0000-000000000002'
const SOFTELS_500_ID = 'e8db8523-9ac1-4287-b8c7-a24859a259e0'

describe('OSTA import from chosen profiles', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        const pid = parsed.searchParams.get('pid')
        if (pid && parsed.searchParams.has('Seizoen')) {
          // PID_A and PID_B both show the same results list: the merge must not double anything.
          if (pid === PID_A || pid === PID_B) return new Response(fixture('results_list.html'))
          return new Response('<html><body><div id="main"></div></body></html>')
        }
        if (parsed.pathname.endsWith('/rit.php') && parsed.searchParams.get('ID') === SOFTELS_500_ID) {
          return new Response(fixture('race_detail.html'))
        }
        return new Response('<html><body><div id="main"></div></body></html>')
      }),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it('stores a preview and links the profile for the dashboard monitor', async () => {
    const db = createTestDb()
    const user = seedUser(db)

    const batchId = await createOstaPreview(db, user.id, { searchName: 'Land, Remco', season: '2025', pids: [PID_A] })

    const preview = loadPreviewBatch(db, user.id, batchId)!
    expect(preview.items.length).toBeGreaterThan(0)
    const links = db.select().from(ostaProfileLinks).all()
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ pid: PID_A, season: '2025', monitorMode: 'notify', isPrimary: true })
  })

  it('merges several profiles into one preview without duplicating the same race', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    const single = loadPreviewBatch(db, user.id, await createOstaPreview(db, user.id, { searchName: 'Land, Remco', season: '2025', pids: [PID_A] }))!

    const both = loadPreviewBatch(db, user.id, await createOstaPreview(db, user.id, { searchName: 'Land, Remco', season: '2025', pids: [PID_A, PID_B] }))!

    const raceCount = (p: typeof single) => p.items.reduce((n, i) => n + i.races.length, 0)
    expect(raceCount(both)).toBe(raceCount(single))
    expect(db.select().from(ostaProfileLinks).all().map((l) => l.pid).sort()).toEqual([PID_A, PID_B].sort())
  })

  it('skips a chosen profile that has nothing this season and links only the ones that do', async () => {
    const db = createTestDb()
    const user = seedUser(db)

    const batchId = await createOstaPreview(db, user.id, { searchName: 'x', season: '2025', pids: [PID_A, 'empty-profile'] })

    expect(loadPreviewBatch(db, user.id, batchId)!.items.length).toBeGreaterThan(0)
    expect(db.select().from(ostaProfileLinks).all().map((l) => l.pid)).toEqual([PID_A])
  })

  it('reports it when none of the chosen profiles has data', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    await expect(createOstaPreview(db, user.id, { searchName: 'x', season: '2025', pids: ['a', 'b'] })).rejects.toThrow(
      'Geen importeerbare OSTA-data gevonden voor de gekozen profielen.',
    )
    expect(db.select().from(ostaProfileLinks).all()).toHaveLength(0)
  })

  it('says which profile failed when OSTA cannot be reached for one of several', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('netwerk weg') }))
    await expect(createOstaPreview(db, user.id, { searchName: 'x', season: '2025', pids: [PID_A, PID_B] })).rejects.toThrow(
      /^OSTA profiel .+: /,
    )
  })

  it('a single profile without results keeps OSTA\'s own message', async () => {
    const db = createTestDb()
    const user = seedUser(db)
    await expect(createOstaPreview(db, user.id, { searchName: 'x', season: '2025', pids: ['empty-profile'] })).rejects.toThrow(
      'Geen OSTA ritten gevonden',
    )
  })

  it('a later import never changes the monitor mode the user chose', () => {
    const db = createTestDb()
    const user = seedUser(db)
    linkOstaProfile(db, user.id, { pid: PID_A, searchName: 'Land, Remco', season: '2024' })
    db.update(ostaProfileLinks).set({ monitorMode: 'auto_import' }).run()

    linkOstaProfile(db, user.id, { pid: PID_A, searchName: 'Land, R.', season: 'ALL' })
    linkOstaProfile(db, user.id, { pid: PID_B, searchName: 'Land, R.', season: 'ALL' })

    const links = db.select().from(ostaProfileLinks).all()
    expect(links.find((l) => l.pid === PID_A)).toMatchObject({ monitorMode: 'auto_import', season: 'ALL', searchName: 'Land, R.', isPrimary: true })
    expect(links.find((l) => l.pid === PID_B)).toMatchObject({ monitorMode: 'notify', isPrimary: false })
  })
})
