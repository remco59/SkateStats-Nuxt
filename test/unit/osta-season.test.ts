import { describe, expect, it } from 'vitest'
import { ostaSeasonSchema } from '../../server/utils/osta-season'

describe('ostaSeasonSchema (old normalize_osta_season)', () => {
  it('accepts a start year and ALL, upper-casing and trimming like the old app', () => {
    expect(ostaSeasonSchema.parse('2025')).toBe('2025')
    expect(ostaSeasonSchema.parse(' all ')).toBe('ALL')
    expect(ostaSeasonSchema.parse('ALL')).toBe('ALL')
  })

  it.each(['', '25', '2025-2026', 'alles', '20255'])('rejects %j', (value) => {
    expect(ostaSeasonSchema.safeParse(value).success).toBe(false)
  })
})
