import { and, eq } from 'drizzle-orm'
import { useDb } from '../../../../../db/client'
import { raceBlacklist } from '../../../../../db/schema'
import { requireValidSession } from '../../../../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const id = Number(getRouterParam(event, 'id'))

  const db = useDb()
  db.delete(raceBlacklist).where(and(eq(raceBlacklist.id, id), eq(raceBlacklist.userId, session.user.id))).run()

  return { ok: true }
})
