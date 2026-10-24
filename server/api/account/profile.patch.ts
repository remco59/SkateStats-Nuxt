import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { MOTION_PREFERENCES, THEME_PREFERENCES } from '../../../shared/constants'
import { toSessionUser } from '../../utils/session-user'

// Every field is optional so the profile and appearance forms can save
// independently; Drizzle skips undefined values in .set().
const bodySchema = z.object({
  skaterName: z.string().min(1).max(200).optional(),
  themePreference: z.enum(THEME_PREFERENCES).optional(),
  motionPreference: z.enum(MOTION_PREFERENCES).optional(),
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
  await replaceUserSession(event, { user: toSessionUser(updated) })

  return { ok: true }
})
