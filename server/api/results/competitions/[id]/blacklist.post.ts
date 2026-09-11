import { eq } from 'drizzle-orm'
import { competitions, blacklist } from '../../../../db/schema'
import { useDb } from '../../../../db/client'
import { requireOwnedResource } from '../../../../utils/access'
import { competitionIdentitySignature } from '../../../../utils/dedupe'

/**
 * Delete AND blacklist this whole competition, so a future import won't
 * re-add it (plan section 6). Deleting just a single race within a KEPT
 * competition must NOT hit this route -- see
 * server/api/results/races/[id]/blacklist.post.ts for the race-level
 * equivalent (rule 4).
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const { session, row: competition } = await requireOwnedResource(event, competitions, id)

  const db = useDb()
  // Source-agnostic, matching the identity the import pipeline classifies
  // incoming competitions against (plan section 6 rule 1) -- so blacklisting
  // a manually-entered competition also stops it being re-added from OSTA/SSR.
  const signature = competitionIdentitySignature(competition.date as string, competition.name as string)

  db.transaction((tx) => {
    tx.insert(blacklist)
      .values({
        userId: session.user.id,
        signature,
        competitionName: competition.name as string,
        competitionDate: competition.date as string,
        createdAt: new Date().toISOString(),
      })
      .onConflictDoNothing()
      .run()
    tx.delete(competitions).where(eq(competitions.id, id)).run()
  })

  return { ok: true }
})
