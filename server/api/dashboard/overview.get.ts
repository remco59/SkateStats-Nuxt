import { requireValidSession } from '../../utils/access'
import { listUserRacesWithContext } from '../../utils/race-service'
import { buildNotificationCenterContext } from '../../utils/notifications'
import { buildHomeTrendContext } from '../../utils/dashboard-trends'

/** "Nieuw PR" badge window on the best-times table (old app: last 7 days). */
const RECENT_PR_DAYS = 7

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const query = getQuery(event)
  // Absent => current season, present-but-empty => all seasons (like the old ?trend_season=).
  const trendSeason = 'trendSeason' in query ? String(query.trendSeason ?? '') : undefined
  const races = listUserRacesWithContext(session.user.id)
  const notifications = buildNotificationCenterContext(races)

  const finished = races.filter((r) => r.status === 'finished' && r.totalTimeMs !== null)
  const prCount = finished.filter((r) => r.isPr).length

  const venueCounts = new Map<string, number>()
  const distanceCounts = new Map<number, number>()
  for (const r of races) {
    if (r.venue) venueCounts.set(r.venue, (venueCounts.get(r.venue) ?? 0) + 1)
    distanceCounts.set(r.distanceM, (distanceCounts.get(r.distanceM) ?? 0) + 1)
  }
  const favoriteVenue = [...venueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const favoriteDistance = [...distanceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  const bestByDistance = new Map<number, (typeof finished)[number]>()
  for (const r of finished) {
    const current = bestByDistance.get(r.distanceM)
    if (!current || r.totalTimeMs! < current.totalTimeMs!) bestByDistance.set(r.distanceM, r)
  }
  const bestTimes = [...bestByDistance.values()].sort((a, b) => a.distanceM - b.distanceM)

  const competitionIds = new Set(races.map((r) => r.competitionId))
  const latestCompetition = races.length
    ? races.reduce((latest, r) => (r.competitionDate > latest.competitionDate ? r : latest))
    : null
  const latestCompetitionRaces = latestCompetition
    ? races
        .filter((r) => r.competitionId === latestCompetition.competitionId)
        .sort((a, b) => a.distanceM - b.distanceM)
    : []

  const recentPrCutoff = new Date(Date.now() - RECENT_PR_DAYS * 86_400_000).toISOString().slice(0, 10)

  // Same input as the old query: every race with a time, oldest first.
  const trendRows = races
    .filter((r) => r.totalTimeMs !== null)
    .sort((a, b) =>
      a.competitionDate !== b.competitionDate ? (a.competitionDate < b.competitionDate ? -1 : 1) : a.id - b.id,
    )
  const trendContext = buildHomeTrendContext(
    trendRows.map((r) => ({
      id: r.id,
      distanceM: r.distanceM,
      totalTimeMs: r.totalTimeMs,
      status: r.status,
      competitionDate: r.competitionDate,
      competitionName: r.competitionName,
    })),
    { trendSeason, invert: true },
  )

  return {
    competitionCount: competitionIds.size,
    raceCount: races.length,
    prCount,
    favoriteVenue,
    favoriteDistance,
    bestTimes: bestTimes.map((r) => ({
      raceId: r.id,
      distanceM: r.distanceM,
      totalTimeMs: r.totalTimeMs,
      competitionDate: r.competitionDate,
      isRecentPr: r.competitionDate >= recentPrCutoff,
    })),
    latestCompetition: latestCompetition
      ? {
          competitionId: latestCompetition.competitionId,
          name: latestCompetition.competitionName,
          venue: latestCompetition.venue,
          date: latestCompetition.competitionDate,
          races: latestCompetitionRaces.map((r) => ({
            raceId: r.id,
            distanceM: r.distanceM,
            totalTimeMs: r.totalTimeMs,
            status: r.status,
            isPr: r.isPr,
            openingMs: r.lapsMs?.[0] ?? null,
            deltaVsPreviousPrMs: r.status === 'finished' ? r.deltaVsPreviousPrMs : null,
          })),
        }
      : null,
    trends: trendContext.trends,
    trendSeasonOptions: trendContext.seasonOptions,
    selectedTrendSeason: trendContext.selectedSeason,
    notifications: {
      recentPrs: notifications.recentPrs.map((r) => ({
        raceId: r.id,
        distanceM: r.distanceM,
        totalTimeMs: r.totalTimeMs,
        competitionDate: r.competitionDate,
      })),
      recentSbs: notifications.recentSbs.map((r) => ({
        raceId: r.id,
        distanceM: r.distanceM,
        totalTimeMs: r.totalTimeMs,
        competitionDate: r.competitionDate,
      })),
      streakCount: notifications.streakCount,
    },
  }
})
