import type { H3Event } from 'h3'
import { eq, and, type SQL } from 'drizzle-orm'
import type { SQLiteTable } from 'drizzle-orm/sqlite-core'
import { useDb } from '../db/client'
import { users } from '../db/schema'

/**
 * `requireUserSession` (nuxt-auth-utils) only checks that the sealed
 * cookie decodes -- it does NOT re-check our DB `session_version` on every
 * call (that only happens on the client's own `/api/_auth/session` fetch,
 * via the sessionHooks 'fetch' hook in server/plugins/session-version-check.ts,
 * which is NOT invoked by requireUserSession()). Verified this the hard
 * way: without this helper, a stale cookie from before a password reset
 * kept working against real API routes. So every server route -- via this
 * helper or requireOwnedResource/requireAdmin below, never raw
 * requireUserSession -- re-checks session_version against the DB itself
 * (plan section 8's session-invalidation requirement).
 */
export async function requireValidSession(event: H3Event) {
  const session = await requireUserSession(event)
  const db = useDb()
  const dbUser = db.select().from(users).where(eq(users.id, session.user.id)).get()

  if (!dbUser || dbUser.sessionVersion !== session.user.sessionVersion) {
    await clearUserSession(event)
    throw createError({ statusCode: 401, statusMessage: 'Sessie is verlopen, log opnieuw in.' })
  }

  return session
}

/**
 * Every server/api route that reads or writes a user-owned resource
 * (competitions, races, targets, import batches, exports, comparisons,
 * blacklist entries) MUST go through this helper instead of an ad-hoc
 * ownership check (plan section 8) -- so a new route can't forget it.
 *
 * `table` must have a `userId` column and an `id` column.
 */
export async function requireOwnedResource<
  T extends SQLiteTable & { id: SQL; userId: SQL },
>(event: H3Event, table: T, id: number): Promise<Record<string, unknown>> {
  const session = await requireValidSession(event)
  const db = useDb()

  const row = db
    .select()
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, session.user.id)))
    .get()

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return row as Record<string, unknown>
}

export async function requireAdmin(event: H3Event) {
  const session = await requireValidSession(event)
  if (!session.user.isAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'Admin required' })
  }
  return session
}

/** The last remaining admin cannot be demoted or deleted (plan section 8). */
export function countAdmins(): number {
  const db = useDb()
  return db.select().from(users).where(eq(users.isAdmin, true)).all().length
}
