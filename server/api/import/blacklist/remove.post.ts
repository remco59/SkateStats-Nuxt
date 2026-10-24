import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../../db/client'
import { blacklist, raceBlacklist } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

const bodySchema = z.object({
  competitionIds: z.array(z.number().int()).default([]),
  raceIds: z.array(z.number().int()).default([]),
})

/** "Haal geselecteerde van blacklist": lifts several ignores at once. */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const { competitionIds, raceIds } = await readValidatedBody(event, bodySchema.parse)
  if (!competitionIds.length && !raceIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'Selecteer minimaal één item om van de blacklist te halen.' })
  }

  const db = useDb()
  let removed = 0
  if (competitionIds.length) {
    removed += db
      .delete(blacklist)
      .where(and(eq(blacklist.userId, session.user.id), inArray(blacklist.id, competitionIds)))
      .run().changes
  }
  if (raceIds.length) {
    removed += db
      .delete(raceBlacklist)
      .where(and(eq(raceBlacklist.userId, session.user.id), inArray(raceBlacklist.id, raceIds)))
      .run().changes
  }
  return { removed }
})
