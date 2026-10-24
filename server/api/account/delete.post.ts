import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { accountErrorToHttp, assertTypedUsername } from '../../utils/accounts'
import { countAdmins } from '../../utils/access'

const bodySchema = z.object({ confirmUsername: z.string().optional() })

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const { confirmUsername } = await readValidatedBody(event, bodySchema.parse)
  const db = useDb()

  const user = db.select().from(users).where(eq(users.id, session.user.id)).get()
  if (!user) throw createError({ statusCode: 404 })

  try {
    assertTypedUsername(confirmUsername, user.username, 'Typ je gebruikersnaam exact over om je account te verwijderen.')
  } catch (err) {
    accountErrorToHttp(err)
  }

  // Last remaining admin cannot delete themselves either (plan section 8).
  if (user.isAdmin && countAdmins() <= 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Je bent de laatste beheerder -- maak eerst een andere admin aan.',
    })
  }

  // ON DELETE CASCADE (schema) removes competitions/races/targets/etc.
  db.delete(users).where(eq(users.id, user.id)).run()
  await clearUserSession(event)

  return { ok: true }
})
