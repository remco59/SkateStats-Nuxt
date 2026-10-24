import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../db/client'
import { targets } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'
import { toStoredSplitJson } from '../../../utils/targets'

const positiveMs = z.number().int().positive().nullable().optional()

// Every part is optional -- a target can be just a time, just some splits or
// just a note -- but not nothing at all (like the old app). Fade is a
// difference and can be negative or zero.
const bodySchema = z.object({
  distanceM: z.number().int().positive(),
  targetTimeMs: positiveMs,
  openingMs: positiveMs,
  avg400Ms: positiveMs,
  last400Ms: positiveMs,
  fade400Ms: z.number().int().nullable().optional(),
  notes: z.string().max(2000).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  const splits = {
    openingMs: body.openingMs ?? null,
    avg400Ms: body.avg400Ms ?? null,
    last400Ms: body.last400Ms ?? null,
    fade400Ms: body.fade400Ms ?? null,
  }
  const targetTimeMs = body.targetTimeMs ?? null
  const notes = body.notes?.trim() || null

  if (targetTimeMs === null && toStoredSplitJson(splits) === null && !notes) {
    throw createError({ statusCode: 400, statusMessage: 'Vul minimaal een doeltijd, een split of een notitie in.' })
  }

  const db = useDb()
  const now = new Date().toISOString()
  const values = {
    targetTimeMs,
    generatorProfileJson: toStoredSplitJson(splits),
    notes,
    updatedAt: now,
  }

  // Saving replaces the whole target for that distance (an edit sends every
  // part again), so clearing a field really clears it.
  const existing = db
    .select({ distanceM: targets.distanceM })
    .from(targets)
    .where(and(eq(targets.userId, session.user.id), eq(targets.distanceM, body.distanceM)))
    .get()

  if (existing) {
    db.update(targets)
      .set(values)
      .where(and(eq(targets.userId, session.user.id), eq(targets.distanceM, body.distanceM)))
      .run()
  } else {
    db.insert(targets)
      .values({ userId: session.user.id, distanceM: body.distanceM, createdAt: now, ...values })
      .run()
  }

  return { ok: true }
})
