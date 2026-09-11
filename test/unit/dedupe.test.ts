import { describe, expect, it } from 'vitest'
import {
  compareRaceForImport,
  competitionIdentitySignature,
  raceIdentitySignature,
} from '../../server/utils/dedupe'

describe('import de-duplication (plan section 6)', () => {
  it('competition identity ignores source, so OSTA and SSR resolve to the same competition (rule 1)', () => {
    const ostaSig = competitionIdentitySignature('2024-11-16', 'KNSB Bekerwedstrijd Heerenveen')
    const ssrSig = competitionIdentitySignature('2024-11-16', '  KNSB   Bekerwedstrijd Heerenveen ')
    expect(ostaSig).toBe(ssrSig)
  })

  it('two same-day same-distance races with different lane/opponent are distinct (rule 2, a dead heat)', () => {
    const a = { distanceM: 1500, lane: 'gl', opponent: 'Pietersen, Joris', totalTimeMs: 133900, status: 'finished' }
    const b = { distanceM: 1500, lane: 'bl', opponent: 'Jansen, Remco', totalTimeMs: 133900, status: 'finished' }
    expect(compareRaceForImport(a, b)).toBe('distinct')
  })

  it('same slot, same everything -> identical (re-seen, not a new row) (rule 5 idempotency)', () => {
    const a = { distanceM: 1500, lane: null, opponent: null, totalTimeMs: 133900, status: 'finished', lapsMs: [41500, 30200, 30800, 31400] }
    const b = { distanceM: 1500, lane: null, opponent: null, totalTimeMs: 133900, status: 'finished', lapsMs: [41500, 30200, 30800, 31400] }
    expect(compareRaceForImport(a, b)).toBe('identical')
  })

  it('same slot, different time -> update_candidate, never auto-applied (rule 3)', () => {
    const existing = { distanceM: 1500, lane: null, opponent: null, totalTimeMs: 133900, status: 'finished' }
    const corrected = { distanceM: 1500, lane: null, opponent: null, totalTimeMs: 133850, status: 'finished' }
    expect(compareRaceForImport(existing, corrected)).toBe('update_candidate')
  })

  it('raceIdentitySignature is stable regardless of lane/opponent casing or whitespace', () => {
    const a = raceIdentitySignature({ distanceM: 500, lane: ' GL ', opponent: 'Foo', totalTimeMs: 1000, status: 'finished' })
    const b = raceIdentitySignature({ distanceM: 500, lane: 'gl', opponent: 'foo', totalTimeMs: 1000, status: 'finished' })
    expect(a).toBe(b)
  })
})
