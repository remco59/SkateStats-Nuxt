import { competitions } from '../../../../db/schema'
import { requireOwnedResource } from '../../../../utils/access'
import { listUserRacesWithContext } from '../../../../utils/race-service'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { session, row: competition } = await requireOwnedResource(event, competitions, id)

  const races = listUserRacesWithContext(session.user.id).filter((r) => r.competitionId === id)

  return { competition, races }
})
