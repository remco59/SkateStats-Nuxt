import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const { currentPassword, newPassword } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const user = db.select().from(users).where(eq(users.id, session.user.id)).get()
  if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
    throw createError({ statusCode: 400, statusMessage: 'Huidig wachtwoord klopt niet' })
  }

  const newHash = await hashPassword(newPassword)
  // Bump session_version so every OTHER active session for this account is
  // invalidated immediately (plan section 8) -- checked by
  // server/plugins/session-version-check.ts on the next request each holds.
  const newVersion = user.sessionVersion + 1

  db.update(users)
    .set({ passwordHash: newHash, sessionVersion: newVersion, updatedAt: new Date().toISOString() })
    .where(eq(users.id, user.id))
    .run()

  // Keep THIS session alive by updating its stored sessionVersion to match.
  await replaceUserSession(event, {
    user: { ...session.user, sessionVersion: newVersion },
  })

  return { ok: true }
})
