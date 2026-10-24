import { asc, desc, eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { ostaProfileLinks } from '../../db/schema'
import { requireValidSession } from '../../utils/access'
import { defaultOstaSearchName } from '../../utils/import/osta'
import { currentSeasonBounds } from '../../utils/season'
import { splitNameParts } from '../../utils/import/names'

/**
 * What the import forms start with, like the old import page: the OSTA form
 * from the primary linked profile (name, pid, season), SSR names from the
 * account's skater name, season = start year of the current season.
 */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const db = useDb()
  const season = currentSeasonBounds()[0].slice(0, 4)

  const profile = db
    .select()
    .from(ostaProfileLinks)
    .where(eq(ostaProfileLinks.userId, session.user.id))
    .orderBy(desc(ostaProfileLinks.isPrimary), asc(ostaProfileLinks.id))
    .get()

  const skaterName = session.user.skaterName
  const [givenName, familyName] = splitNameParts(skaterName)
  return {
    skaterName,
    osta: {
      searchName: profile?.searchName || defaultOstaSearchName(skaterName),
      pid: profile?.pid ?? '',
      season: profile?.season || season,
    },
    ssr: { givenName, familyName, season },
  }
})
