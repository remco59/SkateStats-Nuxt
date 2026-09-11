import { describe, expect, it } from 'vitest'
import { fmtMs, parseLapsToMs } from '../../server/utils/time'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

describe('parseLapsToMs (golden fixtures)', () => {
  for (const c of golden.lap_input_parsing) {
    it(`parses ${JSON.stringify(c.input)}`, () => {
      const result = parseLapsToMs(c.input)
      expect(result.lapsMs).toEqual(c.expected.laps_ms)
      expect(result.totalMs).toEqual(c.expected.total_ms)
      expect(result.error).toEqual(c.expected.error)
    })
  }
})

describe('fmtMs (golden fixtures)', () => {
  for (const c of golden.fmt_ms) {
    it(`formats ${JSON.stringify(c.input)}`, () => {
      expect(fmtMs(c.input as number | null)).toBe(c.expected)
    })
  }
})
