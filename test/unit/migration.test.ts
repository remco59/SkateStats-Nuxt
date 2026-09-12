import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { migrateOldDatabase } from '../../server/utils/migration'
import { createSyntheticOldDb } from '../../scripts/lib/synthetic-old-db'
import { createTestDb } from './helpers/test-db'
import { competitions, races, raceLaps, users, ostaProfileLinks, blacklist } from '../../server/db/schema'

describe('v1 -> v2 migration (REBUILD_PLAN.md section 9)', () => {
  it('migrates every row and reports matching before/after counts', () => {
    const oldDb = createSyntheticOldDb()
    const newDb = createTestDb()

    const report = migrateOldDatabase(oldDb, newDb)

    expect(report.before).toEqual(report.after)
    expect(report.before).toEqual({
      users: 1,
      competitions: 2,
      races: 5,
      targets: 1,
      ostaProfileLinks: 1,
      blacklist: 1,
    })
  })

  it('preserves the legacy password hash as-is (compat-verified at login, not reset)', () => {
    const newDb = createTestDb()
    migrateOldDatabase(createSyntheticOldDb(), newDb)
    const user = newDb.select().from(users).where(eq(users.id, 1)).get()!
    expect(user.passwordHash).toBe('pbkdf2_sha256$600000$aabbccdd$eeff00112233')
  })

  it('derives a competition owner from its races when owner_user_id is null', () => {
    const newDb = createTestDb()
    migrateOldDatabase(createSyntheticOldDb(), newDb)
    const comp2 = newDb.select().from(competitions).where(eq(competitions.id, 2)).get()!
    expect(comp2.userId).toBe(1)
  })

  it('a dnf=1 race becomes status=dnf with totalTimeMs dropped, and is flagged as an issue', () => {
    const newDb = createTestDb()
    const report = migrateOldDatabase(createSyntheticOldDb(), newDb)
    const race2 = newDb.select().from(races).where(eq(races.id, 2)).get()!
    expect(race2.status).toBe('dnf')
    expect(race2.totalTimeMs).toBeNull()
    expect(report.issues.some((i) => i.table === 'race' && i.rowId === 2)).toBe(true)
  })

  it('an "outdoor" tag_key becomes trackType=outdoor with no tag, not a carried-over tag', () => {
    const newDb = createTestDb()
    migrateOldDatabase(createSyntheticOldDb(), newDb)
    const race3 = newDb.select().from(races).where(eq(races.id, 3)).get()!
    expect(race3.trackType).toBe('outdoor')
    expect(race3.tag).toBeNull()
  })

  it('an unknown tag_key is dropped and reported as an issue, not silently copied', () => {
    const newDb = createTestDb()
    const report = migrateOldDatabase(createSyntheticOldDb(), newDb)
    const race4 = newDb.select().from(races).where(eq(races.id, 4)).get()!
    expect(race4.tag).toBeNull()
    expect(report.issues.some((i) => i.message.includes('some_removed_tag'))).toBe(true)
  })

  it('parses laps_csv into structured race_laps rows with clean millisecond values', () => {
    const newDb = createTestDb()
    migrateOldDatabase(createSyntheticOldDb(), newDb)
    const laps = newDb.select().from(raceLaps).where(eq(raceLaps.raceId, 1)).all()
    expect(laps.map((l) => l.lapMs)).toEqual([20100, 21130])
  })

  it('assigns sequenceInDay per (user, competition date) in old-id ascending order', () => {
    const newDb = createTestDb()
    migrateOldDatabase(createSyntheticOldDb(), newDb)
    // Races 3, 4, 5 all belong to competition 2 (2024-02-10) for user 1.
    const r3 = newDb.select().from(races).where(eq(races.id, 3)).get()!
    const r4 = newDb.select().from(races).where(eq(races.id, 4)).get()!
    const r5 = newDb.select().from(races).where(eq(races.id, 5)).get()!
    expect([r3.sequenceInDay, r4.sequenceInDay, r5.sequenceInDay]).toEqual([0, 1, 2])
  })

  it('maps a legacy osta_monitor_config row to a primary linked profile', () => {
    const newDb = createTestDb()
    migrateOldDatabase(createSyntheticOldDb(), newDb)
    const link = newDb.select().from(ostaProfileLinks).where(eq(ostaProfileLinks.userId, 1)).get()!
    expect(link.pid).toBe('12345')
    expect(link.isPrimary).toBe(true)
    expect(link.monitorMode).toBe('notify')
  })

  it('maps a legacy osta_import_blacklist row to the new blacklist table', () => {
    const newDb = createTestDb()
    migrateOldDatabase(createSyntheticOldDb(), newDb)
    const entries = newDb.select().from(blacklist).all()
    expect(entries).toHaveLength(1)
    expect(entries[0]!.signature).toBe('2023-12-01|oud toernooi')
  })
})
