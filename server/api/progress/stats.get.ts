import { requireValidSession } from '../../utils/access'
import { listUserRacesWithContext } from '../../utils/race-service'
import { buildStatsContext } from '../../utils/stats'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const query = getQuery(event)

  // No `season` parameter at all means "just opened the page": show the
  // current season (when it has data), like the old app. An explicit empty
  // `season=` is the user choosing "all seasons".
  const defaultToCurrent = query.season === undefined
  const season = query.season ? String(query.season) : undefined

  let distanceM: number | null = null
  if (query.distanceM !== undefined && query.distanceM !== '') {
    distanceM = Number(query.distanceM)
    if (!Number.isFinite(distanceM)) {
      throw createError({ statusCode: 400, statusMessage: 'distanceM moet een getal zijn.' })
    }
  }

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

  const { storyCandidates, ...context } = buildStatsContext(statsInputs, { season, distanceM, defaultToCurrent })

  // One of the story variants, different on each visit (as in the old app).
  const story = storyCandidates[Math.floor(Math.random() * storyCandidates.length)] ?? null

  return { ...context, story }
})
