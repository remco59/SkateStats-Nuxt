import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { races, RACE_STATUSES, RACE_TAGS } from '../../../../db/schema'
import { requireOwnedResource } from '../../../../utils/access'
import { parseLapsToMs } from '../../../../utils/time'
import { setRaceLaps } from '../../../../utils/race-service'

// NOTE: lapsCsv always REPLACES the race's laps, empty string included --
// the edit form must always resend the current laps (pre-filled) unless
// the user is deliberately clearing them.
const bodySchema = z.object({
  distanceM: z.number().int().positive(),
  status: z.enum(RACE_STATUSES),
  totalTimeMs: z.number().int().positive().optional(),
  lapsCsv: z.string().optional(),
  trackType: z.enum(['indoor', 'outdoor']),
  lane: z.string().max(20).optional(),
  opponent: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  className: z.string().max(50).optional(),
  tag: z.enum(RACE_TAGS).optional(),
  notes: z.string().max(5000).optional(),
})

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  await requireOwnedResource(event, races, id)
  const body = await readValidatedBody(event, bodySchema.parse)

  let lapsMs: number[] = []
  let totalTimeMs = body.totalTimeMs ?? null
  if (body.lapsCsv) {
    const parsed = parseLapsToMs(body.lapsCsv)
    if (parsed.error) throw createError({ statusCode: 400, statusMessage: parsed.error })
    lapsMs = parsed.lapsMs
    totalTimeMs = parsed.totalMs ?? totalTimeMs
  }
  if (body.status !== 'finished') totalTimeMs = null

  const db = useDb()
  const updated = db
    .update(races)
    .set({
      distanceM: body.distanceM,
      status: body.status,
      totalTimeMs,
      trackType: body.trackType,
      lane: body.lane || null,
      opponent: body.opponent || null,
      category: body.category || null,
      className: body.className || null,
      tag: body.tag || null,
      notes: body.notes || null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(races.id, id))
    .returning()
    .get()

  setRaceLaps(id, lapsMs)

  return updated
})
