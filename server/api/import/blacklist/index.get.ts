import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { blacklist, raceBlacklist } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'
import { describeCompetitionSignature, describeRaceIdentity } from '../../../utils/import/blacklist-labels'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()

  const competitionItems = db.select().from(blacklist).where(eq(blacklist.userId, session.user.id)).all()
  const raceItems = db
    .select()
    .from(raceBlacklist)
    .where(eq(raceBlacklist.userId, session.user.id))
    .all()
    .map((item) => {
      const competition = describeCompetitionSignature(item.competitionSignature)
      return {
        ...item,
        label: describeRaceIdentity(item.raceIdentitySignature),
        competitionDate: competition.date,
        competitionName: competition.name,
      }
    })

  return { competitionItems, raceItems }
})
