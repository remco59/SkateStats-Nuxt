import { listUserRacesWithContext, type RaceWithContext } from './race-service'
import { buildTargetGeneratorProfiles, type DistanceProfile } from './targets'

/**
 * A user's races oldest-first. listUserRacesWithContext() returns rows in
 * insertion order, which is NOT chronological (an import can insert a
 * season newest-first), but the generator profile ("last 6 races") and the
 * forecast ("last 5 races") both mean "most recent", exactly like the old
 * app's ORDER BY competition_date ASC, id ASC.
 */
export function listUserRacesChronological(userId: number): RaceWithContext[] {
  return listUserRacesWithContext(userId).sort(
    (a, b) =>
      a.competitionDate.localeCompare(b.competitionDate) || a.sequenceInDay - b.sequenceInDay || a.id - b.id,
  )
}

/** Per-distance pacing profiles from the user's own recent races with laps. */
export function buildUserProfiles(chronologicalRaces: RaceWithContext[]): Map<number, DistanceProfile> {
  return buildTargetGeneratorProfiles(
    chronologicalRaces.map((r) => ({
      id: r.id,
      distanceM: r.distanceM,
      totalTimeMs: r.totalTimeMs,
      status: r.status,
      lapsCsv: r.lapsMs.length ? r.lapsMs.map((ms) => ms / 1000).join(',') : null,
    })),
  )
}
