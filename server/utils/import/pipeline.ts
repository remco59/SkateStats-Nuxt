import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
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

export function savePreviewBatch(db: Db, userId: number, preview: ImportPreview): string {
  const id = randomUUID()
  db.insert(importPreviewBatches)
    .values({
      id,
      userId,
      source: preview.source,
      payloadJson: preview as unknown as Record<string, unknown>,
      createdAt: new Date().toISOString(),
    })
    .run()
  return id
}

export function loadPreviewBatch(db: Db, userId: number, batchId: string): ImportPreview | null {
  const row = db
    .select()
    .from(importPreviewBatches)
    .where(and(eq(importPreviewBatches.id, batchId), eq(importPreviewBatches.userId, userId)))
    .get()
  return row ? (row.payloadJson as unknown as ImportPreview) : null
}

export function deletePreviewBatch(db: Db, userId: number, batchId: string): void {
  db.delete(importPreviewBatches)
    .where(and(eq(importPreviewBatches.id, batchId), eq(importPreviewBatches.userId, userId)))
    .run()
}

export type UpdateCandidateChoice = 'replace' | 'keep_both' | 'skip'

export interface CommitResult {
  importedCompetitions: number
  importedRaces: number
  updatedRaces: number
  skippedRaces: number
}

export interface CommitOptions {
  /**
   * `updateChoiceKey`s of the races the user ticked in the preview. Absent
   * means "every new race" (what the dashboard's one-click import and the
   * OSTA monitor do). Present, only ticked races are imported.
   */
  selectedRaceKeys?: ReadonlySet<string>
  /**
   * "Toevoegen als nieuwe wedstrijd": for an existing competition in which the
   * user ticked a race that is already present, the ticked races are added to a
   * NEW competition instead of being matched/skipped -- the user is saying this
   * is a different competition that happens to look the same.
   */
  forceNewCompetition?: boolean
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
 *
 * A competition is only created once one of its races is actually imported,
 * so unticking every race of a new competition leaves nothing behind.
 */
export function commitPreviewBatch(
  db: Db,
  userId: number,
  preview: ImportPreview,
  updateChoices: Record<string, UpdateCandidateChoice> = {},
  options: CommitOptions = {},
): CommitResult {
  const result: CommitResult = { importedCompetitions: 0, importedRaces: 0, updatedRaces: 0, skippedRaces: 0 }
  const { selectedRaceKeys, forceNewCompetition = false } = options

  db.transaction((tx) => {
    for (const item of preview.items) {
      if (item.action === 'blacklisted') {
        result.skippedRaces += item.races.length
        continue
      }

      const forceNew =
        forceNewCompetition &&
        item.existingCompetitionId !== undefined &&
        item.races.some((r) => r.action === 'identical' && (selectedRaceKeys ? selectedRaceKeys.has(r.updateChoiceKey) : true))
      let competitionId = forceNew ? undefined : item.existingCompetitionId
      const ensureCompetition = (): number => {
        if (competitionId) return competitionId
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
        return created.id
      }

      for (const raceItem of item.races) {
        if (raceItem.action === 'blacklisted') {
          result.skippedRaces += 1
          continue
        }
        const ticked = selectedRaceKeys ? selectedRaceKeys.has(raceItem.updateChoiceKey) : true

        if (forceNew) {
          // The user asked for these races to be added as new data: whatever
          // they matched in the existing competition no longer matters.
          if (!ticked) {
            result.skippedRaces += 1
            continue
          }
        } else if (raceItem.action === 'identical') {
          result.skippedRaces += 1
          continue
        } else if (raceItem.action === 'update_candidate') {
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
        } else if (!ticked) {
          result.skippedRaces += 1
          continue
        }

        const now = new Date().toISOString()
        const inserted = tx
          .insert(races)
          .values({
            competitionId: ensureCompetition(),
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

/**
 * Ticking an ignored (blacklisted) competition or race in the preview means
 * "import it after all": its blacklist entry is removed, like the old app did,
 * and the preview is classified again so those races become ordinary new /
 * already-present / correction rows. Returns the same preview when nothing was
 * released.
 */
export function releaseBlacklistedSelection(
  db: Db,
  userId: number,
  preview: ImportPreview,
  selectedRaceKeys: ReadonlySet<string>,
): ImportPreview {
  let released = false
  for (const item of preview.items) {
    const ticked = item.races.filter((r) => selectedRaceKeys.has(r.updateChoiceKey))
    if (!ticked.length) continue

    if (item.action === 'blacklisted') {
      db.delete(blacklist)
        .where(and(eq(blacklist.userId, userId), eq(blacklist.signature, item.competitionSignature)))
        .run()
      released = true
    }
    for (const raceItem of ticked) {
      if (raceItem.action !== 'blacklisted') continue
      db.delete(raceBlacklist)
        .where(
          and(
            eq(raceBlacklist.userId, userId),
            eq(raceBlacklist.competitionSignature, item.competitionSignature),
            eq(raceBlacklist.raceIdentitySignature, raceItem.identitySignature),
          ),
        )
        .run()
      released = true
    }
  }
  if (!released) return preview

  return classifyImportPayload(db, userId, {
    source: preview.source,
    competitions: preview.items.map((item) => item.competition),
  })
}
