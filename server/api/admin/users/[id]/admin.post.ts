import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { users } from '../../../../db/schema'
import { countAdmins, requireAdmin } from '../../../../utils/access'

const bodySchema = z.object({ isAdmin: z.boolean() })

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const userId = Number(getRouterParam(event, 'id'))
  const { isAdmin } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const target = db.select().from(users).where(eq(users.id, userId)).get()
  if (!target) throw createError({ statusCode: 404 })

  // The last remaining admin cannot be demoted -- by themselves OR by
  // another admin (plan section 8: the old app only guarded self-demote).
  if (target.isAdmin && !isAdmin && countAdmins() <= 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Dit is de laatste beheerder -- kan niet worden gedegradeerd.',
    })
  }

  db.update(users)
    .set({ isAdmin, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
    .run()

  if (userId === session.user.id) {
    await replaceUserSession(event, { user: { ...session.user, isAdmin } })
  }

  return { ok: true }
})
