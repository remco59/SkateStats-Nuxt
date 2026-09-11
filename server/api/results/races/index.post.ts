import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { competitions, races, raceLaps, RACE_STATUSES, RACE_TAGS } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'
import { parseLapsToMs } from '../../../utils/time'
import { nextSequenceInDay } from '../../../utils/race-service'

const bodySchema = z.object({
  competitionId: z.number().int().positive().optional(),
  newCompetition: z
    .object({
      name: z.string().min(1).max(300),
      venue: z.string().max(200).optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .optional(),
  distanceM: z.number().int().positive(),
  status: z.enum(RACE_STATUSES).default('finished'),
  totalTimeMs: z.number().int().positive().optional(),
  lapsCsv: z.string().optional(),
  trackType: z.enum(['indoor', 'outdoor']).default('indoor'),
  lane: z.string().max(20).optional(),
  opponent: z.string().max(200).optional(),
  category: z.string().max(50).optional(),
  className: z.string().max(50).optional(),
  tag: z.enum(RACE_TAGS).optional(),
  notes: z.string().max(5000).optional(),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)

  if (!body.competitionId && !body.newCompetition) {
    throw createError({ statusCode: 400, statusMessage: 'competitionId of newCompetition is verplicht' })
  }

  let lapsMs: number[] = []
  let totalTimeMs = body.totalTimeMs ?? null
  if (body.lapsCsv) {
    const parsed = parseLapsToMs(body.lapsCsv)
    if (parsed.error) {
      throw createError({ statusCode: 400, statusMessage: parsed.error })
    }
    lapsMs = parsed.lapsMs
    totalTimeMs = parsed.totalMs ?? totalTimeMs
  }
  if (body.status !== 'finished') totalTimeMs = null

  const db = useDb()

  const result = db.transaction((tx) => {
    let competitionId: number
    let competitionDate: string

    if (body.competitionId) {
      const comp = tx
        .select()
        .from(competitions)
        .where(and(eq(competitions.id, body.competitionId), eq(competitions.userId, session.user.id)))
        .get()
      if (!comp) throw createError({ statusCode: 404, statusMessage: 'Wedstrijd niet gevonden' })
      competitionId = comp.id
      competitionDate = comp.date
    } else {
      const nc = body.newCompetition!
      const created = tx
        .insert(competitions)
        .values({
          userId: session.user.id,
          name: nc.name,
          venue: nc.venue || null,
          date: nc.date,
          source: 'manual',
          createdAt: new Date().toISOString(),
        })
        .returning()
        .get()
      competitionId = created.id
      competitionDate = created.date
    }

    const sequenceInDay = nextSequenceInDay(session.user.id, competitionDate)
    const now = new Date().toISOString()

    const race = tx
      .insert(races)
      .values({
        competitionId,
        userId: session.user.id,
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
        source: 'manual',
        sequenceInDay,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get()

    if (lapsMs.length) {
      tx.insert(raceLaps)
        .values(lapsMs.map((lapMs, i) => ({ raceId: race.id, lapIndex: i + 1, lapMs })))
        .run()
    }

    return race
  })

  return result
})
