import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { competitions, races, RACE_STATUSES, RACE_TAGS } from '../../../../db/schema'
import { requireOwnedResource } from '../../../../utils/access'
import { parseLapsToMs } from '../../../../utils/time'
import { nextSequenceInDay, setRaceLaps } from '../../../../utils/race-service'

// NOTE: lapsCsv always REPLACES the race's laps, empty string included --
// the edit form must always resend the current laps (pre-filled) unless
// the user is deliberately clearing them.
//
// Moving the race: pass `competitionId` (another existing competition of the
// user's) or `newCompetition` (created on the spot). Pass neither to leave the
// race where it is.
const bodySchema = z.object({
  competitionId: z.number().int().positive().optional(),
  newCompetition: z
    .object({
      name: z.string().trim().min(1).max(300),
      venue: z.string().max(200).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
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
  // Ownership first, before looking at the body.
  const { session, row: race } = await requireOwnedResource(event, races, id)
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

  // Resolve the competition first, so a bad choice never leaves a half-made one.
  let move: { competitionId: number; sequenceInDay: number } | null = null
  if (body.competitionId !== undefined && body.competitionId !== race.competitionId) {
    const target = db
      .select()
      .from(competitions)
      .where(and(eq(competitions.id, body.competitionId), eq(competitions.userId, session.user.id)))
      .get()
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Wedstrijd niet gevonden' })
    move = { competitionId: target.id, sequenceInDay: nextSequenceInDay(session.user.id, target.date) }
  } else if (body.competitionId === undefined && body.newCompetition) {
    const nc = body.newCompetition
    const created = db
      .insert(competitions)
      .values({
        userId: session.user.id,
        name: nc.name,
        venue: nc.venue?.trim() || null,
        date: nc.date,
        source: 'manual',
        createdAt: new Date().toISOString(),
      })
      .returning()
      .get()
    move = { competitionId: created.id, sequenceInDay: nextSequenceInDay(session.user.id, created.date) }
  }

  const updated = db
    .update(races)
    .set({
      ...(move ?? {}),
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
