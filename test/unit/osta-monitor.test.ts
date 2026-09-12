import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestDb, seedUser } from './helpers/test-db'
import { ostaProfileLinks } from '../../server/db/schema'
import { detectOstaUpdatesForUser } from '../../server/utils/osta-monitor'
import { commitPreviewBatch, loadPreviewBatch } from '../../server/utils/import/pipeline'

const FIXTURES = join(__dirname, '../../reference/fixtures/osta')

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), 'utf-8')
}

describe('OSTA monitor detection (plan section 8)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const parsed = new URL(url)
        if (parsed.searchParams.has('ZoekStr')) return new Response(fixture('search_results.html'))
        if (parsed.searchParams.get('pid') === 'NL12345' && parsed.searchParams.has('Seizoen')) {
          return new Response(fixture('results_list.html'))
        }
        if (parsed.searchParams.get('ritid') === '9002') return new Response(fixture('race_detail.html'))
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
        pid: 'NL12345',
        searchName: 'Jansen, Remco',
        season: '2024',
        monitorMode: 'notify',
        createdAt: new Date().toISOString(),
      })
      .run()

    const first = await detectOstaUpdatesForUser(db, user.id)
    expect(first.hasNew).toBe(true)
    expect(first.newCompetitionsCount).toBe(2)
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
})
