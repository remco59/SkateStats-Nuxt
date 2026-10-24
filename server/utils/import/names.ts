/**
 * Splits an account's skater name into given and family name for the
 * SpeedSkatingResults form. Accepts "Achternaam, Voornaam" (this app's
 * convention) and the old app's "Voornaam Achternaam" (first word is the given name).
 */
export function splitNameParts(fullName: string): [givenName: string, familyName: string] {
  const trimmed = (fullName ?? '').trim()
  const comma = trimmed.indexOf(',')
  if (comma !== -1) {
    const family = trimmed.slice(0, comma).trim()
    const given = trimmed.slice(comma + 1).trim()
    if (family && given) return [given, family]
  }
  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (!parts.length) return ['', '']
  if (parts.length === 1) return [parts[0]!, '']
  return [parts[0]!, parts.slice(1).join(' ')]
}
