import { describe, expect, it } from 'vitest'
import { buildNotificationCenterContext } from '../../server/utils/notifications'
import type { RaceWithContext } from '../../server/utils/race-service'

function race(overrides: Partial<RaceWithContext> & { id: number; competitionDate: string }): RaceWithContext {
  return {
    competitionId: 1,
    competitionName: 'Test',
    venue: null,
    distanceM: 1500,
    status: 'finished',
    totalTimeMs: 100000,
    trackType: 'indoor',
    lane: null,
    opponent: null,
    category: null,
    className: null,
    tag: null,
    notes: null,
    source: 'manual',
    sourceRef: null,
    sequenceInDay: 0,
    lapsMs: [],
    isPr: false,
    isSb: false,
    previousPrMs: null,
    deltaVsPreviousPrMs: null,
    ...overrides,
  }
}

const NOW = new Date('2025-06-15T00:00:00Z')

describe('notification center (plan section 5.4)', () => {
  it('includes PRs/SBs within the last 30 days, excludes older ones', () => {
    const races = [
      race({ id: 1, competitionDate: '2025-01-01', isPr: true }), // too old
      race({ id: 2, competitionDate: '2025-06-01', isPr: true }), // within 30 days of 2025-06-15
      race({ id: 3, competitionDate: '2025-05-20', isSb: true }), // within 30 days
    ]
    const ctx = buildNotificationCenterContext(races, NOW)
    expect(ctx.recentPrs.map((r) => r.id)).toEqual([2])
    expect(ctx.recentSbs.map((r) => r.id)).toEqual([3])
  })

  it('caps recent PR/SB lists at 5', () => {
    const races = Array.from({ length: 8 }, (_, i) =>
      race({ id: i + 1, competitionDate: '2025-06-10', isPr: true }),
    )
    const ctx = buildNotificationCenterContext(races, NOW)
    expect(ctx.recentPrs).toHaveLength(5)
  })

  it('streak counts consecutive newest-first hits and stops at the first miss', () => {
    const races = [
      race({ id: 1, competitionDate: '2025-01-01', isPr: true }), // oldest, would break the streak if reached
      race({ id: 2, competitionDate: '2025-02-01', isPr: false, isSb: false }), // a miss
      race({ id: 3, competitionDate: '2025-03-01', isPr: true }),
      race({ id: 4, competitionDate: '2025-04-01', isSb: true }),
      race({ id: 5, competitionDate: '2025-05-01', isPr: true }), // newest
    ]
    const ctx = buildNotificationCenterContext(races, NOW)
    // Newest-first: 5 (pr), 4 (sb), 3 (pr) all hit; 2 is a miss -> streak stops there.
    expect(ctx.streakCount).toBe(3)
    expect(ctx.streakItems.map((r) => r.id)).toEqual([5, 4, 3])
  })

  it('a DNF race is excluded from consideration entirely', () => {
    const races = [race({ id: 1, competitionDate: '2025-06-10', status: 'dnf', totalTimeMs: null, isPr: true })]
    const ctx = buildNotificationCenterContext(races, NOW)
    expect(ctx.recentPrs).toHaveLength(0)
    expect(ctx.streakCount).toBe(0)
  })
})
