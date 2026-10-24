import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { users } from '../../../../db/schema'
import { requireAdmin } from '../../../../utils/access'
import { accountErrorToHttp, checkNewPassword } from '../../../../utils/accounts'

const bodySchema = z.object({ newPassword: z.string(), confirmPassword: z.string() })

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const userId = Number(getRouterParam(event, 'id'))
  const { newPassword, confirmPassword } = await readValidatedBody(event, bodySchema.parse)

  try {
    checkNewPassword(newPassword, confirmPassword)
  } catch (err) {
    accountErrorToHttp(err)
  }

  const db = useDb()
  const target = db.select().from(users).where(eq(users.id, userId)).get()
  if (!target) throw createError({ statusCode: 404 })

  const passwordHash = await hashPassword(newPassword)
  const sessionVersion = target.sessionVersion + 1
  // Admin-triggered reset also invalidates the target user's other
  // sessions immediately (plan section 8).
  db.update(users)
    .set({ passwordHash, sessionVersion, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
    .run()

  // Resetting your own password must not log you out of this session.
  if (userId === session.user.id) {
    await replaceUserSession(event, { user: { ...session.user, sessionVersion } })
  }

  return { ok: true }
})
