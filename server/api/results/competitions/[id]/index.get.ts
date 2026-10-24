import { competitions } from '../../../../db/schema'
import { requireOwnedResource } from '../../../../utils/access'
import { listUserRacesWithContext } from '../../../../utils/race-service'
import { computeRaceMetrics } from '../../../../utils/splits'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { session, row: competition } = await requireOwnedResource(event, competitions, id)

  const races = listUserRacesWithContext(session.user.id)
    .filter((r) => r.competitionId === id)
    .sort((a, b) => a.distanceM - b.distanceM || a.id - b.id)
    .map((r) => {
      const metrics = computeRaceMetrics(
        r.lapsMs.map((ms) => ms / 1000),
        r.distanceM,
      )
      // Only what the table needs: average 400 m lap and fade (seconds).
      return { ...r, avg400: metrics.avg400, fade400Eq: metrics.fade400Eq }
    })

  return { competition, races }
})
