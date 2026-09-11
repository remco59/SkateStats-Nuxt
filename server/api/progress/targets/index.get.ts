import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { targets } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'
import { listUserRacesWithContext } from '../../../utils/race-service'
import { buildTargetForecast, buildTargetGeneratorProfiles, generateSplitTargets } from '../../../utils/targets'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()

  const targetRows = db.select().from(targets).where(eq(targets.userId, session.user.id)).all()
  const races = listUserRacesWithContext(session.user.id)

  const profileInputs = races.map((r) => ({
    id: r.id,
    distanceM: r.distanceM,
    totalTimeMs: r.totalTimeMs,
    status: r.status,
    lapsCsv: r.lapsMs.length ? r.lapsMs.map((ms) => ms / 1000).join(',') : null,
  }))
  const profiles = buildTargetGeneratorProfiles(profileInputs)

  const cards = targetRows.map((t) => {
    const distanceRows = races.filter((r) => r.distanceM === t.distanceM)
    const generated = generateSplitTargets(t.distanceM, t.targetTimeMs, profiles.get(t.distanceM) ?? null)
    const forecast = buildTargetForecast(
      t.targetTimeMs,
      distanceRows.map((r) => ({
        id: r.id,
        totalTimeMs: r.totalTimeMs,
        status: r.status,
        competitionDate: r.competitionDate,
      })),
    )
    return { target: t, generated, forecast }
  })

  const distancesWithData = [...new Set(races.map((r) => r.distanceM))].sort((a, b) => a - b)

  return { cards, distancesWithData }
})
