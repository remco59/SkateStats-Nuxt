import { describe, expect, it } from 'vitest'
import { buildPrProgress, collectPrRaceIds, type RaceForPr } from '../../server/utils/pr'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

function toRace(r: {
  id: number
  distance_m: number
  total_time_ms: number
  dnf: number
  competition_date: string
}): RaceForPr {
  return {
    id: r.id,
    distanceM: r.distance_m,
    totalTimeMs: r.dnf === 1 ? null : r.total_time_ms,
    status: r.dnf === 1 ? 'dnf' : 'finished',
    competitionDate: r.competition_date,
    sequenceInDay: 0,
  }
}

describe('PR/SB sequencing (golden fixtures)', () => {
  it('matches collectPrRaceIds and buildPrProgress for the reference scenario', () => {
    const rows = golden.pr_and_sb_sequencing.rows.map(toRace)
    const prIds = collectPrRaceIds(rows)
    expect([...prIds].sort((a, b) => a - b)).toEqual(golden.pr_and_sb_sequencing.expected_pr_race_ids)

    const progress = buildPrProgress(rows)
    for (const [idStr, expected] of Object.entries(golden.pr_and_sb_sequencing.expected_progress)) {
      const entry = progress.get(Number(idStr))!
      expect(entry.isPr).toBe(expected.is_pr)
      expect(entry.previousPrMs).toEqual(expected.previous_pr_ms)
      expect(entry.deltaVsPreviousPrMs).toEqual(expected.delta_vs_previous_pr_ms)
      expect(entry.deltaAbsMs).toEqual(expected.delta_abs_ms)
    }
  })

  it('reproduces the old app default ordering when sequenceInDay is untouched (0 for all)', () => {
    const scenarios = [
      golden.known_bug_same_day_ordering.scenario_a_insertion_matches_reality,
      golden.known_bug_same_day_ordering.scenario_b_insertion_reversed,
    ]
    for (const scenario of scenarios) {
      const rows = scenario.rows.map(toRace)
      const progress = buildPrProgress(rows)
      for (const [idStr, expected] of Object.entries(scenario.expected_progress)) {
        const entry = progress.get(Number(idStr))!
        expect(entry.isPr).toBe(expected.is_pr)
      }
    }
  })

  it('FIX: sequenceInDay lets a later-inserted-but-earlier-in-reality race correctly set the PR', () => {
    // Same total times as scenario_b (insertion order 10=40500 fast, 11=41000 slow,
    // both same day) but here the SLOWER race (11) actually happened FIRST in real
    // life and the FASTER one (10) second -- expressed via sequenceInDay, not id.
    const rows: RaceForPr[] = [
      { id: 10, distanceM: 500, totalTimeMs: 40500, status: 'finished', competitionDate: '2025-03-01', sequenceInDay: 2 },
      { id: 11, distanceM: 500, totalTimeMs: 41000, status: 'finished', competitionDate: '2025-03-01', sequenceInDay: 1 },
    ]
    const progress = buildPrProgress(rows)
    // Race 11 (sequence 1, happened first) sets the initial PR.
    expect(progress.get(11)!.isPr).toBe(true)
    // Race 10 (sequence 2, happened second, and is faster) correctly becomes
    // the new PR -- this is the real-world correct answer regardless of which
    // one has the lower database id.
    expect(progress.get(10)!.isPr).toBe(true)
    expect(progress.get(10)!.previousPrMs).toBe(41000)
  })
})
