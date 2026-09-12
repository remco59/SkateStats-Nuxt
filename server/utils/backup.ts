import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db/client'
import {
  users,
  competitions,
  races,
  raceLaps,
  targets,
  blacklist,
  ostaProfileLinks,
} from '../db/schema'
import { RACE_TAGS } from '../../shared/constants'
import { parseLapsToMs } from './time'

/**
 * Account data export/import (plan sections 3/9). The JSON shape
 * deliberately mirrors the OLD app's export_user_data/import_user_data
 * (app/main.py, commit 4dc6959, L1947-2164) -- field names are the
 * literal old sqlite column names (`competition_date`, `laps_csv`,
 * `dnf` as 0/1, `tag_key`, ...) so that:
 *   1. A real backup taken from the old app (see
 *      reference/fixtures/backup/export_sample.json) imports here
 *      unmodified.
 *   2. A backup exported here could, in principle, be read by someone
 *      still running the old app.
 * New-only concepts that don't exist in the old shape (race `status`
 * beyond dnf, `trackType`, structured targets sub-fields, multiple OSTA
 * profile links, the race-level blacklist) are carried as additional
 * keys alongside the old ones, ignored by anything reading only the old
 * schema, but round-tripped losslessly between two copies of this app.
 */

const generatorProfileSchema = z
  .object({
    openingMs: z.number().int().nullable().optional(),
    avg400Ms: z.number().int().nullable().optional(),
    last400Ms: z.number().int().nullable().optional(),
    fade400Ms: z.number().int().nullable().optional(),
  })
  .nullable()
  .optional()

const backupCompetitionSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  name: z.string().optional(),
  venue: z.string().nullable().optional(),
  competition_date: z.string(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
})

const backupRaceSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  competition_id: z.union([z.number(), z.string()]),
  distance_m: z.number().int().positive().optional(),
  category: z.string().nullable().optional(),
  class_name: z.string().nullable().optional(),
  tag_key: z.string().nullable().optional(),
  track_type: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  lane: z.string().nullable().optional(),
  opponent: z.string().nullable().optional(),
  total_time_ms: z.number().int().nullable().optional(),
  laps_csv: z.string().nullable().optional(),
  dnf: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
})

const backupGoalSchema = z.object({
  distance_m: z.number().int().positive(),
  target_time_ms: z.number().int().nullable().optional(),
  target_opening_ms: z.number().int().nullable().optional(),
  target_avg_400_ms: z.number().int().nullable().optional(),
  target_last_400_ms: z.number().int().nullable().optional(),
  target_fade_400_ms: z.number().int().nullable().optional(),
  notes: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  generator_profile: generatorProfileSchema,
})

const backupOstaBlacklistSchema = z.object({
  comp_signature: z.string(),
  comp_name: z.string(),
  comp_date: z.string(),
  pid: z.string().nullable().optional(),
  race_count: z.number().int().nullable().optional(),
  created_at: z.string().optional(),
})

const backupOstaMonitorSchema = z
  .object({
    search_name: z.string().nullable().optional(),
    pid: z.string().nullable().optional(),
    mode: z.string().nullable().optional(),
    season: z.string().nullable().optional(),
    updated_at: z.string().optional(),
  })
  .nullable()
  .optional()

export const backupPayloadSchema = z.object({
  exported_at: z.string().optional(),
  user: z
    .object({
      theme_preference: z.string().optional(),
      motion_preference: z.string().optional(),
    })
    .optional(),
  osta_monitor: backupOstaMonitorSchema,
  osta_profile_links: z
    .array(
      z.object({
        pid: z.string(),
        search_name: z.string(),
        season: z.string(),
        monitor_mode: z.string().nullable().optional(),
        is_primary: z.boolean().nullable().optional(),
      }),
    )
    .optional(),
  osta_import_blacklist: z.array(backupOstaBlacklistSchema).default([]),
  goals: z.array(backupGoalSchema).default([]),
  competitions: z.array(backupCompetitionSchema),
  races: z.array(backupRaceSchema),
})

export type BackupPayload = z.infer<typeof backupPayloadSchema>

export interface ImportResult {
  competitions: number
  races: number
  goals: number
}

function lapsMsToCsv(lapsMs: number[]): string | null {
  if (!lapsMs.length) return null
  return lapsMs.map((ms) => (ms / 1000).toFixed(2)).join(',')
}

export function exportUserData(db: Db, userId: number): BackupPayload {
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (!user) throw new Error(`user ${userId} not found`)

  const links = db.select().from(ostaProfileLinks).where(eq(ostaProfileLinks.userId, userId)).all()
  const primaryLink = links.find((l) => l.isPrimary) ?? links[0] ?? null

  const userCompetitions = db
    .select()
    .from(competitions)
    .where(eq(competitions.userId, userId))
    .all()
    .sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1))

  const competitionById = new Map(userCompetitions.map((c) => [c.id, c]))

  const userRaces = db
    .select()
    .from(races)
    .where(eq(races.userId, userId))
    .all()
    .sort((a, b) => {
      const ca = competitionById.get(a.competitionId)!
      const cb = competitionById.get(b.competitionId)!
      if (ca.date !== cb.date) return ca.date < cb.date ? -1 : 1
      return a.id - b.id
    })

  const userTargets = db.select().from(targets).where(eq(targets.userId, userId)).all()
  const userBlacklist = db.select().from(blacklist).where(eq(blacklist.userId, userId)).all()

  return {
    exported_at: new Date().toISOString(),
    user: {
      theme_preference: user.themePreference,
      motion_preference: user.motionPreference,
    },
    osta_monitor: primaryLink
      ? {
          search_name: primaryLink.searchName,
          pid: primaryLink.pid,
          mode: primaryLink.monitorMode,
          season: primaryLink.season,
          updated_at: primaryLink.createdAt,
        }
      : null,
    osta_profile_links: links.map((l) => ({
      pid: l.pid,
      search_name: l.searchName,
      season: l.season,
      monitor_mode: l.monitorMode,
      is_primary: l.isPrimary,
    })),
    osta_import_blacklist: userBlacklist.map((b) => ({
      comp_signature: b.signature,
      comp_name: b.competitionName,
      comp_date: b.competitionDate,
      pid: null,
      race_count: 0,
      created_at: b.createdAt,
    })),
    goals: userTargets.map((t) => {
      const profile = t.generatorProfileJson as {
        openingMs?: number | null
        avg400Ms?: number | null
        last400Ms?: number | null
        fade400Ms?: number | null
      } | null
      return {
        distance_m: t.distanceM,
        target_time_ms: t.targetTimeMs,
        target_opening_ms: profile?.openingMs ?? null,
        target_avg_400_ms: profile?.avg400Ms ?? null,
        target_last_400_ms: profile?.last400Ms ?? null,
        target_fade_400_ms: profile?.fade400Ms ?? null,
        notes: t.notes,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
        generator_profile: profile ?? null,
      }
    }),
    competitions: userCompetitions.map((c) => ({
      id: c.id,
      name: c.name,
      venue: c.venue,
      competition_date: c.date,
      notes: c.notes,
      created_at: c.createdAt,
    })),
    races: userRaces.map((r) => {
      const laps = db
        .select()
        .from(raceLaps)
        .where(eq(raceLaps.raceId, r.id))
        .all()
        .sort((a, b) => a.lapIndex - b.lapIndex)
      const comp = competitionById.get(r.competitionId)!
      return {
        id: r.id,
        competition_id: r.competitionId,
        distance_m: r.distanceM,
        category: r.category,
        class_name: r.className,
        tag_key: r.trackType === 'outdoor' ? null : r.tag,
        track_type: r.trackType,
        status: r.status,
        lane: r.lane,
        opponent: r.opponent,
        total_time_ms: r.totalTimeMs,
        laps_csv: lapsMsToCsv(laps.map((l) => l.lapMs)),
        dnf: r.status === 'finished' ? 0 : 1,
        notes: r.notes,
        created_at: r.createdAt,
        competition_name: comp.name,
        venue: comp.venue,
        competition_date: comp.date,
      }
    }),
  }
}

/** Old-app `normalize_race_tag`: unknown/blank tag_key collapses to null. */
function normalizeRaceTag(tagKey: string | null | undefined): string | null {
  if (!tagKey) return null
  return (RACE_TAGS as readonly string[]).includes(tagKey) ? tagKey : null
}

export function importUserData(db: Db, userId: number, payload: BackupPayload): ImportResult {
  const validCompetitionIds = new Set(
    payload.competitions.map((c) => c.id).filter((id) => id !== undefined),
  )
  for (const race of payload.races) {
    if (!validCompetitionIds.has(race.competition_id)) {
      throw new Error('A race in the backup references an unknown competition.')
    }
  }

  return db.transaction((tx) => {
    tx.delete(targets).where(eq(targets.userId, userId)).run()
    tx.delete(blacklist).where(eq(blacklist.userId, userId)).run()
    // Cascades to races -> race_laps via FK ON DELETE CASCADE.
    tx.delete(competitions).where(eq(competitions.userId, userId)).run()

    if (payload.user) {
      const theme = ['dark', 'light', 'system'].includes(payload.user.theme_preference ?? '')
        ? payload.user.theme_preference!
        : 'dark'
      const motion = ['all', 'reduced'].includes(payload.user.motion_preference ?? '')
        ? payload.user.motion_preference!
        : 'all'
      tx.update(users)
        .set({ themePreference: theme, motionPreference: motion, updatedAt: new Date().toISOString() })
        .where(eq(users.id, userId))
        .run()
    }

    if (payload.osta_profile_links?.length) {
      tx.delete(ostaProfileLinks).where(eq(ostaProfileLinks.userId, userId)).run()
      for (const link of payload.osta_profile_links) {
        tx.insert(ostaProfileLinks)
          .values({
            userId,
            pid: link.pid,
            searchName: link.search_name,
            season: link.season,
            monitorMode: link.monitor_mode ?? 'notify',
            isPrimary: link.is_primary ?? false,
            createdAt: new Date().toISOString(),
          })
          .run()
      }
    } else if (payload.osta_monitor?.pid) {
      tx.delete(ostaProfileLinks).where(eq(ostaProfileLinks.userId, userId)).run()
      tx.insert(ostaProfileLinks)
        .values({
          userId,
          pid: payload.osta_monitor.pid,
          searchName: payload.osta_monitor.search_name || 'Skater',
          season: payload.osta_monitor.season || String(new Date().getFullYear()),
          monitorMode: payload.osta_monitor.mode || 'notify',
          isPrimary: true,
          createdAt: payload.osta_monitor.updated_at ?? new Date().toISOString(),
        })
        .run()
    }

    const competitionIdMap = new Map<string | number, number>()
    let importedCompetitions = 0
    let importedRaces = 0
    let importedGoals = 0

    for (const item of payload.competitions) {
      const created = tx
        .insert(competitions)
        .values({
          userId,
          name: item.name?.trim() || 'Onbekende wedstrijd',
          venue: item.venue?.trim() || null,
          date: item.competition_date,
          notes: item.notes?.trim() || null,
          source: 'manual',
          createdAt: item.created_at ?? new Date().toISOString(),
        })
        .returning()
        .get()
      if (item.id !== undefined) competitionIdMap.set(item.id, created.id)
      importedCompetitions += 1
    }

    for (const item of payload.races) {
      const newCompetitionId = competitionIdMap.get(item.competition_id)!
      const isDnf = item.status ? item.status !== 'finished' : (item.dnf ?? 0) === 1
      const status = item.status ?? (isDnf ? 'dnf' : 'finished')
      const trackType = item.track_type ?? (item.tag_key === 'outdoor' ? 'outdoor' : 'indoor')
      const tag = item.track_type === 'outdoor' ? null : normalizeRaceTag(item.tag_key)

      const created = tx
        .insert(races)
        .values({
          competitionId: newCompetitionId,
          userId,
          distanceM: item.distance_m ?? 0,
          status,
          totalTimeMs: status === 'finished' ? (item.total_time_ms ?? null) : null,
          trackType,
          lane: item.lane?.trim() || null,
          opponent: item.opponent?.trim() || null,
          category: item.category ?? null,
          className: item.class_name ?? null,
          tag,
          notes: item.notes?.trim() || null,
          source: 'manual',
          sequenceInDay: 0,
          createdAt: item.created_at ?? new Date().toISOString(),
          updatedAt: item.created_at ?? new Date().toISOString(),
        })
        .returning()
        .get()

      if (item.laps_csv) {
        const parsed = parseLapsToMs(item.laps_csv)
        if (!parsed.error && parsed.lapsMs.length) {
          tx.insert(raceLaps)
            .values(parsed.lapsMs.map((lapMs, i) => ({ raceId: created.id, lapIndex: i + 1, lapMs })))
            .run()
        }
      }
      importedRaces += 1
    }

    for (const item of payload.goals) {
      const profile = item.generator_profile ?? {
        openingMs: item.target_opening_ms,
        avg400Ms: item.target_avg_400_ms,
        last400Ms: item.target_last_400_ms,
        fade400Ms: item.target_fade_400_ms,
      }
      const hasProfile = Object.values(profile).some((v) => v !== null && v !== undefined)
      const now = new Date().toISOString()
      tx.insert(targets)
        .values({
          userId,
          distanceM: item.distance_m,
          targetTimeMs: item.target_time_ms ?? null,
          generatorProfileJson: hasProfile ? profile : null,
          notes: item.notes ?? null,
          createdAt: item.created_at ?? now,
          updatedAt: item.updated_at ?? now,
        })
        .run()
      importedGoals += 1
    }

    for (const item of payload.osta_import_blacklist) {
      tx.insert(blacklist)
        .values({
          userId,
          signature: item.comp_signature,
          competitionName: item.comp_name,
          competitionDate: item.comp_date,
          createdAt: item.created_at ?? new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run()
    }

    return { competitions: importedCompetitions, races: importedRaces, goals: importedGoals }
  })
}
