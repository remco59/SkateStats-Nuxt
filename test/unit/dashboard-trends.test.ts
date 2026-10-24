import { describe, expect, it } from 'vitest'
import { fmtMs } from '../../shared/utils/format'
import golden from '../../reference/fixtures/calculations/golden_dashboard.json'
import { buildHomeTrendContext, type TrendRaceInput } from '../../server/utils/dashboard-trends'

/**
 * The expectations come from running the old app's build_home_trend_context /
 * build_sparkline (scripts/golden/dashboard.py), so they are what the old
 * dashboard really drew -- not what we believe it drew.
 */
interface OldRow {
  id: number
  distance_m: number
  total_time_ms: number | null
  dnf: number
  competition_name: string
  competition_date: string
}

const fmt1 = (n: number) => n.toFixed(1)

describe('buildHomeTrendContext against the old app', () => {
  for (const c of golden.cases) {
    it(c.name, () => {
      const rows: TrendRaceInput[] = (c.rows as OldRow[]).map((r) => ({
        id: r.id,
        distanceM: r.distance_m,
        totalTimeMs: r.total_time_ms,
        status: r.dnf === 1 ? 'dnf' : 'finished',
        competitionDate: r.competition_date,
        competitionName: r.competition_name,
      }))
      const params = c.params as { trend_season: string; default_to_current: boolean }
      const got = buildHomeTrendContext(rows, {
        trendSeason: params.default_to_current ? undefined : params.trend_season,
        today: c.today,
      })
      const want = c.expected

      expect(got.seasonOptions).toEqual(want.trend_season_options)
      expect(got.selectedSeason).toBe(want.selected_trend_season)
      expect(got.trends.map((t) => t.distanceM)).toEqual(want.trend_rows.map((t) => t.distance_m))
      got.trends.forEach((t, i) => {
        const w = want.trend_rows[i]!
        expect(t.count).toBe(w.count)
        expect(t.latest.date.split('-').reverse().join('-')).toBe(w.latest_date)
        expect(fmtMs(t.latest.totalTimeMs)).toBe(w.latest_time)
        if (!w.sparkline) {
          expect(t.sparkline).toBeNull()
          return
        }
        const s = t.sparkline!
        expect(s.circles.map((p) => `${fmt1(p.x)},${fmt1(p.y)}`).join(' ')).toBe(w.sparkline.points)
        expect(s.circles.map((p) => ({ x: fmt1(p.x), y: fmt1(p.y), href: `/races/${p.raceId}`, name: p.name }))).toEqual(
          w.sparkline.circles.map((p: { x: string; y: string; href: string; tooltip_name: string }) => ({
            x: p.x, y: p.y, href: p.href, name: p.tooltip_name,
          })),
        )
        expect(s.ticks.map((tick) => ({ x: fmt1(tick.x), label: tick.label }))).toEqual(w.sparkline.month_ticks)
        expect(s.baselineY).toBe(w.sparkline.baseline_y)
        expect(s.minMs).toBe(w.sparkline.min_ms)
        expect(s.maxMs).toBe(w.sparkline.max_ms)
        expect(s.deltaMs).toBe(w.sparkline.delta_ms)
      })
    })
  }

  it('inverting draws faster times higher without changing x', () => {
    const rows: TrendRaceInput[] = [
      { id: 1, distanceM: 500, totalTimeMs: 42000, status: 'finished', competitionDate: '2025-01-01', competitionName: 'A' },
      { id: 2, distanceM: 500, totalTimeMs: 40000, status: 'finished', competitionDate: '2025-02-01', competitionName: 'B' },
    ]
    const plain = buildHomeTrendContext(rows, { trendSeason: '', today: '2025-03-01' }).trends[0]!.sparkline!
    const inverted = buildHomeTrendContext(rows, { trendSeason: '', today: '2025-03-01', invert: true }).trends[0]!.sparkline!
    expect(inverted.circles.map((c) => c.x)).toEqual(plain.circles.map((c) => c.x))
    expect(plain.circles[1]!.y).toBeGreaterThan(plain.circles[0]!.y)
    expect(inverted.circles[1]!.y).toBeLessThan(inverted.circles[0]!.y)
  })
})
