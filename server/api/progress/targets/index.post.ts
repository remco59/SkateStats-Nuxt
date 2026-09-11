import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../db/client'
import { targets } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

const bodySchema = z.object({
  distanceM: z.number().int().positive(),
  targetTimeMs: z.number().int().positive(),
  notes: z.string().max(2000).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const now = new Date().toISOString()
  const existing = db
    .select()
    .from(targets)
    .where(and(eq(targets.userId, session.user.id), eq(targets.distanceM, body.distanceM)))
    .get()

  if (existing) {
    db.update(targets)
      .set({ targetTimeMs: body.targetTimeMs, notes: body.notes || null, updatedAt: now })
      .where(and(eq(targets.userId, session.user.id), eq(targets.distanceM, body.distanceM)))
      .run()
  } else {
    db.insert(targets)
      .values({
        userId: session.user.id,
        distanceM: body.distanceM,
        targetTimeMs: body.targetTimeMs,
        notes: body.notes || null,
        createdAt: now,
        updatedAt: now,
      })
      .run()
  }

  return { ok: true }
})
