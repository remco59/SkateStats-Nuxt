import { eq } from 'drizzle-orm'
import { useDb } from '../db/client'
import { users } from '../db/schema'

/**
 * Enforces session invalidation on password reset/account deletion (plan
 * section 8): nuxt-auth-utils sessions are stateless (sealed cookie), so
 * we re-check the stored sessionVersion against the DB on every session
 * fetch. Throwing here clears the session cookie for that request.
 */
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session) => {
    if (!session.user) return

    const db = useDb()
    const dbUser = db.select().from(users).where(eq(users.id, session.user.id)).get()

    if (!dbUser || dbUser.sessionVersion !== session.user.sessionVersion) {
      throw createError({ statusCode: 401, statusMessage: 'Session invalidated' })
    }
  })
})
