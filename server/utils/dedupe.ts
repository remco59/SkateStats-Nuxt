import { norm } from './text'

/**
 * Import de-duplication identity, per REBUILD_PLAN.md section 6 (this
 * REPLACES the old app's ad-hoc "any competition sharing a date" +
 * exact-field race check with an explicit, documented identity scheme).
 */

export type ImportSourceName = 'manual' | 'osta' | 'ssr' | 'pdf'

/**
 * Competition identity = (date, normalized name). `source` is tracked
 * separately on the row (not part of the identity) so the SAME real-world
 * competition seen via OSTA and SSR resolves to ONE competition record
 * (plan section 6 rule 1) instead of one per source.
 */
export function competitionIdentitySignature(date: string, name: string): string {
  return `${date}|${norm(name)}`
}

/** Competition-level blacklist signature ("delete and blacklist this whole competition"). */
export function competitionBlacklistSignature(
  source: ImportSourceName,
  date: string,
  name: string,
  sourceRef?: string | null,
): string {
  return `${source}|${date}|${norm(name)}|${sourceRef ?? ''}`
}

export interface RaceIdentityInput {
  distanceM: number
  lane?: string | null
  opponent?: string | null
  totalTimeMs: number | null
  status: string
  lapsMs?: number[] | null
}

/**
 * Race identity WITHIN one competition = (distance, lane, opponent, total
 * time, status, laps fingerprint). Two races with the same distance but
 * different lane/opponent are different races (a real dead heat, or a
 * different heat). Two races with identical distance/lane/opponent/time/
 * laps are the same race re-seen from a different source or import run
 * (plan section 6 rule 2 and rule 5's idempotency requirement).
 */
export function raceIdentitySignature(input: RaceIdentityInput): string {
  const lapsFingerprint = (input.lapsMs ?? []).join(',')
  return [
    input.distanceM,
    (input.lane ?? '').trim().toLowerCase(),
    (input.opponent ?? '').trim().toLowerCase(),
    input.totalTimeMs ?? '',
    input.status,
    lapsFingerprint,
  ].join('|')
}

export type RaceMatchKind = 'identical' | 'update_candidate' | 'distinct'

/**
 * Compares an incoming race against one existing race in the same
 * competition:
 * - 'identical': same (distance, lane, opponent) AND same time/status/laps
 *   -> this is a re-seen race, not a duplicate to create (rule 5).
 * - 'update_candidate': same (distance, lane, opponent) but time/status/
 *   laps differ -> looks like a correction, never auto-applied (rule 3) --
 *   the caller must surface this in the import preview for an explicit
 *   replace/keep-both/skip choice.
 * - 'distinct': different (distance, lane, opponent) -> a different race
 *   entirely (rule 2).
 */
export function compareRaceForImport(
  existing: RaceIdentityInput,
  incoming: RaceIdentityInput,
): RaceMatchKind {
  const sameSlot =
    existing.distanceM === incoming.distanceM &&
    (existing.lane ?? '').trim().toLowerCase() === (incoming.lane ?? '').trim().toLowerCase() &&
    (existing.opponent ?? '').trim().toLowerCase() === (incoming.opponent ?? '').trim().toLowerCase()

  if (!sameSlot) return 'distinct'

  if (raceIdentitySignature(existing) === raceIdentitySignature(incoming)) {
    return 'identical'
  }

  return 'update_candidate'
}
