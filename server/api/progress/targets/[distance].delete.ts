import { and, eq } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { targets } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const distanceM = Number(getRouterParam(event, 'distance'))

  const db = useDb()
  db.delete(targets)
    .where(and(eq(targets.userId, session.user.id), eq(targets.distanceM, distanceM)))
    .run()

  return { ok: true }
})
