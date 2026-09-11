import { races } from '../../../../db/schema'
import { requireOwnedResource } from '../../../../utils/access'
import { buildRaceDetail, getRaceWithContext } from '../../../../utils/race-service'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { session } = await requireOwnedResource(event, races, id)

  const race = getRaceWithContext(session.user.id, id)
  if (!race) throw createError({ statusCode: 404 })

  return buildRaceDetail(race)
})
