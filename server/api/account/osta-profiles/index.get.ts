import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { ostaProfileLinks } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()
  return db.select().from(ostaProfileLinks).where(eq(ostaProfileLinks.userId, session.user.id)).all()
})
