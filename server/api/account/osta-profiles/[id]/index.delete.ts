import { and, eq } from 'drizzle-orm'
import { useDb } from '../../../../db/client'
import { ostaProfileLinks } from '../../../../db/schema'
import { requireValidSession } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const id = Number(getRouterParam(event, 'id'))

  const db = useDb()
  db.delete(ostaProfileLinks)
    .where(and(eq(ostaProfileLinks.id, id), eq(ostaProfileLinks.userId, session.user.id)))
    .run()

  return { ok: true }
})
