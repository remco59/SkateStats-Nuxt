import { describe, expect, it } from 'vitest'
import {
  buildSplitRows,
  computeRaceMetrics,
  openingSplitM,
  per400Times,
  segmentDistances,
} from '../../server/utils/splits'
import { fmtMs } from '../../server/utils/time'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

function closeArray(actual: number[], expected: number[]) {
  expect(actual.length).toBe(expected.length)
  actual.forEach((v, i) => expect(v).toBeCloseTo(expected[i], 9))
}

describe('split math (golden fixtures)', () => {
  for (const c of golden.split_math) {
    it(c.label, () => {
      const laps = c.laps_s
      const distance = c.distance_m
      const totalMs = Math.round(laps.reduce((a, b) => a + b, 0) * 1000)

      expect(totalMs).toBe(c.expected.total_time_ms)
      expect(fmtMs(totalMs)).toBe(c.expected.total_time_fmt)
      expect(openingSplitM(distance)).toBe(c.expected.opening_split_m)
      expect(segmentDistances(distance, laps.length)).toEqual(c.expected.segment_distances)
      closeArray(per400Times(laps, distance), c.expected.per400_times)

      const metrics = computeRaceMetrics(laps, distance)
      const expectedMetrics = c.expected.metrics
      expect(metrics.segmentCount).toBe(expectedMetrics.segment_count)
      expect(metrics.openingM).toBe(expectedMetrics.opening_m)
      if (expectedMetrics.avg_400 === null) {
        expect(metrics.avg400).toBeNull()
      } else {
        expect(metrics.avg400!).toBeCloseTo(expectedMetrics.avg_400, 9)
      }
      expect(metrics.first400Eq!).toBeCloseTo(expectedMetrics.first_400eq, 9)
      expect(metrics.last400Eq!).toBeCloseTo(expectedMetrics.last_400eq, 9)
      expect(metrics.fade400Eq!).toBeCloseTo(expectedMetrics.fade_400eq, 9)
      expect(metrics.avgFadePerSegment400Eq!).toBeCloseTo(
        expectedMetrics.avg_fade_per_segment_400eq,
        9,
      )
    })
  }

  it('buildSplitRows produces one row per lap with per-400 deltas', () => {
    const laps = [41.5, 30.2, 30.8, 31.4]
    const rows = buildSplitRows(laps, 1500)
    expect(rows).toHaveLength(4)
    expect(rows[0].deltaPrev400Eq).toBeNull()
    expect(rows[1].deltaPrev400Eq).toBeCloseTo(-25.133333333333336, 6)
  })
})
