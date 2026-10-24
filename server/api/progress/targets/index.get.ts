import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { targets } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'
import { listUserRacesChronological, buildUserProfiles } from '../../../utils/target-service'
import { buildDistanceTargetStats, buildTargetProgress } from '../../../utils/target-progress'
import { buildTargetForecast, generateSplitTargets, readStoredSplitTargets } from '../../../utils/targets'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()

  const targetRows = db
    .select()
    .from(targets)
    .where(eq(targets.userId, session.user.id))
    .all()
    .sort((a, b) => a.distanceM - b.distanceM)
  const races = listUserRacesChronological(session.user.id)
  const profiles = buildUserProfiles(races)
  const stats = buildDistanceTargetStats(races)

  const cards = targetRows.map((t) => {
    const profile = profiles.get(t.distanceM) ?? null
    const splits = readStoredSplitTargets(t.generatorProfileJson)
    const distanceRaces = races.filter((r) => r.distanceM === t.distanceM)

    return {
      target: {
        distanceM: t.distanceM,
        targetTimeMs: t.targetTimeMs,
        notes: t.notes,
        updatedAt: t.updatedAt,
      },
      // Hand-set split targets (what the user saved).
      splits,
      // A suggestion from the target time + the skater's own recent laps;
      // only shown where nothing was set by hand.
      generated: generateSplitTargets(t.distanceM, t.targetTimeMs, profile),
      sampleSize: profile?.sampleSize ?? null,
      forecast: buildTargetForecast(
        t.targetTimeMs,
        distanceRaces.map((r) => ({
          id: r.id,
          totalTimeMs: r.totalTimeMs,
          status: r.status,
          competitionDate: r.competitionDate,
        })),
      ),
      progress: buildTargetProgress(
        {
          targetTimeMs: t.targetTimeMs,
          openingMs: splits.openingMs,
          avg400Ms: splits.avg400Ms,
          last400Ms: splits.last400Ms,
          fade400Ms: splits.fade400Ms,
        },
        stats.get(t.distanceM) ?? null,
      ),
    }
  })

  return { cards }
})
