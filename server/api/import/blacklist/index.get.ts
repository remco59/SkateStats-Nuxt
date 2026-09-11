import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/client'
import { blacklist, raceBlacklist } from '../../../db/schema'
import { requireValidSession } from '../../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()

  const competitionItems = db.select().from(blacklist).where(eq(blacklist.userId, session.user.id)).all()
  const raceItems = db.select().from(raceBlacklist).where(eq(raceBlacklist.userId, session.user.id)).all()

  return { competitionItems, raceItems }
})
