import { requireValidSession } from '../../../utils/access'
import { listUserRacesWithContext } from '../../../utils/race-service'
import { buildRaceFilterOptions, filterAndSortRaces } from '../../../utils/race-filter'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const query = getQuery(event)

  const all = listUserRacesWithContext(session.user.id)

  const races = filterAndSortRaces(all, {
    q: String(query.q ?? ''),
    distanceM: query.distanceM ? Number(query.distanceM) : null,
    tag: String(query.tag ?? ''),
    lane: String(query.lane ?? ''),
    venue: String(query.venue ?? ''),
    dateFrom: String(query.dateFrom ?? ''),
    dateTo: String(query.dateTo ?? ''),
  })

  // Options are built from ALL races, not the filtered ones, so a filter never
  // removes the choices needed to change it.
  return { races, ...buildRaceFilterOptions(all) }
})
