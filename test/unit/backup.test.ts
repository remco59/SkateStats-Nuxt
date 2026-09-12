import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { backupPayloadSchema, exportUserData, importUserData } from '../../server/utils/backup'
import { createTestDb, seedUser } from './helpers/test-db'
import { competitions, races, raceLaps, targets, blacklist, ostaProfileLinks } from '../../server/db/schema'

describe('account backup export/import (plan section 9)', () => {
  it('imports a real old-app backup (export_sample.json) with matching competitions/races/targets', () => {
    const db = createTestDb()
    const user = seedUser(db)

    const raw = readFileSync('reference/fixtures/backup/export_sample.json', 'utf-8')
    const payload = backupPayloadSchema.parse(JSON.parse(raw))

    const result = importUserData(db, user.id, payload)

    expect(result).toEqual({ competitions: 1, races: 2, goals: 1 })

    const comp = db.select().from(competitions).where(eq(competitions.userId, user.id)).all()
    expect(comp).toHaveLength(1)
    expect(comp[0]!.name).toBe('KNSB Bekerwedstrijd Heerenveen')
    expect(comp[0]!.date).toBe('2024-11-16')

    const compRaces = db.select().from(races).where(eq(races.competitionId, comp[0]!.id)).all()
    expect(compRaces).toHaveLength(2)
    const r500 = compRaces.find((r) => r.distanceM === 500)!
    expect(r500.totalTimeMs).toBe(40550)
    expect(r500.status).toBe('finished')
    const r1500 = compRaces.find((r) => r.distanceM === 1500)!
    expect(r1500.totalTimeMs).toBe(133900)

    const laps = db.select().from(raceLaps).where(eq(raceLaps.raceId, r1500.id)).all()
    expect(laps.map((l) => l.lapMs)).toEqual([41500, 30200, 30800, 31400])

    const goal = db.select().from(targets).where(eq(targets.userId, user.id)).all()
    expect(goal).toHaveLength(1)
    expect(goal[0]!.distanceM).toBe(1500)
    expect(goal[0]!.targetTimeMs).toBe(130000)

    const link = db.select().from(ostaProfileLinks).where(eq(ostaProfileLinks.userId, user.id)).get()!
    expect(link.pid).toBe('NL12345')
    expect(link.isPrimary).toBe(true)

    const bl = db.select().from(blacklist).where(eq(blacklist.userId, user.id)).all()
    expect(bl).toHaveLength(1)
    expect(bl[0]!.signature).toBe('osta|2024-10-05|knsb bekerwedstrijd deventer|NL12345')
  })

  it('re-importing (re-uploading the same backup) replaces rather than duplicates', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const raw = readFileSync('reference/fixtures/backup/export_sample.json', 'utf-8')
    const payload = backupPayloadSchema.parse(JSON.parse(raw))

    importUserData(db, user.id, payload)
    importUserData(db, user.id, payload)

    expect(db.select().from(competitions).where(eq(competitions.userId, user.id)).all()).toHaveLength(1)
    expect(db.select().from(races).where(eq(races.userId, user.id)).all()).toHaveLength(2)
  })

  it('rejects a backup with a race referencing an unknown competition', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const payload = backupPayloadSchema.parse({
      competitions: [{ id: 1, competition_date: '2024-01-01', name: 'Comp' }],
      races: [{ competition_id: 999, distance_m: 500 }],
    })
    expect(() => importUserData(db, user.id, payload)).toThrow(/unknown competition/)
  })

  it('round-trips export -> import within the new app losslessly (competitions/races/laps/targets)', () => {
    const db = createTestDb()
    const user = seedUser(db)

    const comp = db
      .insert(competitions)
      .values({ userId: user.id, name: 'Wintercup', venue: 'Thialf', date: '2025-01-10', createdAt: '2025-01-10T00:00:00Z' })
      .returning()
      .get()
    const race = db
      .insert(races)
      .values({
        competitionId: comp.id,
        userId: user.id,
        distanceM: 500,
        status: 'finished',
        totalTimeMs: 40230,
        trackType: 'indoor',
        tag: 'important',
        sequenceInDay: 0,
        createdAt: '2025-01-10T00:00:00Z',
      })
      .returning()
      .get()
    db.insert(raceLaps)
      .values([
        { raceId: race.id, lapIndex: 1, lapMs: 20100 },
        { raceId: race.id, lapIndex: 2, lapMs: 20130 },
      ])
      .run()
    db.insert(targets)
      .values({ userId: user.id, distanceM: 500, targetTimeMs: 39500, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' })
      .run()

    const exported = exportUserData(db, user.id)
    const validated = backupPayloadSchema.parse(exported)

    const db2 = createTestDb()
    const user2 = seedUser(db2)
    const result = importUserData(db2, user2.id, validated)

    expect(result).toEqual({ competitions: 1, races: 1, goals: 1 })
    const comp2 = db2.select().from(competitions).where(eq(competitions.userId, user2.id)).get()!
    expect(comp2.name).toBe('Wintercup')
    const race2 = db2.select().from(races).where(eq(races.userId, user2.id)).get()!
    expect(race2.totalTimeMs).toBe(40230)
    expect(race2.tag).toBe('important')
    expect(race2.trackType).toBe('indoor')
    const laps2 = db2.select().from(raceLaps).where(eq(raceLaps.raceId, race2.id)).all()
    expect(laps2.map((l) => l.lapMs)).toEqual([20100, 20130])
  })

  it('preserves an outdoor trackType through export/import without turning it into a tag', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const comp = db
      .insert(competitions)
      .values({ userId: user.id, name: 'Buitenwedstrijd', date: '2025-02-01', createdAt: '2025-02-01T00:00:00Z' })
      .returning()
      .get()
    db.insert(races)
      .values({
        competitionId: comp.id,
        userId: user.id,
        distanceM: 3000,
        status: 'finished',
        totalTimeMs: 260000,
        trackType: 'outdoor',
        sequenceInDay: 0,
        createdAt: '2025-02-01T00:00:00Z',
      })
      .run()

    const exported = backupPayloadSchema.parse(exportUserData(db, user.id))
    const db2 = createTestDb()
    const user2 = seedUser(db2)
    importUserData(db2, user2.id, exported)
    const race2 = db2.select().from(races).where(eq(races.userId, user2.id)).get()!
    expect(race2.trackType).toBe('outdoor')
    expect(race2.tag).toBeNull()
  })

  it('a non-finished status round-trips through export/import (not collapsed to a boolean)', () => {
    const db = createTestDb()
    const user = seedUser(db)
    const comp = db
      .insert(competitions)
      .values({ userId: user.id, name: 'DQ Wedstrijd', date: '2025-03-01', createdAt: '2025-03-01T00:00:00Z' })
      .returning()
      .get()
    db.insert(races)
      .values({
        competitionId: comp.id,
        userId: user.id,
        distanceM: 500,
        status: 'dsq',
        totalTimeMs: null,
        trackType: 'indoor',
        sequenceInDay: 0,
        createdAt: '2025-03-01T00:00:00Z',
      })
      .run()

    const exported = backupPayloadSchema.parse(exportUserData(db, user.id))
    expect(exported.races[0]!.dnf).toBe(1)
    expect(exported.races[0]!.status).toBe('dsq')

    const db2 = createTestDb()
    const user2 = seedUser(db2)
    importUserData(db2, user2.id, exported)
    const race2 = db2.select().from(races).where(eq(races.userId, user2.id)).get()!
    expect(race2.status).toBe('dsq')
  })
})
