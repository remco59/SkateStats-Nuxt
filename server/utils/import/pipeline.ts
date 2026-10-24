import { randomUUID } from 'node:crypto'
import { and, eq, lt } from 'drizzle-orm'
import type { Db } from '../../db/client'
import { blacklist, competitions, importPreviewBatches, raceBlacklist, raceLaps, races } from '../../db/schema'
import {
  competitionIdentitySignature,
  compareRaceForImport,
  raceIdentitySignature,
  type ImportSourceName,
  type RaceIdentityInput,
} from '../dedupe'

/**
 * Generic, source-agnostic import pipeline (REBUILD_PLAN.md section 8:
 * built source-agnostic from the OSTA phase so SSR/PDF add sources
 * instead of needing a later consolidation pass). Implements the
 * de-duplication contract from section 6: competition identity ignores
 * source (rule 1), race identity is distance+lane+opponent+time+status+
 * laps (rule 2), a same-slot-but-different-value race becomes an
 * "update candidate" requiring an explicit choice rather than a silent
 * overwrite (rule 3), and committing a batch is one transaction (rule 6).
 *
 * Every function here takes `db` as a parameter (rather than calling
 * useDb() internally) so the dedup logic -- the part that most needs
 * verifying -- can be exercised directly in Vitest against a real
 * better-sqlite3 database, not just through a running Nuxt server.
 */

export interface ParsedImportRace {
  distanceM: number
  totalTimeMs: number | null
  status: string
  lane?: string | null
  opponent?: string | null
  lapsMs: number[] | null
  notes: string
  sourceRef: string | null
}

export interface ParsedImportCompetition {
  name: string
  venue: string | null
  date: string
  sourceRef: string | null
  results: ParsedImportRace[]
}

export interface ParsedImportPayload {
  source: ImportSourceName
  competitions: ParsedImportCompetition[]
}

export type RacePreviewAction = 'new' | 'identical' | 'update_candidate' | 'blacklisted'

export interface RacePreviewItem {
  race: ParsedImportRace
  action: RacePreviewAction
  existingRaceId?: number
  identitySignature: string
  /**
   * Key to use for `updateChoices` lookups. `identitySignature` alone is only
   * unique within one competition (see dedupe.ts), so this scopes it by the
   * competition it belongs to to avoid cross-competition collisions when a
   * batch contains multiple competitions with identically-shaped races.
   */
  updateChoiceKey: string
}

export type CompetitionPreviewAction = 'new_competition' | 'attach_to_existing' | 'blacklisted'

export interface CompetitionPreviewItem {
  competition: ParsedImportCompetition
  action: CompetitionPreviewAction
  existingCompetitionId?: number
  competitionSignature: string
  races: RacePreviewItem[]
}

export interface ImportPreview {
  source: ImportSourceName
  items: CompetitionPreviewItem[]
  /** Set on the batch the dashboard's OSTA monitor keeps for "new data available". */
  origin?: 'monitor'
}

function raceIdentityInput(r: ParsedImportRace): RaceIdentityInput {
  return {
    distanceM: r.distanceM,
    lane: r.lane ?? null,
    opponent: r.opponent ?? null,
    totalTimeMs: r.totalTimeMs,
    status: r.status,
    lapsMs: r.lapsMs,
  }
}

/** Classifies every competition/race in a parsed payload against the user's existing data + blacklists. */
export function classifyImportPayload(db: Db, userId: number, payload: ParsedImportPayload): ImportPreview {
  const existingCompetitions = db.select().from(competitions).where(eq(competitions.userId, userId)).all()
  const blacklistedCompetitions = new Set(
    db.select().from(blacklist).where(eq(blacklist.userId, userId)).all().map((b) => b.signature),
  )
  const blacklistedRaces = db.select().from(raceBlacklist).where(eq(raceBlacklist.userId, userId)).all()

  const items: CompetitionPreviewItem[] = payload.competitions.map((competition) => {
    const competitionSignature = competitionIdentitySignature(competition.date, competition.name)

    if (blacklistedCompetitions.has(competitionSignature)) {
      return {
        competition,
        action: 'blacklisted',
        competitionSignature,
        races: competition.results.map((race) => {
          const identitySignature = raceIdentitySignature(raceIdentityInput(race))
          return {
            race,
            action: 'blacklisted',
            identitySignature,
            updateChoiceKey: `${competitionSignature}::${identitySignature}`,
          }
        }),
      }
    }

    const existingMatch = existingCompetitions.find(
      (c) => competitionIdentitySignature(c.date, c.name) === competitionSignature,
    )

    const existingRacesForMatch = existingMatch
      ? db.select().from(races).where(eq(races.competitionId, existingMatch.id)).all()
      : []
    const existingLapsByRace = new Map<number, number[]>()
    for (const r of existingRacesForMatch) {
      const laps = db.select().from(raceLaps).where(eq(raceLaps.raceId, r.id)).all()
      existingLapsByRace.set(
        r.id,
        laps.sort((a, b) => a.lapIndex - b.lapIndex).map((l) => l.lapMs),
      )
    }

    const raceItems: RacePreviewItem[] = competition.results.map((race) => {
      const identitySignature = raceIdentitySignature(raceIdentityInput(race))
      const updateChoiceKey = `${competitionSignature}::${identitySignature}`

      const isRaceBlacklisted = blacklistedRaces.some(
        (b) => b.competitionSignature === competitionSignature && b.raceIdentitySignature === identitySignature,
      )
      if (isRaceBlacklisted) {
        return { race, action: 'blacklisted', identitySignature, updateChoiceKey }
      }

      for (const existingRace of existingRacesForMatch) {
        const comparison = compareRaceForImport(
          {
            distanceM: existingRace.distanceM,
            lane: existingRace.lane,
            opponent: existingRace.opponent,
            totalTimeMs: existingRace.totalTimeMs,
            status: existingRace.status,
            lapsMs: existingLapsByRace.get(existingRace.id) ?? null,
          },
          raceIdentityInput(race),
        )
        if (comparison === 'identical') {
          return { race, action: 'identical', existingRaceId: existingRace.id, identitySignature, updateChoiceKey }
        }
        if (comparison === 'update_candidate') {
          return {
            race,
            action: 'update_candidate',
            existingRaceId: existingRace.id,
            identitySignature,
            updateChoiceKey,
          }
        }
      }

      return { race, action: 'new', identitySignature, updateChoiceKey }
    })

    return {
      competition,
      action: existingMatch ? 'attach_to_existing' : 'new_competition',
      existingCompetitionId: existingMatch?.id,
      competitionSignature,
      races: raceItems,
    }
  })

  return { source: payload.source, items }
}

/** How long a stored preview stays usable. Nothing else ever cleans these up. */
const PREVIEW_TTL_HOURS = 24

/**
 * Stores a preview so the user can come back to it (the preview page, or the
 * dashboard's "import all"). Batches expire: this also drops the user's
 * expired ones, so a dashboard that keeps finding the same new data does not
 * pile up full copies of it.
 */
export function savePreviewBatch(
  db: Db,
  userId: number,
  preview: ImportPreview,
  now: Date = new Date(),
): string {
  const id = randomUUID()
  db.delete(importPreviewBatches)
    .where(and(eq(importPreviewBatches.userId, userId), lt(importPreviewBatches.expiresAt, now.toISOString())))
    .run()
  db.insert(importPreviewBatches)
    .values({
      id,
      userId,
      source: preview.source,
      payloadJson: preview as unknown as Record<string, unknown>,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PREVIEW_TTL_HOURS * 3600_000).toISOString(),
    })
    .run()
  return id
}

export function loadPreviewBatch(
  db: Db,
  userId: number,
  batchId: string,
  now: Date = new Date(),
): ImportPreview | null {
  const row = db
    .select()
    .from(importPreviewBatches)
    .where(and(eq(importPreviewBatches.id, batchId), eq(importPreviewBatches.userId, userId)))
    .get()
  if (!row) return null
  // expiresAt is null for batches saved before expiry existed: they never expire.
  if (row.expiresAt && row.expiresAt < now.toISOString()) return null
  return row.payloadJson as unknown as ImportPreview
}

export function deletePreviewBatch(db: Db, userId: number, batchId: string): void {
  db.delete(importPreviewBatches)
    .where(and(eq(importPreviewBatches.id, batchId), eq(importPreviewBatches.userId, userId)))
    .run()
}

/** The dashboard keeps ONE "new data" batch per user; a fresh check replaces it. */
export function deleteMonitorBatches(db: Db, userId: number): void {
  const rows = db.select().from(importPreviewBatches).where(eq(importPreviewBatches.userId, userId)).all()
  for (const row of rows) {
    if ((row.payloadJson as unknown as ImportPreview).origin === 'monitor') {
      db.delete(importPreviewBatches).where(eq(importPreviewBatches.id, row.id)).run()
    }
  }
}

/** Replaces a stored batch's content (same id), e.g. after an item was ignored. */
export function updatePreviewBatch(db: Db, userId: number, batchId: string, preview: ImportPreview): void {
  db.update(importPreviewBatches)
    .set({ payloadJson: preview as unknown as Record<string, unknown> })
    .where(and(eq(importPreviewBatches.id, batchId), eq(importPreviewBatches.userId, userId)))
    .run()
}

/**
 * The preview with one competition marked as blacklisted, so committing the
 * batch afterwards skips it. Pure: returns a new object.
 */
export function withCompetitionBlacklisted(preview: ImportPreview, competitionSignature: string): ImportPreview {
  return {
    ...preview,
    items: preview.items.map((item) =>
      item.competitionSignature === competitionSignature
        ? {
            ...item,
            action: 'blacklisted' as const,
            races: item.races.map((r) => ({ ...r, action: 'blacklisted' as const })),
          }
        : item,
    ),
  }
}

export type UpdateCandidateChoice = 'replace' | 'keep_both' | 'skip'

export interface CommitResult {
  importedCompetitions: number
  importedRaces: number
  updatedRaces: number
  skippedRaces: number
}

/**
 * Commits a preview batch in one transaction (rule 6). `updateChoices`
 * maps a race's updateChoiceKey (competitionSignature scoped identitySignature)
 * to an explicit choice for 'update_candidate' rows -- anything not in the
 * map defaults to 'skip' (never auto-overwrite, per rule 3). Re-classifying
 * and re-committing
 * the SAME parsed payload after a successful commit is a no-op (rule 5):
 * every previously-new race now matches an existing one and classifies
 * as 'identical'.
 */
export function commitPreviewBatch(
  db: Db,
  userId: number,
  preview: ImportPreview,
  updateChoices: Record<string, UpdateCandidateChoice> = {},
): CommitResult {
  const result: CommitResult = { importedCompetitions: 0, importedRaces: 0, updatedRaces: 0, skippedRaces: 0 }

  db.transaction((tx) => {
    for (const item of preview.items) {
      if (item.action === 'blacklisted') {
        result.skippedRaces += item.races.length
        continue
      }

      let competitionId = item.existingCompetitionId
      if (!competitionId) {
        const created = tx
          .insert(competitions)
          .values({
            userId,
            name: item.competition.name,
            venue: item.competition.venue,
            date: item.competition.date,
            source: preview.source,
            sourceMeta: item.competition.sourceRef ? { sourceRef: item.competition.sourceRef } : null,
            createdAt: new Date().toISOString(),
          })
          .returning()
          .get()
        competitionId = created.id
        result.importedCompetitions += 1
      }

      for (const raceItem of item.races) {
        if (raceItem.action === 'blacklisted' || raceItem.action === 'identical') {
          result.skippedRaces += 1
          continue
        }

        if (raceItem.action === 'update_candidate') {
          const choice = updateChoices[raceItem.updateChoiceKey] ?? 'skip'
          if (choice === 'skip') {
            result.skippedRaces += 1
            continue
          }
          if (choice === 'replace' && raceItem.existingRaceId) {
            tx.update(races)
              .set({
                totalTimeMs: raceItem.race.totalTimeMs,
                status: raceItem.race.status,
                notes: raceItem.race.notes,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(races.id, raceItem.existingRaceId))
              .run()
            tx.delete(raceLaps).where(eq(raceLaps.raceId, raceItem.existingRaceId)).run()
            if (raceItem.race.lapsMs?.length) {
              tx.insert(raceLaps)
                .values(
                  raceItem.race.lapsMs.map((lapMs, i) => ({
                    raceId: raceItem.existingRaceId!,
                    lapIndex: i + 1,
                    lapMs,
                  })),
                )
                .run()
            }
            result.updatedRaces += 1
            continue
          }
          // 'keep_both' (or 'replace' with no existing id, defensively) falls through to insert-as-new below.
        }

        const now = new Date().toISOString()
        const inserted = tx
          .insert(races)
          .values({
            competitionId,
            userId,
            distanceM: raceItem.race.distanceM,
            status: raceItem.race.status,
            totalTimeMs: raceItem.race.totalTimeMs,
            lane: raceItem.race.lane ?? null,
            opponent: raceItem.race.opponent ?? null,
            notes: raceItem.race.notes,
            source: preview.source,
            sourceRef: raceItem.race.sourceRef,
            createdAt: now,
            updatedAt: now,
          })
          .returning()
          .get()

        if (raceItem.race.lapsMs?.length) {
          tx.insert(raceLaps)
            .values(raceItem.race.lapsMs.map((lapMs, i) => ({ raceId: inserted.id, lapIndex: i + 1, lapMs })))
            .run()
        }
        result.importedRaces += 1
      }
    }
  })

  return result
}

export function addCompetitionToBlacklist(db: Db, userId: number, item: CompetitionPreviewItem): void {
  db.insert(blacklist)
    .values({
      userId,
      signature: item.competitionSignature,
      competitionName: item.competition.name,
      competitionDate: item.competition.date,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run()
}
