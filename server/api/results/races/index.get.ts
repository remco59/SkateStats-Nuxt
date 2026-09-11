import { requireValidSession } from '../../../utils/access'
import { listUserRacesWithContext } from '../../../utils/race-service'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().toLowerCase()
  const venue = String(query.venue ?? '').trim().toLowerCase()
  const dateFrom = String(query.dateFrom ?? '').trim()
  const dateTo = String(query.dateTo ?? '').trim()
  const distanceM = query.distanceM ? Number(query.distanceM) : null

  let rows = listUserRacesWithContext(session.user.id)

  if (q) {
    rows = rows.filter(
      (r) =>
        r.competitionName.toLowerCase().includes(q) ||
        (r.venue ?? '').toLowerCase().includes(q),
    )
  }
  if (venue) rows = rows.filter((r) => (r.venue ?? '').toLowerCase() === venue)
  if (dateFrom) rows = rows.filter((r) => r.competitionDate >= dateFrom)
  if (dateTo) rows = rows.filter((r) => r.competitionDate <= dateTo)
  if (distanceM) rows = rows.filter((r) => r.distanceM === distanceM)

  rows.sort((a, b) => (a.competitionDate < b.competitionDate ? 1 : a.competitionDate > b.competitionDate ? -1 : b.id - a.id))

  const distanceOptions = [...new Set(listUserRacesWithContext(session.user.id).map((r) => r.distanceM))].sort(
    (a, b) => a - b,
  )

  return { races: rows, distanceOptions }
})
