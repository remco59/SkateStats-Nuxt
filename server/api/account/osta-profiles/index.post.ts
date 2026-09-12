import { z } from 'zod'
import { useDb } from '../../../db/client'
import { ostaProfileLinks } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

const bodySchema = z.object({
  pid: z.string().min(1),
  searchName: z.string().min(1),
  season: z.string().regex(/^\d{4}$/),
  monitorMode: z.enum(['notify', 'auto_import', 'off']).default('notify'),
  isPrimary: z.boolean().optional().default(false),
})

/** Link an OSTA profile for monitoring -- a user can link MULTIPLE profiles (plan section 7). */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const created = db
    .insert(ostaProfileLinks)
    .values({
      userId: session.user.id,
      pid: body.pid,
      searchName: body.searchName,
      season: body.season,
      monitorMode: body.monitorMode,
      isPrimary: body.isPrimary,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [ostaProfileLinks.userId, ostaProfileLinks.pid],
      set: { searchName: body.searchName, season: body.season, monitorMode: body.monitorMode },
    })
    .returning()
    .get()

  return created
})
