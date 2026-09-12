import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { isLegacyPasswordHash, verifyLegacyPassword } from '../../utils/legacy-password'

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const { username, password } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const user = db.select().from(users).where(eq(users.username, username)).get()

  let ok = false
  if (user) {
    if (isLegacyPasswordHash(user.passwordHash)) {
      ok = verifyLegacyPassword(user.passwordHash, password)
      if (ok) {
        // Migrated account, first successful login: lazily upgrade off the
        // old app's hash scheme now that we have the plaintext.
        const upgradedHash = await hashPassword(password)
        db.update(users).set({ passwordHash: upgradedHash }).where(eq(users.id, user.id)).run()
      }
    } else {
      ok = await verifyPassword(user.passwordHash, password)
    }
  }

  if (!user || !ok) {
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
