import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../db/client'
import { competitions, raceLaps, races } from '../db/schema'
import { cleanCompetitionName } from './import/pdf'

/**
 * Consolidation of competitions that were split by differing titles, ported from
 * the old app's deduplicate_competitions (main.py; checked against
 * reference/fixtures/calculations/golden_duplicates.json).
 *
 * Grouping key: owner + date + canonical name (dates, standalone years, case and
 * punctuation ignored). Two different non-empty venues on one day are never
 * merged; a blank venue joins a group only when at most one venue is known.
 */

const YEAR = /(?<![\p{L}\p{N}_])(?:19|20)\d{2}(?![\p{L}\p{N}_])/gu

export function canonicalCompetitionName(value: string): string {
  const cleaned = cleanCompetitionName(value ?? '')
    .toLowerCase()
    .replace(YEAR, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
  return cleaned.replace(/\s+/g, ' ').trim()
}

/** A trailing country code such as "(NED)" is metadata, not part of the venue. */
export function canonicalCompetitionVenue(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s*\([a-z]{3}\)\s*$/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Like Python's str.splitlines: no lines for empty text, no trailing empty line. */
function splitLines(text: string | null): string[] {
  if (!text) return []
  const lines = text.split(/\r\n|\r|\n/)
  if (lines[lines.length - 1] === '') lines.pop()
  return lines
}

function appendNote(existing: string | null, extra: string): string {
  const current = (existing ?? '').trim()
  const add = extra.trim()
  if (!current) return add
  if (!add || current.includes(add)) return current
  return `${current}\n${add}`
}

/** The title to keep: without an embedded date, then with an edition year, then the oldest row. */
function preferredDisplayName(rows: { id: number; name: string }[]): string {
  const score = (row: { id: number; name: string }): [number, number, number] => {
    const raw = row.name.trim()
    const cleaned = cleanCompetitionName(raw) || raw
    const hasYear = new RegExp(YEAR.source, 'u').test(cleaned) ? 1 : 0
    return [cleaned !== raw ? 1 : 0, -hasYear, row.id]
  }
  const winner = rows.reduce((best, row) => {
    const a = score(row)
    const b = score(best)
    return a[0] < b[0] || (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && a[2] < b[2]))) ? row : best
  })
  const raw = winner.name.trim()
  return cleanCompetitionName(raw) || raw || 'Wedstrijd'
}

interface RaceView {
  totalTimeMs: number | null
  lane: string | null
  opponent: string | null
  lapsMs: number[]
  failed: boolean
  notes: string | null
}

const urlsIn = (notes: string | null) => new Set((notes ?? '').match(/https?:\/\/\S+/g) ?? [])
const fold = (v: string | null) => (v ?? '').trim().toLowerCase()

/**
 * The same start seen twice. Matching source URLs are authoritative; without
 * them the whole fingerprint must match AND carry something richer than
 * distance + time (laps, lane or opponent) -- two 500m starts can legitimately
 * end in exactly the same time.
 */
export function isDuplicateRace(existing: RaceView[], result: RaceView): boolean {
  const resultUrls = urlsIn(result.notes)
  const lane = fold(result.lane)
  const opponent = fold(result.opponent)
  const laps = result.lapsMs.join(',')

  for (const row of existing) {
    const rowUrls = urlsIn(row.notes)
    if (resultUrls.size && rowUrls.size) {
      if ([...resultUrls].some((u) => rowUrls.has(u))) return true
      // Distinct source pages are distinct starts even with an identical time.
      continue
    }
    const same =
      row.totalTimeMs === result.totalTimeMs &&
      fold(row.lane) === lane &&
      fold(row.opponent) === opponent &&
      row.lapsMs.join(',') === laps &&
      row.failed === result.failed
    if (same && (lane || opponent || laps)) return true
  }
  return false
}

export interface ConsolidationResult {
  mergedCompetitions: number
  movedRaces: number
  removedDuplicateRaces: number
  /** One entry per merged group: the competition that remains and the ones folded into it. */
  groups: { survivorId: number; survivorName: string; mergedIds: number[] }[]
}

class DryRunRollback extends Error {}

export function consolidateDuplicateCompetitions(
  db: Db,
  options: { userId?: number; dryRun?: boolean } = {},
): ConsolidationResult {
  const result: ConsolidationResult = { mergedCompetitions: 0, movedRaces: 0, removedDuplicateRaces: 0, groups: [] }

  const run = (tx: Db) => {
    const all = tx
      .select()
      .from(competitions)
      .where(options.userId ? eq(competitions.userId, options.userId) : undefined)
      .orderBy(asc(competitions.userId), asc(competitions.date), asc(competitions.id))
      .all()

    const baseGroups = new Map<string, typeof all>()
    for (const row of all) {
      const name = canonicalCompetitionName(row.name)
      const date = (row.date ?? '').trim()
      if (!date || !name) continue
      const key = JSON.stringify([row.userId, date, name])
      baseGroups.set(key, [...(baseGroups.get(key) ?? []), row])
    }

    const datesToRenumber = new Set<string>()

    for (const baseRows of baseGroups.values()) {
      if (baseRows.length < 2) continue

      const knownVenues = new Set(baseRows.map((r) => canonicalCompetitionVenue(r.venue)).filter(Boolean))
      let venueGroups: (typeof baseRows)[]
      if (knownVenues.size <= 1) {
        venueGroups = [baseRows]
      } else {
        const byVenue = new Map<string, typeof baseRows>()
        for (const row of baseRows) {
          // A blank venue is ambiguous between the known ones: keep it on its own.
          const key = canonicalCompetitionVenue(row.venue) || `__blank__${row.id}`
          byVenue.set(key, [...(byVenue.get(key) ?? []), row])
        }
        venueGroups = [...byVenue.values()]
      }

      for (const group of venueGroups) {
        if (group.length < 2) continue
        const sorted = [...group].sort((a, b) => a.id - b.id)
        const survivor = sorted[0]!

        let notes: string | null = null
        for (const row of sorted) {
          for (const line of splitLines(row.notes)) notes = appendNote(notes, line)
        }
        const venue = sorted.map((r) => (r.venue ?? '').trim()).find(Boolean) ?? null
        const name = preferredDisplayName(sorted)
        tx.update(competitions).set({ name, venue, notes }).where(eq(competitions.id, survivor.id)).run()

        const loadRace = (race: typeof races.$inferSelect): RaceView & { id: number; distanceM: number; userId: number } => ({
          id: race.id,
          distanceM: race.distanceM,
          userId: race.userId,
          totalTimeMs: race.totalTimeMs,
          lane: race.lane,
          opponent: race.opponent,
          failed: race.status !== 'finished',
          notes: race.notes,
          lapsMs: tx
            .select()
            .from(raceLaps)
            .where(eq(raceLaps.raceId, race.id))
            .orderBy(asc(raceLaps.lapIndex))
            .all()
            .map((l) => l.lapMs),
        })

        for (const duplicate of sorted.slice(1)) {
          const duplicateRaces = tx.select().from(races).where(eq(races.competitionId, duplicate.id)).orderBy(asc(races.id)).all()
          for (const race of duplicateRaces) {
            const view = loadRace(race)
            const survivorRaces = tx
              .select()
              .from(races)
              .where(and(eq(races.competitionId, survivor.id), eq(races.userId, race.userId), eq(races.distanceM, race.distanceM)))
              .orderBy(asc(races.id))
              .all()
              .map(loadRace)
            if (isDuplicateRace(survivorRaces, view)) {
              tx.delete(races).where(eq(races.id, race.id)).run()
              result.removedDuplicateRaces += 1
            } else {
              tx.update(races).set({ competitionId: survivor.id }).where(eq(races.id, race.id)).run()
              result.movedRaces += 1
            }
          }
          tx.delete(competitions).where(eq(competitions.id, duplicate.id)).run()
          result.mergedCompetitions += 1
        }

        result.groups.push({ survivorId: survivor.id, survivorName: name, mergedIds: sorted.slice(1).map((r) => r.id) })
        datesToRenumber.add(JSON.stringify([survivor.userId, survivor.date]))
      }
    }

    // Moved races may now share a same-day sequence number with the survivor's own races.
    for (const key of datesToRenumber) {
      const [userId, date] = JSON.parse(key) as [number, string]
      const ids = tx.select({ id: competitions.id }).from(competitions).where(and(eq(competitions.userId, userId), eq(competitions.date, date))).all()
      if (!ids.length) continue
      const dayRaces = tx
        .select({ id: races.id })
        .from(races)
        .where(and(eq(races.userId, userId), inArray(races.competitionId, ids.map((c) => c.id))))
        .orderBy(asc(races.sequenceInDay), asc(races.id))
        .all()
      dayRaces.forEach((r, index) => tx.update(races).set({ sequenceInDay: index }).where(eq(races.id, r.id)).run())
    }
  }

  try {
    db.transaction((tx) => {
      run(tx as unknown as Db)
      if (options.dryRun) throw new DryRunRollback()
    })
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err
  }
  return result
}
