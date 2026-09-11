import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { competitions } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
import { requireOwnedResource } from '../../../../utils/access'

const bodySchema = z.object({
  name: z.string().min(1).max(300),
  venue: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  await requireOwnedResource(event, competitions, id)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const updated = db
    .update(competitions)
    .set({ name: body.name, venue: body.venue || null, date: body.date, notes: body.notes || null })
    .where(eq(competitions.id, id))
    .returning()
    .get()

  return updated
})
