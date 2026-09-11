import { describe, expect, it } from 'vitest'
import { buildTargetForecast, buildTargetGeneratorProfiles, generateSplitTargets } from '../../server/utils/targets'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

const g = golden.target_generation

function toProfileRow(r: { id: number; distance_m: number; total_time_ms: number; dnf: number; laps_csv: string }) {
  return {
    id: r.id,
    distanceM: r.distance_m,
    totalTimeMs: r.dnf === 1 ? null : r.total_time_ms,
    status: r.dnf === 1 ? 'dnf' : 'finished',
    lapsCsv: r.laps_csv,
  }
}

function toForecastRow(r: { id: number; total_time_ms: number; dnf: number; competition_date: string }) {
  return {
    id: r.id,
    totalTimeMs: r.dnf === 1 ? null : r.total_time_ms,
    status: r.dnf === 1 ? 'dnf' : 'finished',
    competitionDate: r.competition_date,
  }
}

describe('target generation (golden fixtures)', () => {
  it('builds a 1500m pacing profile matching the old app', () => {
    const rows = g.profile_rows.map(toProfileRow)
    const profiles = buildTargetGeneratorProfiles(rows)
    const p = profiles.get(1500)!
    expect(p.sampleSize).toBe(g.expected_profile_1500.sample_size)
    expect(p.openingRatio!).toBeCloseTo(g.expected_profile_1500.opening_ratio, 9)
    expect(p.last400Ratio!).toBeCloseTo(g.expected_profile_1500.last_400_ratio, 9)
    expect(p.fadeRatio!).toBeCloseTo(g.expected_profile_1500.fade_ratio, 9)
  })

  it('generates split targets using the profile', () => {
    const rows = g.profile_rows.map(toProfileRow)
    const profile = buildTargetGeneratorProfiles(rows).get(1500)!
    const result = generateSplitTargets(1500, 130000, profile)
    expect(result.targetOpeningMs).toBe(g.generate_split_targets_with_profile.expected.target_opening_ms)
    expect(result.targetAvg400Ms).toBe(g.generate_split_targets_with_profile.expected.target_avg_400_ms)
    expect(result.targetLast400Ms).toBe(g.generate_split_targets_with_profile.expected.target_last_400_ms)
    expect(result.targetFade400Ms).toBe(g.generate_split_targets_with_profile.expected.target_fade_400_ms)
  })

  it('falls back to per-distance defaults with no profile', () => {
    const result = generateSplitTargets(1500, 130000, null)
    expect(result).toEqual({
      targetOpeningMs: g.generate_split_targets_without_profile.expected.target_opening_ms,
      targetAvg400Ms: g.generate_split_targets_without_profile.expected.target_avg_400_ms,
      targetLast400Ms: g.generate_split_targets_without_profile.expected.target_last_400_ms,
      targetFade400Ms: g.generate_split_targets_without_profile.expected.target_fade_400_ms,
    })
  })

  it('returns all-null with no target time', () => {
    const result = generateSplitTargets(1500, null, null)
    expect(result).toEqual({
      targetOpeningMs: null,
      targetAvg400Ms: null,
      targetLast400Ms: null,
      targetFade400Ms: null,
    })
  })

  it('forecasts races-to-target', () => {
    const rows = g.forecast_rows.map(toForecastRow)
    const result = buildTargetForecast(130000, rows)
    expect(result).toEqual({
      status: 'forecast',
      targetTimeMs: g.forecast_with_target_130000.target_time_ms,
      bestTimeMs: g.forecast_with_target_130000.best_time_ms,
      deltaMs: g.forecast_with_target_130000.delta_ms,
      improvementPerRaceMs: g.forecast_with_target_130000.improvement_per_race_ms,
      racesToTarget: g.forecast_with_target_130000.races_to_target,
      etaDate: g.forecast_with_target_130000.eta_date,
    })
  })

  it('reports "reached" when the best time already beats the target', () => {
    const rows = g.forecast_rows.map(toForecastRow)
    const result = buildTargetForecast(134000, rows)
    expect(result).toEqual({
      status: 'reached',
      targetTimeMs: g.forecast_with_target_134000_reached.target_time_ms,
      bestTimeMs: g.forecast_with_target_134000_reached.best_time_ms,
      deltaMs: g.forecast_with_target_134000_reached.delta_ms,
      bestRaceId: g.forecast_with_target_134000_reached.best_race_id,
    })
  })

  it('reports no_target / no_data / insufficient', () => {
    expect(buildTargetForecast(null, g.forecast_rows.map(toForecastRow))).toEqual({ status: 'no_target' })
    expect(buildTargetForecast(130000, [])).toEqual({ status: 'no_data', targetTimeMs: 130000 })
    expect(buildTargetForecast(130000, g.forecast_rows.slice(0, 2).map(toForecastRow))).toEqual({
      status: 'insufficient',
      targetTimeMs: 130000,
      bestTimeMs: g.forecast_insufficient_rows_first_two.best_time_ms,
      deltaMs: g.forecast_insufficient_rows_first_two.delta_ms,
    })
  })
})
