import { describe, expect, it } from 'vitest'
import {
  buildRaceFilterOptions,
  compareRacesForList,
  distinctOptions,
  filterAndSortRaces,
  type RaceListRow,
} from '../../server/utils/race-filter'
import golden from '../../reference/fixtures/calculations/golden_lists.json'

const comps = new Map(golden.competitions.map((c) => [c.id, c]))
const rows: RaceListRow[] = golden.races.map((r) => {
  const c = comps.get(r.competition_id)!
  return {
    id: r.id,
    distanceM: r.distance_m,
    totalTimeMs: r.total_time_ms,
    tag: r.tag,
    lane: r.lane,
    venue: c.venue,
    competitionName: c.name,
    competitionDate: c.date,
  }
})

const toFilters = (p: Record<string, string>) => ({
  distanceM: p.distance_m ? Number(p.distance_m) : null,
  tag: p.tag_key,
  lane: p.lane,
  venue: p.venue,
  dateFrom: p.date_from,
  dateTo: p.date_to,
})

describe('races list (golden fixture: the old app\'s real SQL)', () => {
  for (const c of golden.race_cases) {
    it(`filters and orders like the old query: ${JSON.stringify(c.params)}`, () => {
      expect(filterAndSortRaces(rows, toFilters(c.params)).map((r) => r.id)).toEqual(c.race_ids)
    })
  }

  it('offers the same lane and venue options (case variants collapsed)', () => {
    const first = golden.race_cases[0]!
    const options = buildRaceFilterOptions(rows)
    expect(options.laneOptions).toEqual(distinctOptions(first.lane_options))
    expect(options.venueOptions).toEqual(distinctOptions(first.venue_options))
    expect(options.distanceOptions).toEqual([500, 1000, 1500, 3000])
  })
})

describe('competitions list filtering (golden fixture)', () => {
  // The competitions route runs the same rules in SQL; here the rules are
  // checked against the old SQL's answers using the fixture's competitions.
  const matches = (c: { name: string; venue: string | null; date: string }, p: Record<string, string>) => {
    const q = (p.q ?? '').toLowerCase()
    if (q && !c.name.toLowerCase().includes(q) && !(c.venue ?? '').toLowerCase().includes(q)) return false
    if (p.venue && (c.venue ?? '').toLowerCase() !== p.venue.toLowerCase()) return false
    if (p.date_from && c.date < p.date_from) return false
    if (p.date_to && c.date > p.date_to) return false
    return true
  }
  for (const c of golden.competition_cases) {
    it(`selects the same competitions: ${JSON.stringify(c.params)}`, () => {
      const ids = golden.competitions
        .filter((comp) => matches(comp, c.params))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id))
        .map((comp) => comp.id)
      expect(ids).toEqual(c.competition_ids)
    })
  }
})

describe('compareRacesForList', () => {
  const base: RaceListRow = { id: 1, distanceM: 500, totalTimeMs: 40000, tag: null, lane: null, venue: null, competitionName: 'x', competitionDate: '2025-01-01' }

  it('puts a race without a time after the timed ones of the same distance', () => {
    const dns = { ...base, id: 2, totalTimeMs: null }
    expect([dns, base].sort(compareRacesForList).map((r) => r.id)).toEqual([1, 2])
    expect([base, dns].sort(compareRacesForList).map((r) => r.id)).toEqual([1, 2])
  })
})
