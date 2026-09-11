import { eq } from 'drizzle-orm'
import { competitions } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
import { requireOwnedResource } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  await requireOwnedResource(event, competitions, id)

  const db = useDb()
  // ON DELETE CASCADE removes its races/laps too.
  db.delete(competitions).where(eq(competitions.id, id)).run()

  return { ok: true }
})
