import { and, desc, eq, sql } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { competitions } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

/**
 * Search/filter contract per REBUILD_PLAN.md section 5.5:
 * - `q`: case-insensitive substring match on name OR venue.
 * - `venue`: exact, case-insensitive match.
 * - `dateFrom`/`dateTo`: inclusive date range.
 */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const query = getQuery(event)
  const q = String(query.q ?? '').trim()
  const venue = String(query.venue ?? '').trim()
  const dateFrom = String(query.dateFrom ?? '').trim()
  const dateTo = String(query.dateTo ?? '').trim()

  const db = useDb()
  const filters = [eq(competitions.userId, session.user.id)]

  if (q) {
    const likeValue = `%${q.toLowerCase()}%`
    filters.push(
      sql`(LOWER(${competitions.name}) LIKE ${likeValue} OR LOWER(COALESCE(${competitions.venue}, '')) LIKE ${likeValue})`,
    )
  }
  if (venue) {
    filters.push(sql`LOWER(COALESCE(${competitions.venue}, '')) = ${venue.toLowerCase()}`)
  }
  if (dateFrom) filters.push(sql`${competitions.date} >= ${dateFrom}`)
  if (dateTo) filters.push(sql`${competitions.date} <= ${dateTo}`)

  const rows = db
    .select()
    .from(competitions)
    .where(and(...filters))
    .orderBy(desc(competitions.date), desc(competitions.id))
    .all()

  const venueOptions = db
    .selectDistinct({ venue: competitions.venue })
    .from(competitions)
    .where(eq(competitions.userId, session.user.id))
    .all()
    .map((r) => r.venue)
    .filter((v): v is string => !!v && v.trim().length > 0)
    .sort()

  return { competitions: rows, venueOptions }
})
