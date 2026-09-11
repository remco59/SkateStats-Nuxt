import { races } from '../../../../db/schema'
import { requireOwnedResource } from '../../../../utils/access'
import { getRaceWithContext, listUserRacesWithContext } from '../../../../utils/race-service'
import { buildComparisonContext } from '../../../../utils/compare'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { session } = await requireOwnedResource(event, races, id)

  const query = getQuery(event)
  const compareRaceId = query.compareRaceId ? Number(query.compareRaceId) : null

  const baseRace = getRaceWithContext(session.user.id, id)
  if (!baseRace) throw createError({ statusCode: 404 })

  const candidates = listUserRacesWithContext(session.user.id).filter(
    (r) => r.distanceM === baseRace.distanceM && r.id !== baseRace.id && r.totalTimeMs !== null,
  )

  const compareRace = compareRaceId ? (candidates.find((r) => r.id === compareRaceId) ?? null) : null

  const comparison = compareRace
    ? buildComparisonContext(
        { distanceM: baseRace.distanceM, totalTimeMs: baseRace.totalTimeMs, laps: baseRace.lapsMs.map((ms) => ms / 1000) },
        { distanceM: compareRace.distanceM, totalTimeMs: compareRace.totalTimeMs, laps: compareRace.lapsMs.map((ms) => ms / 1000) },
      )
    : null

  return {
    baseRace,
    candidates: candidates.map((r) => ({
      id: r.id,
      competitionName: r.competitionName,
      competitionDate: r.competitionDate,
      totalTimeMs: r.totalTimeMs,
    })),
    compareRace,
    comparison,
  }
})
