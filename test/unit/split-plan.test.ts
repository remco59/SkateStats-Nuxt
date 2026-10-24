import { describe, expect, it } from 'vitest'
import { buildTargetSplitPlan, planSegments, rebalanceTargetSplits } from '../../shared/utils/split-plan'
import { parseTimeInput } from '../../shared/utils/time-input'
import golden from '../../reference/fixtures/calculations/golden_targets.json'

const g = golden.split_plan

describe('split plan (golden fixtures: the old app\'s own JavaScript)', () => {
  it('segments every distance the same way', () => {
    for (const c of g.segments) {
      expect(planSegments(c.distance_m), `${c.distance_m}m`).toEqual(c.expected)
    }
  })

  it('spreads a target time over the segments the same way', () => {
    for (const c of g.plans) {
      const actual = buildTargetSplitPlan(c.distance_m, c.target_time_ms, c.opening_ms, c.avg_round_ms, c.last_round_ms)
      expect(actual, `${c.distance_m}m opening=${c.opening_ms} avg=${c.avg_round_ms} last=${c.last_round_ms}`).toEqual(c.expected)
    }
  })

  it('sums to the target time for realistic inputs', () => {
    for (const c of g.plans) {
      if (!c.realistic || !c.expected.length) continue
      const total = buildTargetSplitPlan(c.distance_m, c.target_time_ms, c.opening_ms, c.avg_round_ms, c.last_round_ms)
        .reduce((a, r) => a + r.splitMs, 0)
      expect(total, `${c.distance_m}m`).toBe(c.target_time_ms)
    }
  })

  it('rebalances after an edit the same way', () => {
    for (const c of g.rebalances) {
      const out = rebalanceTargetSplits(c.input_rows, c.edited_index, c.target_time_ms)
      expect(out.rows, `${c.distance_m}m edit #${c.edited_index}`).toEqual(c.expected_rows)
      expect(out.totalTimeMs).toBe(c.expected_total_time_ms)
    }
  })

  it('does not mutate its input', () => {
    const c = g.rebalances[0]!
    const before = JSON.stringify(c.input_rows)
    rebalanceTargetSplits(c.input_rows, c.edited_index, c.target_time_ms)
    expect(JSON.stringify(c.input_rows)).toBe(before)
  })
})

describe('parseTimeInput', () => {
  it('parses seconds, comma decimals and m:ss.hh', () => {
    expect(parseTimeInput('40.50')).toEqual({ ok: true, ms: 40500 })
    expect(parseTimeInput('40,5')).toEqual({ ok: true, ms: 40500 })
    expect(parseTimeInput('2:12.34')).toEqual({ ok: true, ms: 132340 })
    expect(parseTimeInput(' 1:05 ')).toEqual({ ok: true, ms: 65000 })
  })

  it('treats empty as "not set" but rejects junk and zero', () => {
    expect(parseTimeInput('')).toEqual({ ok: true, ms: null })
    expect(parseTimeInput(null)).toEqual({ ok: true, ms: null })
    expect(parseTimeInput('abc')).toEqual({ ok: false })
    expect(parseTimeInput('1:2:3')).toEqual({ ok: false })
    expect(parseTimeInput('0')).toEqual({ ok: false })
    expect(parseTimeInput('-1')).toEqual({ ok: false })
  })

  it('accepts zero and negatives only when signed (fade targets)', () => {
    expect(parseTimeInput('-0.30', { signed: true })).toEqual({ ok: true, ms: -300 })
    expect(parseTimeInput('-1:02.5', { signed: true })).toEqual({ ok: true, ms: -62500 })
    expect(parseTimeInput('0', { signed: true })).toEqual({ ok: true, ms: 0 })
    expect(parseTimeInput('x', { signed: true })).toEqual({ ok: false })
  })
})
