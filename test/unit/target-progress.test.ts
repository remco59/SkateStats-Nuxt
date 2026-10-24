import { describe, expect, it } from 'vitest'
import { buildDistanceTargetStats, buildTargetProgress } from '../../server/utils/target-progress'
import { parseLapsToMs } from '../../server/utils/time'
import golden from '../../reference/fixtures/calculations/golden_targets.json'

interface OldRow {
  id: number
  distance_m: number
  total_time_ms: number | null
  laps_csv: string | null
  dnf: number
}

const toRace = (r: OldRow) => ({
  distanceM: r.distance_m,
  totalTimeMs: r.dnf === 1 ? null : r.total_time_ms,
  status: r.dnf === 1 ? 'dnf' : 'finished',
  lapsMs: r.laps_csv ? parseLapsToMs(r.laps_csv).lapsMs : [],
})

describe('target progress (golden fixtures from the old app)', () => {
  for (const c of golden.target_progress) {
    describe(c.name, () => {
      const stats = buildDistanceTargetStats(c.rows.map(toRace)).get(c.distance_m) ?? null

      it('derives the same per-distance stats', () => {
        if (!c.expected_stat) {
          expect(stats).toBeNull()
          return
        }
        expect(stats).not.toBeNull()
        expect(stats!.bestTimeMs).toBe(c.expected_stat.best_time_ms)
        const eq = (actual: number | null, expected: number | null) =>
          expected === null ? expect(actual).toBeNull() : expect(actual).toBeCloseTo(expected, 9)
        eq(stats!.bestOpeningS, c.expected_stat.best_opening_s)
        eq(stats!.avgLapS, c.expected_stat.avg_400_s)
        eq(stats!.bestLast400S, c.expected_stat.best_last_400_s)
        eq(stats!.avgFadeS, c.expected_stat.avg_fade_s)
      })

      it('builds the same progress rows', () => {
        const rows = buildTargetProgress(
          {
            targetTimeMs: c.goal.target_time_ms,
            openingMs: c.goal.target_opening_ms,
            avg400Ms: c.goal.target_avg_400_ms,
            last400Ms: c.goal.target_last_400_ms,
            fade400Ms: c.goal.target_fade_400_ms,
          },
          stats,
        )
        expect(rows.map((r) => r.label)).toEqual(c.expected_progress.map((p) => p.label))
        rows.forEach((row, i) => {
          const exp = c.expected_progress[i]!
          expect(row.targetMs).toBe(exp.target_ms)
          expect(row.actualMs).toBe(exp.actual_ms)
          expect(row.deltaMs).toBe(exp.delta_ms)
          expect(row.metGoal).toBe(exp.met_goal)
        })
      })
    })
  }

  it('returns nothing when no part of the target is set', () => {
    expect(
      buildTargetProgress({ targetTimeMs: null, openingMs: null, avg400Ms: null, last400Ms: null, fade400Ms: null }, null),
    ).toEqual([])
  })
})
