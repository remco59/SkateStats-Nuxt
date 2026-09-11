import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { users } from '../../../../db/schema'
import { requireAdmin } from '../../../../utils/access'

const bodySchema = z.object({ newPassword: z.string().min(8) })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const userId = Number(getRouterParam(event, 'id'))
  const { newPassword } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const target = db.select().from(users).where(eq(users.id, userId)).get()
  if (!target) throw createError({ statusCode: 404 })

  const passwordHash = await hashPassword(newPassword)
  // Admin-triggered reset also invalidates the target user's other
  // sessions immediately (plan section 8).
  db.update(users)
    .set({
      passwordHash,
      sessionVersion: target.sessionVersion + 1,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, userId))
    .run()

  return { ok: true }
})
