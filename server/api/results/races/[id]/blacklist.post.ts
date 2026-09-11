import { eq } from 'drizzle-orm'
import { races, raceBlacklist } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
import { requireOwnedResource } from '../../../../utils/access'
import { competitionIdentitySignature, raceIdentitySignature } from '../../../../utils/dedupe'
import { getRaceWithContext } from '../../../../utils/race-service'

/**
 * Delete ONE race from a competition that is otherwise KEPT, per plan
 * section 6 rule 4: this must NOT blacklist the whole competition (the
 * next import of that competition should still be able to add other
 * races), but the next import must also not silently re-add just this
 * one -- so we record a race-level blacklist entry instead.
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { session } = await requireOwnedResource(event, races, id)

  const db = useDb()
  const race = getRaceWithContext(session.user.id, id)
  if (!race) throw createError({ statusCode: 404 })

  const competitionSignature = competitionIdentitySignature(race.competitionDate, race.competitionName)
  const raceSignature = raceIdentitySignature({
    distanceM: race.distanceM,
    lane: race.lane,
    opponent: race.opponent,
    totalTimeMs: race.totalTimeMs,
    status: race.status,
    lapsMs: race.lapsMs,
  })

  db.transaction((tx) => {
    tx.insert(raceBlacklist)
      .values({
        userId: session.user.id,
        competitionSignature,
        raceIdentitySignature: raceSignature,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .run()
    tx.delete(races).where(eq(races.id, id)).run()
  })

  return { ok: true }
})
