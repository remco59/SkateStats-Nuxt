import { isRecent } from './pr'
import type { RaceWithContext } from './race-service'

/**
 * Notification center content, per REBUILD_PLAN.md section 5.4: recent PRs
 * and SBs (competition date within the last 30 days), and the current
 * streak (consecutive newest-first races that are each a PR or SB).
 * `listUserRacesWithContext` already computes isPr/isSb per race (Phase 2's
 * engine), so this is just filtering/sorting that same data for display --
 * no new PR/SB logic here.
 */
export interface NotificationCenterContext {
  recentPrs: RaceWithContext[]
  recentSbs: RaceWithContext[]
  streakCount: number
  streakItems: RaceWithContext[]
}

export function buildNotificationCenterContext(
  races: RaceWithContext[],
  now: Date = new Date(),
): NotificationCenterContext {
  const finished = races.filter((r) => r.status === 'finished' && r.totalTimeMs !== null)
  const sorted = [...finished].sort((a, b) =>
    a.competitionDate !== b.competitionDate
      ? a.competitionDate < b.competitionDate
        ? -1
        : 1
      : a.sequenceInDay !== b.sequenceInDay
        ? a.sequenceInDay - b.sequenceInDay
        : a.id - b.id,
  )

  const recentPrs: RaceWithContext[] = []
  const recentSbs: RaceWithContext[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i]!
    if (!isRecent(row.competitionDate, now)) continue
    if (row.isPr && recentPrs.length < 5) recentPrs.push(row)
    if (row.isSb && recentSbs.length < 5) recentSbs.push(row)
  }

  const streakItems: RaceWithContext[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const row = sorted[i]!
    if (!row.isPr && !row.isSb) break
    streakItems.push(row)
  }

  return { recentPrs, recentSbs, streakCount: streakItems.length, streakItems: streakItems.slice(0, 5) }
}
