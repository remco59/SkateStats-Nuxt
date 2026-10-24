/**
 * A readable description of an ignored race for the blacklist overview.
 * The stored identity is `distance|lane|opponent|time|status|laps` (dedupe.ts),
 * which is meant for matching, not for people.
 */
export function describeRaceIdentity(signature: string): string {
  const [distance = '', lane = '', opponent = '', time = '', status = '', laps = ''] = signature.split('|')
  const parts = [distance ? `${distance}m` : '?']
  if (status && status !== 'finished') parts.push(status.toUpperCase())
  else if (time) parts.push(formatMs(Number(time)))
  if (lane) parts.push(lane)
  if (opponent) parts.push(`vs ${opponent}`)
  if (laps) parts.push(`${laps.split(',').length} rondes`)
  return parts.join(' · ')
}

/** "date|normalised name" -> its two parts (the name is the normalised, lower-case form). */
export function describeCompetitionSignature(signature: string): { date: string; name: string } {
  const at = signature.indexOf('|')
  return at === -1 ? { date: '', name: signature } : { date: signature.slice(0, at), name: signature.slice(at + 1) }
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms)) return '-'
  const total = ms / 1000
  const minutes = Math.floor(total / 60)
  const seconds = total - minutes * 60
  return minutes > 0 ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}` : seconds.toFixed(2)
}
