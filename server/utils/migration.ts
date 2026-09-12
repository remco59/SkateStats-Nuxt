import type BetterSqlite3 from 'better-sqlite3'
import { pythonRound } from '../../shared/utils/round'
import {
  users,
  competitions,
  races,
  raceLaps,
  targets,
  blacklist,
  ostaProfileLinks,
} from '../db/schema'
import type { Db } from '../db/client'

/**
 * v1 (old FastAPI/Jinja app, app/main.py::init_db/migrate_db, commit
 * 4dc6959) -> v2 (this app) migration. Reads ONLY from the old SQLite file
 * (never mutates it) and writes ONLY into a fresh new-schema database, per
 * REBUILD_PLAN.md section 9's rollback story: rollback is "redo the
 * migration against a fresh new DB", never "undo a write against the old
 * production file".
 */

interface OldUserRow {
  id: number
  username: string
  password_hash: string
  skater_id: number
  is_admin: number
  theme_preference: string | null
  motion_preference: string | null
  created_at: string | null
  updated_at: string | null
  last_login_at: string | null
  session_version: number | null
}

interface OldSkaterRow {
  id: number
  name: string
}

interface OldCompetitionRow {
  id: number
  name: string
  venue: string | null
  competition_date: string
  notes: string | null
  created_at: string | null
  owner_user_id: number | null
}

interface OldRaceRow {
  id: number
  competition_id: number
  skater_id: number
  distance_m: number
  category: string | null
  class_name: string | null
  tag_key: string | null
  lane: string | null
  opponent: string | null
  total_time_ms: number | null
  laps_csv: string | null
  dnf: number
  notes: string | null
  created_at: string | null
}

interface OldGoalTargetRow {
  id: number
  user_id: number
  distance_m: number
  target_time_ms: number | null
  target_opening_ms: number | null
  target_avg_400_ms: number | null
  target_last_400_ms: number | null
  target_fade_400_ms: number | null
  notes: string | null
  created_at: string | null
  updated_at: string | null
}

interface OldOstaMonitorConfigRow {
  user_id: number
  search_name: string
  pid: string | null
  mode: string | null
  season: string
  updated_at: string | null
}

interface OldOstaImportBlacklistRow {
  id: number
  user_id: number
  comp_signature: string
  comp_name: string
  comp_date: string
  created_at: string | null
}

export interface MigrationRowCounts {
  users: number
  competitions: number
  races: number
  targets: number
  ostaProfileLinks: number
  blacklist: number
}

export interface MigrationIssue {
  table: string
  rowId: number | string
  message: string
}

export interface MigrationReport {
  before: MigrationRowCounts
  after: MigrationRowCounts
  issues: MigrationIssue[]
}

/** Old-app `RACE_TAGS` keys that survived into the new schema's `RACE_TAGS` unchanged. */
const CARRIED_OVER_TAGS = new Set([
  'training',
  'test',
  'important',
  'bad_ice',
  'sick',
  'injured',
  'fallen',
])

/**
 * Old app `laps_from_csv`/lap-write round-trips lap ms through
 * `f"{ms/1000:.2f}"` (2-decimal seconds), so re-parsing should recover the
 * original ms exactly for any value the old app itself wrote. A laps_csv
 * value that doesn't survive that round-trip within 1ms indicates hand-edited
 * or corrupted data, reported as an issue rather than silently rounded.
 */
function parseLegacyLapsCsv(lapsCsv: string | null, raceId: number, issues: MigrationIssue[]): number[] {
  if (!lapsCsv) return []
  const parts = lapsCsv
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  const result: number[] = []
  for (const part of parts) {
    const seconds = Number(part)
    if (!Number.isFinite(seconds)) {
      issues.push({ table: 'race', rowId: raceId, message: `laps_csv segment "${part}" is not a number` })
      continue
    }
    const ms = pythonRound(seconds * 1000)
    if (Math.abs(seconds * 1000 - ms) > 1) {
      issues.push({
        table: 'race',
        rowId: raceId,
        message: `laps_csv segment "${part}" does not round-trip cleanly to whole milliseconds`,
      })
    }
    result.push(ms)
  }
  return result
}

export function migrateOldDatabase(oldDb: BetterSqlite3.Database, newDb: Db): MigrationReport {
  const issues: MigrationIssue[] = []

  const oldUsers = oldDb.prepare('SELECT * FROM user').all() as OldUserRow[]
  const oldSkaters = oldDb.prepare('SELECT * FROM skater').all() as OldSkaterRow[]
  const oldCompetitions = oldDb.prepare('SELECT * FROM competition').all() as OldCompetitionRow[]
  const oldRaces = oldDb.prepare('SELECT * FROM race').all() as OldRaceRow[]
  const oldTargets = oldDb.prepare('SELECT * FROM goal_target').all() as OldGoalTargetRow[]
  const oldOstaConfigs = oldDb.prepare('SELECT * FROM osta_monitor_config').all() as OldOstaMonitorConfigRow[]
  const oldBlacklist = oldDb.prepare('SELECT * FROM osta_import_blacklist').all() as OldOstaImportBlacklistRow[]

  const before: MigrationRowCounts = {
    users: oldUsers.length,
    competitions: oldCompetitions.length,
    races: oldRaces.length,
    targets: oldTargets.length,
    ostaProfileLinks: oldOstaConfigs.length,
    blacklist: oldBlacklist.length,
  }

  const skaterNameById = new Map(oldSkaters.map((s) => [s.id, s.name]))
  const userIdBySkaterId = new Map(oldUsers.map((u) => [u.skater_id, u.id]))

  // --- users ---
  for (const u of oldUsers) {
    const skaterName = skaterNameById.get(u.skater_id)
    if (!skaterName) {
      issues.push({ table: 'user', rowId: u.id, message: `no skater row for skater_id ${u.skater_id}` })
    }
    newDb
      .insert(users)
      .values({
        id: u.id,
        username: u.username,
        passwordHash: u.password_hash,
        skaterName: skaterName ?? u.username,
        isAdmin: u.is_admin === 1,
        themePreference: u.theme_preference ?? 'dark',
        motionPreference: u.motion_preference ?? 'all',
        sessionVersion: u.session_version ?? 1,
        createdAt: u.created_at ?? new Date().toISOString(),
        updatedAt: u.updated_at ?? u.created_at ?? new Date().toISOString(),
        lastLoginAt: u.last_login_at,
      })
      .run()
  }

  // --- competitions ---
  const raceCompetitionOwner = new Map<number, number>()
  for (const r of oldRaces) {
    const owner = userIdBySkaterId.get(r.skater_id)
    if (owner !== undefined) raceCompetitionOwner.set(r.competition_id, owner)
  }

  for (const c of oldCompetitions) {
    const ownerUserId = c.owner_user_id ?? raceCompetitionOwner.get(c.id)
    if (!ownerUserId) {
      issues.push({
        table: 'competition',
        rowId: c.id,
        message: 'no owner_user_id and no race links to derive an owner from; skipped',
      })
      continue
    }
    newDb
      .insert(competitions)
      .values({
        id: c.id,
        userId: ownerUserId,
        name: c.name,
        venue: c.venue,
        date: c.competition_date,
        notes: c.notes,
        source: 'manual',
        createdAt: c.created_at ?? new Date().toISOString(),
      })
      .run()
  }

  // --- races (+ laps), sequence_in_day per (user, date) in old-id ASC order ---
  const migratedCompetitionIds = new Set(oldCompetitions.map((c) => c.id))
  const competitionDateById = new Map(oldCompetitions.map((c) => [c.id, c.competition_date]))
  const sequenceCounters = new Map<string, number>()

  const sortedRaces = [...oldRaces].sort((a, b) => a.id - b.id)
  for (const r of sortedRaces) {
    if (!migratedCompetitionIds.has(r.competition_id)) {
      issues.push({ table: 'race', rowId: r.id, message: `competition_id ${r.competition_id} was not migrated` })
      continue
    }
    const ownerUserId = userIdBySkaterId.get(r.skater_id)
    if (!ownerUserId) {
      issues.push({ table: 'race', rowId: r.id, message: `no user owns skater_id ${r.skater_id}; skipped` })
      continue
    }
    const date = competitionDateById.get(r.competition_id)!
    const seqKey = `${ownerUserId}:${date}`
    const sequenceInDay = sequenceCounters.get(seqKey) ?? 0
    sequenceCounters.set(seqKey, sequenceInDay + 1)

    const isDnf = r.dnf === 1
    if (isDnf && r.total_time_ms !== null) {
      issues.push({
        table: 'race',
        rowId: r.id,
        message: 'dnf=1 but total_time_ms was set in the old app; time dropped (status=dnf has no time)',
      })
    }

    let tag: string | null = null
    let trackType = 'indoor'
    if (r.tag_key === 'outdoor') {
      // Old app had "outdoor" as a race tag; the new schema models it as
      // races.track_type instead (plan section 7), not a tag value.
      trackType = 'outdoor'
    } else if (r.tag_key && CARRIED_OVER_TAGS.has(r.tag_key)) {
      tag = r.tag_key
    } else if (r.tag_key) {
      issues.push({ table: 'race', rowId: r.id, message: `unknown tag_key "${r.tag_key}" dropped` })
    }

    const lapsMs = parseLegacyLapsCsv(r.laps_csv, r.id, issues)

    newDb
      .insert(races)
      .values({
        id: r.id,
        competitionId: r.competition_id,
        userId: ownerUserId,
        distanceM: r.distance_m,
        status: isDnf ? 'dnf' : 'finished',
        totalTimeMs: isDnf ? null : r.total_time_ms,
        trackType,
        lane: r.lane,
        opponent: r.opponent,
        category: r.category,
        className: r.class_name,
        tag,
        notes: r.notes,
        source: 'manual',
        sequenceInDay,
        createdAt: r.created_at ?? new Date().toISOString(),
        updatedAt: r.created_at ?? new Date().toISOString(),
      })
      .run()

    if (lapsMs.length) {
      newDb
        .insert(raceLaps)
        .values(lapsMs.map((lapMs, i) => ({ raceId: r.id, lapIndex: i + 1, lapMs })))
        .run()
    }
  }

  // --- targets ---
  for (const t of oldTargets) {
    if (!oldUsers.some((u) => u.id === t.user_id)) {
      issues.push({ table: 'goal_target', rowId: t.id, message: `user_id ${t.user_id} was not migrated` })
      continue
    }
    newDb
      .insert(targets)
      .values({
        userId: t.user_id,
        distanceM: t.distance_m,
        targetTimeMs: t.target_time_ms,
        generatorProfileJson:
          t.target_opening_ms || t.target_avg_400_ms || t.target_last_400_ms || t.target_fade_400_ms
            ? {
                openingMs: t.target_opening_ms,
                avg400Ms: t.target_avg_400_ms,
                last400Ms: t.target_last_400_ms,
                fade400Ms: t.target_fade_400_ms,
              }
            : null,
        notes: t.notes,
        createdAt: t.created_at ?? new Date().toISOString(),
        updatedAt: t.updated_at ?? t.created_at ?? new Date().toISOString(),
      })
      .run()
  }

  // --- OSTA monitor config -> osta_profile_links (one legacy config per user -> one linked profile) ---
  for (const o of oldOstaConfigs) {
    if (!oldUsers.some((u) => u.id === o.user_id)) {
      issues.push({ table: 'osta_monitor_config', rowId: o.user_id, message: `user_id ${o.user_id} was not migrated` })
      continue
    }
    if (!o.pid) {
      issues.push({ table: 'osta_monitor_config', rowId: o.user_id, message: 'no pid set in old app; skipped' })
      continue
    }
    newDb
      .insert(ostaProfileLinks)
      .values({
        userId: o.user_id,
        pid: o.pid,
        searchName: o.search_name,
        isPrimary: true,
        monitorMode: o.mode === 'off' ? 'off' : 'notify',
        season: o.season,
        createdAt: o.updated_at ?? new Date().toISOString(),
      })
      .run()
  }

  // --- OSTA import blacklist -> blacklist ---
  for (const b of oldBlacklist) {
    if (!oldUsers.some((u) => u.id === b.user_id)) {
      issues.push({ table: 'osta_import_blacklist', rowId: b.id, message: `user_id ${b.user_id} was not migrated` })
      continue
    }
    newDb
      .insert(blacklist)
      .values({
        userId: b.user_id,
        signature: b.comp_signature,
        competitionName: b.comp_name,
        competitionDate: b.comp_date,
        createdAt: b.created_at ?? new Date().toISOString(),
      })
      .run()
  }

  const after: MigrationRowCounts = {
    users: newDb.select().from(users).all().length,
    competitions: newDb.select().from(competitions).all().length,
    races: newDb.select().from(races).all().length,
    targets: newDb.select().from(targets).all().length,
    ostaProfileLinks: newDb.select().from(ostaProfileLinks).all().length,
    blacklist: newDb.select().from(blacklist).all().length,
  }

  return { before, after, issues }
}
