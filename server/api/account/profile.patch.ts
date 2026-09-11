import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'

const bodySchema = z.object({
  skaterName: z.string().min(1).max(200),
  themePreference: z.enum(['dark', 'light', 'system']).optional(),
  motionPreference: z.enum(['all', 'reduced']).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  db.update(users)
    .set({ ...body, updatedAt: new Date().toISOString() })
    .where(eq(users.id, session.user.id))
    .run()

  const updated = db.select().from(users).where(eq(users.id, session.user.id)).get()!
  await replaceUserSession(event, {
    user: {
      id: updated.id,
      username: updated.username,
      skaterName: updated.skaterName,
      isAdmin: updated.isAdmin,
      sessionVersion: updated.sessionVersion,
    },
  })

  return { ok: true }
})
