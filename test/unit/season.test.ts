import { describe, expect, it } from 'vitest'
import { seasonBoundsFromLabel, seasonLabelForDate } from '../../server/utils/season'
import golden from '../../reference/fixtures/calculations/golden_calculations.json'

describe('season boundaries (golden fixtures)', () => {
  for (const c of golden.season_labeling) {
    it(`${c.date} -> ${c.expected_season_label}`, () => {
      expect(seasonLabelForDate(c.date)).toBe(c.expected_season_label)
    })
  }

  it('seasonBoundsFromLabel', () => {
    expect(seasonBoundsFromLabel(golden.season_bounds_from_label.input)).toEqual(
      golden.season_bounds_from_label.expected,
    )
  })
})
