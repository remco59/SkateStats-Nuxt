import { requireValidSession } from '../../utils/access'
import { listUserRacesWithContext } from '../../utils/race-service'
import { buildStatsContext } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const query = getQuery(event)
  const season = query.season ? String(query.season) : undefined
  const distanceM = query.distanceM ? Number(query.distanceM) : null

  const races = listUserRacesWithContext(session.user.id)
  const statsInputs = races.map((r) => ({
    id: r.id,
    competitionId: r.competitionId,
    distanceM: r.distanceM,
    totalTimeMs: r.totalTimeMs,
    status: r.status,
    competitionDate: r.competitionDate,
    venue: r.venue,
    lapsMs: r.lapsMs,
  }))

  return buildStatsContext(statsInputs, { season, distanceM })
})
