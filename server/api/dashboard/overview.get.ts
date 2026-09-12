import { requireValidSession } from '../../utils/access'
import { listUserRacesWithContext } from '../../utils/race-service'
import { buildNotificationCenterContext } from '../../utils/notifications'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
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

  const trendByDistance = new Map<number, { date: string; totalTimeMs: number; raceId: number }[]>()
  for (const r of finished) {
    const list = trendByDistance.get(r.distanceM) ?? []
    list.push({ date: r.competitionDate, totalTimeMs: r.totalTimeMs!, raceId: r.id })
    trendByDistance.set(r.distanceM, list)
  }
  for (const list of trendByDistance.values()) list.sort((a, b) => (a.date < b.date ? -1 : 1))

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
      isRecentPr: r.isPr,
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
            deltaVsPreviousPrMs: r.deltaVsPreviousPrMs,
          })),
        }
      : null,
    trends: [...trendByDistance.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([distanceM, points]) => ({ distanceM, points })),
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
