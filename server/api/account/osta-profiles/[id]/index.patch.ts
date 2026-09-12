import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { ostaProfileLinks } from '../../../../db/schema'
import { requireValidSession } from '../../../../utils/access'

const bodySchema = z.object({
  monitorMode: z.enum(['notify', 'auto_import', 'off']).optional(),
  season: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  isPrimary: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const updated = db
    .update(ostaProfileLinks)
    .set(body)
    .where(and(eq(ostaProfileLinks.id, id), eq(ostaProfileLinks.userId, session.user.id)))
    .returning()
    .get()

  return updated
})
