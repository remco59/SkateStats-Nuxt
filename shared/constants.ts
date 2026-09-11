// Shared between server (schema/validation) and app (form options) --
// keeping this in shared/ (not server/) means the client bundle can use it
// without pulling in drizzle/server-only code.

export const RACE_STATUSES = ['finished', 'dnf', 'dns', 'dsq', 'dq', 'wdr', 'nc'] as const
export type RaceStatus = (typeof RACE_STATUSES)[number]

export const RACE_STATUS_LABELS: Record<RaceStatus, string> = {
  finished: 'Gefinisht',
  dnf: 'DNF',
  dns: 'DNS',
  dsq: 'DSQ',
  dq: 'DQ',
  wdr: 'WDR',
  nc: 'NC',
}

export const RACE_TAGS = [
  'training',
  'test',
  'important',
  'bad_ice',
  'sick',
  'injured',
  'fallen',
] as const
export type RaceTag = (typeof RACE_TAGS)[number]

export const RACE_TAG_LABELS: Record<RaceTag, string> = {
  training: 'Training',
  test: 'Test',
  important: 'Belangrijk',
  bad_ice: 'Slecht ijs',
  sick: 'Ziek',
  injured: 'Geblesseerd',
  fallen: 'Gevallen',
}

export const COMMON_DISTANCES = [100, 300, 500, 1000, 1500, 3000, 5000, 10000] as const

// DB-sourced values are typed as plain `string` (Drizzle text columns), not
// the literal union -- these helpers accept that and fall back gracefully
// instead of every call site needing an `as RaceStatus` cast.
export function raceStatusLabel(status: string): string {
  return RACE_STATUS_LABELS[status as RaceStatus] ?? status
}

export function raceTagLabel(tag: string | null | undefined): string {
  if (!tag) return '-'
  return RACE_TAG_LABELS[tag as RaceTag] ?? tag
}
