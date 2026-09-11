import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const user = db.select().from(users).where(eq(users.username, username)).get()

  if (!user || !(await verifyPassword(user.passwordHash, password))) {
    throw createError({ statusCode: 401, statusMessage: 'Ongeldige inloggegevens' })
  }

  db.update(users)
    .set({ lastLoginAt: new Date().toISOString() })
    .where(eq(users.id, user.id))
    .run()

  await setUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      skaterName: user.skaterName,
      isAdmin: user.isAdmin,
      sessionVersion: user.sessionVersion,
    },
  })

  return { ok: true }
})
