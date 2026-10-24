import { describe, expect, it } from 'vitest'
import { displayToIso, isoToDisplay } from '../../shared/utils/date-input'

describe('displayToIso', () => {
  it('reads dd/mm/jjjj, dd-mm-jjjj and ISO', () => {
    expect(displayToIso('15/01/2025')).toBe('2025-01-15')
    expect(displayToIso('15-01-2025')).toBe('2025-01-15')
    expect(displayToIso('2025-01-15')).toBe('2025-01-15')
  })

  it('accepts single-digit day and month', () => {
    expect(displayToIso('5/3/2025')).toBe('2025-03-05')
    expect(displayToIso('2025-3-5')).toBe('2025-03-05')
  })

  it('rejects dates that do not exist', () => {
    expect(displayToIso('31/02/2025')).toBe('')
    expect(displayToIso('00/01/2025')).toBe('')
    expect(displayToIso('15/13/2025')).toBe('')
    expect(displayToIso('29/02/2025')).toBe('')
    expect(displayToIso('29/02/2024')).toBe('2024-02-29')
  })

  it('returns empty for empty or junk input', () => {
    expect(displayToIso('')).toBe('')
    expect(displayToIso(null)).toBe('')
    expect(displayToIso('gisteren')).toBe('')
    expect(displayToIso('15/01/25')).toBe('')
  })
})

describe('isoToDisplay', () => {
  it('formats ISO as dd/mm/jjjj and leaves anything else alone', () => {
    expect(isoToDisplay('2025-01-15')).toBe('15/01/2025')
    expect(isoToDisplay('')).toBe('')
    expect(isoToDisplay(null)).toBe('')
    expect(isoToDisplay('15/01/2025')).toBe('15/01/2025')
  })
})
