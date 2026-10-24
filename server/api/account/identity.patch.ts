import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { accountErrorToHttp, AccountError, assertSkaterNameFree, assertUsernameFree } from '../../utils/accounts'

const bodySchema = z.object({ username: z.string(), skaterName: z.string() })

/** Username and skater name (the old "Profiel" form), with its uniqueness errors. */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  const username = body.username.trim()
  const skaterName = body.skaterName.trim()

  const db = useDb()
  try {
    if (!username || !skaterName) throw new AccountError('Gebruikersnaam en schaatsersnaam zijn verplicht.')
    assertUsernameFree(db, username, session.user.id)
    assertSkaterNameFree(db, skaterName, session.user.id)
  } catch (err) {
    accountErrorToHttp(err)
  }

  db.update(users)
    .set({ username, skaterName, updatedAt: new Date().toISOString() })
    .where(eq(users.id, session.user.id))
    .run()

  await replaceUserSession(event, { user: { ...session.user, username, skaterName } })
  return { ok: true, username, skaterName }
})
