import { eq } from 'drizzle-orm'
import { useDb } from '../../../../db/client'
import { users } from '../../../../db/schema'
import { countAdmins, requireAdmin } from '../../../../utils/access'

export default defineEventHandler(async (event) => {
  const session = await requireAdmin(event)
  const userId = Number(getRouterParam(event, 'id'))

  // Deleting an account means typing its username first, like the old app.
  const { confirmUsername } = (await readBody<{ confirmUsername?: string } | undefined>(event)) ?? {}

  const db = useDb()
  const target = db.select().from(users).where(eq(users.id, userId)).get()
  if (!target) throw createError({ statusCode: 404 })

  try {
    assertTypedUsername(confirmUsername, target.username, 'Typ de juiste gebruikersnaam om een account te verwijderen.')
  } catch (err) {
    accountErrorToHttp(err)
  }

  // The last remaining admin cannot be deleted -- by themselves OR by
  // another admin (plan section 8).
  if (target.isAdmin && countAdmins() <= 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Dit is de laatste beheerder -- kan niet worden verwijderd.',
    })
  }

  db.delete(users).where(eq(users.id, userId)).run()

  if (userId === session.user.id) {
    await clearUserSession(event)
  }

  return { ok: true }
})
