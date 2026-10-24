import { describe, expect, it } from 'vitest'
import { normalizeMotionPreference, normalizeThemePreference } from '../../shared/constants'

describe('normalizeThemePreference', () => {
  it('keeps the three valid values', () => {
    expect(normalizeThemePreference('dark')).toBe('dark')
    expect(normalizeThemePreference('light')).toBe('light')
    expect(normalizeThemePreference('system')).toBe('system')
  })

  it('falls back to dark for anything else', () => {
    expect(normalizeThemePreference('blue')).toBe('dark')
    expect(normalizeThemePreference(null)).toBe('dark')
    expect(normalizeThemePreference(undefined)).toBe('dark')
  })
})

describe('normalizeMotionPreference', () => {
  it('keeps the four old-app values (migrated accounts carry these)', () => {
    for (const v of ['all', 'background', 'cards', 'none'] as const) {
      expect(normalizeMotionPreference(v)).toBe(v)
    }
  })

  it("maps this app's earlier 'reduced' value to 'none'", () => {
    expect(normalizeMotionPreference('reduced')).toBe('none')
  })

  it('falls back to all for anything else', () => {
    expect(normalizeMotionPreference('wild')).toBe('all')
    expect(normalizeMotionPreference(null)).toBe('all')
  })
})
