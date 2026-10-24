import { describe, expect, it } from 'vitest'
import { describeCompetitionSignature, describeRaceIdentity } from '../../server/utils/import/blacklist-labels'
import { competitionIdentitySignature, raceIdentitySignature } from '../../server/utils/dedupe'

describe('readable blacklist entries', () => {
  it('describes a race from its identity signature', () => {
    const sig = raceIdentitySignature({ distanceM: 1500, lane: 'Binnen', opponent: 'J. Jansen', totalTimeMs: 131000, status: 'finished', lapsMs: [41000, 30000, 30000, 30000] })
    expect(describeRaceIdentity(sig)).toBe('1500m · 2:11.00 · binnen · vs j. jansen · 4 rondes')
  })

  it('shows the status instead of a time for a race that did not finish', () => {
    const sig = raceIdentitySignature({ distanceM: 500, totalTimeMs: null, status: 'dnf' })
    expect(describeRaceIdentity(sig)).toBe('500m · DNF')
  })

  it('splits a competition signature into date and name', () => {
    expect(describeCompetitionSignature(competitionIdentitySignature('2025-10-05', 'Herfstcup Thialf'))).toEqual({
      date: '2025-10-05',
      name: 'herfstcup thialf',
    })
  })
})
