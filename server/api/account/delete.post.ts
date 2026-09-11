import { eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { countAdmins } from '../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get()
  if (!user) throw createError({ statusCode: 404 })

  // Last remaining admin cannot delete themselves either (plan section 8).
  if (user.isAdmin && countAdmins() <= 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Je bent de laatste beheerder -- maak eerst een andere admin aan.',
    })
  }

  // ON DELETE CASCADE (schema) removes competitions/races/targets/etc.
  db.delete(users).where(eq(users.id, user.id)).run()
  await clearUserSession(event)

  return { ok: true }
})
