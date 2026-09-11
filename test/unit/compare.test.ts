import { describe, expect, it } from 'vitest'
import { buildComparisonContext } from '../../server/utils/compare'
import { parseLapsToMs } from '../../server/utils/time'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

const g = golden.race_comparison

function toRace(r: { distance_m: number; total_time_ms: number; laps_csv: string }) {
  return {
    distanceM: r.distance_m,
    totalTimeMs: r.total_time_ms,
    laps: parseLapsToMs(r.laps_csv).lapsMs.map((ms) => ms / 1000),
  }
}

describe('race comparison (golden fixture)', () => {
  const ctx = buildComparisonContext(toRace(g.base), toRace(g.compare))

  it('summary rows', () => {
    for (const expected of g.expected.summary) {
      const row = ctx.summary.find((s) => s.label === expected.label)!
      expect(row.baseMs).toBe(expected.base_ms)
      expect(row.compareMs).toBe(expected.compare_ms)
      expect(row.deltaMs).toBe(expected.delta_ms)
    }
  })

  it('split-by-split comparison, including cumulative delta', () => {
    expect(ctx.splits).toHaveLength(g.expected.splits.length)
    g.expected.splits.forEach((expected, i) => {
      const row = ctx.splits[i]!
      expect(row.distanceM).toBe(expected.distance_m)
      expect(row.baseSplit).toBeCloseTo(expected.base_split, 9)
      expect(row.compareSplit).toBeCloseTo(expected.compare_split, 9)
      expect(row.splitDeltaMs).toBe(expected.split_delta_ms)
      expect(row.cumulativeDeltaMs).toBe(expected.cumulative_delta_ms)
      expect(row.base400!).toBeCloseTo(expected.base_400, 9)
      expect(row.compare400!).toBeCloseTo(expected.compare_400, 9)
      expect(row.eqDeltaMs).toBe(expected.eq_delta_ms)
    })
  })

  it('highlights', () => {
    expect(ctx.highlights.totalDeltaMs).toBe(g.expected.highlights.total_delta_ms)
    expect(ctx.highlights.openingDeltaMs).toBe(g.expected.highlights.opening_delta_ms)
    expect(ctx.highlights.slotDeltaMs).toBe(g.expected.highlights.slot_delta_ms)
    expect(ctx.highlights.vervalDeltaMs).toBe(g.expected.highlights.verval_delta_ms)
  })

  it('pacing labels', () => {
    expect(ctx.pacing.basisLabels).toEqual(g.expected.pacing_basis_labels)
    expect(ctx.pacing.vergelijkingLabels).toEqual(g.expected.pacing_compare_labels)
  })

  it('strongest/weakest segment', () => {
    expect(ctx.onderdelen.sterkste!.index).toBe(g.expected.sterkste_index)
    expect(ctx.onderdelen.zwakste!.index).toBe(g.expected.zwakste_index)
  })
})
