import { z } from 'zod'
import { useDb } from '../../../db/client'
import { competitions } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

const bodySchema = z.object({
  name: z.string().min(1).max(300),
  venue: z.string().max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(5000).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const created = db
    .insert(competitions)
    .values({
      userId: session.user.id,
      name: body.name,
      venue: body.venue || null,
      date: body.date,
      notes: body.notes || null,
      source: 'manual',
      createdAt: new Date().toISOString(),
    })
    .returning()
    .get()

  return created
})
