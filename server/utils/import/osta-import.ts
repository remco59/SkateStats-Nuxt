import { eq } from 'drizzle-orm'
import type { Db } from '../../db/client'
import { ostaProfileLinks } from '../../db/schema'
import { extractOstaResultsForPid, mergeOstaResults } from './osta'
import { ostaResultsToImportPayload } from './osta-source'
import { competitionIdentitySignature, raceIdentitySignature } from '../dedupe'
import {
  classifyImportPayload,
  savePreviewBatch,
  type ParsedImportCompetition,
  type ParsedImportPayload,
} from './pipeline'

/** OSTA's answer for a profile without races in the chosen season (see extractOstaResultsForPid). */
const NO_RESULTS_PREFIX = 'Geen OSTA ritten gevonden'

/**
 * Remembers an OSTA profile the user imported from, so the dashboard monitor
 * checks it from then on -- the old app saved its single monitor profile at
 * exactly this point. Mode is only chosen the first time ("melden"); a later
 * import never changes a mode the user picked. The first linked profile is
 * the primary one.
 */
export function linkOstaProfile(db: Db, userId: number, link: { pid: string; searchName: string; season: string }): void {
  const hasProfile = db.select({ id: ostaProfileLinks.id }).from(ostaProfileLinks).where(eq(ostaProfileLinks.userId, userId)).get()
  db.insert(ostaProfileLinks)
    .values({
      userId,
      pid: link.pid,
      searchName: link.searchName,
      season: link.season,
      monitorMode: 'notify',
      isPrimary: !hasProfile,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [ostaProfileLinks.userId, ostaProfileLinks.pid],
      set: { searchName: link.searchName, season: link.season },
    })
    .run()
}

/**
 * One competition seen under two profiles is ONE competition: items with the
 * same identity (date + name) are folded together and races that are the same
 * start are kept once. Without this the preview would list it twice and
 * importing would create it twice.
 */
export function mergeSameCompetitions(payload: ParsedImportPayload): ParsedImportPayload {
  const byIdentity = new Map<string, { competition: ParsedImportCompetition; seen: Set<string> }>()
  for (const competition of payload.competitions) {
    const key = competitionIdentitySignature(competition.date, competition.name)
    let target = byIdentity.get(key)
    if (!target) {
      target = { competition: { ...competition, results: [] }, seen: new Set() }
      byIdentity.set(key, target)
    }
    for (const race of competition.results) {
      const identity = raceIdentitySignature({ ...race, lapsMs: race.lapsMs })
      if (target.seen.has(identity)) continue
      target.seen.add(identity)
      target.competition.results.push(race)
    }
  }
  return { ...payload, competitions: [...byIdentity.values()].map((t) => t.competition) }
}

/**
 * Fetches one or more OSTA profiles, merges them into one result set (the same
 * competition seen under two profiles becomes one), classifies it against the
 * user's data and stores the preview. Returns the batch id.
 */
export async function createOstaPreview(
  db: Db,
  userId: number,
  input: { searchName: string; season: string; pids: string[] },
): Promise<string> {
  const pids = [...new Set(input.pids.map((p) => p.trim()).filter(Boolean))]
  const parsedResults = []
  const withResults: string[] = []
  for (const pid of pids) {
    try {
      parsedResults.push(await extractOstaResultsForPid(input.searchName, input.season, pid))
      withResults.push(pid)
    } catch (err) {
      if (pids.length === 1) throw err
      // Among several profiles, one that has nothing in this season is simply
      // skipped; anything else (OSTA unreachable...) names the profile.
      if ((err as Error).message.startsWith(NO_RESULTS_PREFIX)) continue
      throw new Error(`OSTA profiel ${pid}: ${(err as Error).message}`, { cause: err })
    }
  }
  if (!parsedResults.length) throw new Error('Geen importeerbare OSTA-data gevonden voor de gekozen profielen.')

  // A single profile is imported as is (two identical starts in one competition
  // are legitimate); merging only applies when profiles are combined.
  const payload =
    pids.length === 1
      ? ostaResultsToImportPayload(parsedResults[0]!)
      : mergeSameCompetitions(ostaResultsToImportPayload(mergeOstaResults(input.searchName, parsedResults)))
  const preview = classifyImportPayload(db, userId, payload)
  for (const pid of withResults) linkOstaProfile(db, userId, { pid, searchName: input.searchName, season: input.season })
  return savePreviewBatch(db, userId, preview)
}
