import { describe, expect, it } from 'vitest'
import { buildComparisonContext } from '../../server/utils/compare'
import { parseLapsToMs } from '../../server/utils/time'
import { fmtDeltaMs } from '../../shared/utils/delta'
import golden from '../../reference/fixtures/calculations/golden_compare.json'

interface OldRace {
  distance_m: number
  total_time_ms: number | null
  laps_csv: string | null
}

const toRace = (r: OldRace) => ({
  distanceM: r.distance_m,
  totalTimeMs: r.total_time_ms,
  laps: r.laps_csv ? parseLapsToMs(r.laps_csv).lapsMs.map((ms) => ms / 1000) : [],
})

const near = (actual: number | null, expected: number | null) =>
  expected === null ? expect(actual).toBeNull() : expect(actual).toBeCloseTo(expected, 9)

describe('race comparison (golden fixture: the old app\'s own build_comparison_context)', () => {
  for (const c of golden.cases) {
    describe(c.name, () => {
      const ctx = buildComparisonContext(toRace(c.base), toRace(c.compare))
      const e = c.expected

      it('says the same thing about where time was won or lost', () => {
        expect(ctx.samenvattingTekst).toBe(e.samenvatting_tekst)
      })

      it('has the same highlights and summary rows', () => {
        expect(ctx.highlights).toEqual({
          totalDeltaMs: e.highlights.total_delta_ms,
          openingDeltaMs: e.highlights.opening_delta_ms,
          slotDeltaMs: e.highlights.slot_delta_ms,
          vervalDeltaMs: e.highlights.verval_delta_ms,
        })
        expect(ctx.summary).toEqual(
          e.summary.map((s) => ({ label: s.label, baseMs: s.base_ms, compareMs: s.compare_ms, deltaMs: s.delta_ms })),
        )
      })

      it('has the same split rows', () => {
        expect(ctx.splits).toHaveLength(e.splits.length)
        ctx.splits.forEach((row, i) => {
          const exp = e.splits[i]!
          expect([row.index, row.distanceM, row.splitDeltaMs, row.cumulativeDeltaMs, row.eqDeltaMs]).toEqual([
            exp.index,
            exp.distance_m,
            exp.split_delta_ms,
            exp.cumulative_delta_ms,
            exp.eq_delta_ms,
          ])
          near(row.baseSplit, exp.base_split)
          near(row.compareSplit, exp.compare_split)
          near(row.base400, exp.base_400)
          near(row.compare400, exp.compare_400)
        })
      })

      it('has the same pacing numbers and labels', () => {
        const p = e.pacing
        expect(ctx.pacing).toEqual({
          basisLabels: p.basis_labels,
          vergelijkingLabels: p.vergelijking_labels,
          basisOpeningMs: p.basis_opening_ms,
          vergelijkingOpeningMs: p.vergelijking_opening_ms,
          basisSlotMs: p.basis_slot_ms,
          vergelijkingSlotMs: p.vergelijking_slot_ms,
          basisVervalMs: p.basis_verval_ms,
          vergelijkingVervalMs: p.vergelijking_verval_ms,
        })
      })

      it('picks the same strongest and weakest split', () => {
        expect(ctx.onderdelen.sterkste?.index ?? null).toBe(e.onderdelen.sterkste)
        expect(ctx.onderdelen.zwakste?.index ?? null).toBe(e.onderdelen.zwakste)
      })

      it('draws a delta chart point for every split that has a delta', () => {
        expect(ctx.splits.filter((r) => r.splitDeltaMs !== null).length).toBe(e.delta_chart_points)
      })
    })
  }

  it('covers every verdict the old app can give', () => {
    const texts = new Set(golden.cases.map((c) => c.expected.samenvatting_tekst))
    expect(texts.size).toBe(7)
  })

  it('formats deltas with an explicit plus', () => {
    expect(fmtDeltaMs(870)).toBe('+0.87')
    expect(fmtDeltaMs(-1500)).toBe('-1.50')
    expect(fmtDeltaMs(0)).toBe('0.00')
    expect(fmtDeltaMs(null)).toBe('-')
  })
})
