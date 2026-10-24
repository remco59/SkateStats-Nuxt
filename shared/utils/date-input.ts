/**
 * Dates typed by a person as dd/mm/jjjj (also dd-mm-jjjj and the ISO form),
 * converted to and from the "YYYY-MM-DD" the API uses. Like the old app's
 * date field, but a date that doesn't exist (31/02/2025) is rejected here
 * instead of coming back as an error from the server.
 */

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

/** "2025-01-15" -> "15/01/2025"; anything else is returned as it is. */
export function isoToDisplay(iso: string | null | undefined): string {
  const value = iso ?? ''
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value
}

/** Typed text -> "YYYY-MM-DD", or "" when it isn't a real date. */
export function displayToIso(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return ''

  let year: number
  let month: number
  let day: number
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const dmy = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (iso) {
    ;[year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])] as [number, number, number]
  } else if (dmy) {
    ;[day, month, year] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])] as [number, number, number]
  } else {
    return ''
  }
  return isRealDate(year, month, day) ? `${pad(year, 4)}-${pad(month)}-${pad(day)}` : ''
}
