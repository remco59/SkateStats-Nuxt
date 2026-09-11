import { eq } from 'drizzle-orm'
import { races } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
import { requireOwnedResource } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  await requireOwnedResource(event, races, id)

  const db = useDb()
  db.delete(races).where(eq(races.id, id)).run()

  return { ok: true }
})
