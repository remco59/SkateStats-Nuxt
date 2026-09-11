import { eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()
  const user = db.select().from(users).where(eq(users.id, session.user.id)).get()
  if (!user) throw createError({ statusCode: 404 })

  const { passwordHash: _passwordHash, ...safe } = user
  return safe
})
