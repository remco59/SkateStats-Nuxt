import { eq } from 'drizzle-orm'
import { useDb } from '../../db/client'
import { users } from '../../db/schema'
import { backupPayloadSchema, importUserData } from '../../utils/backup'
import { toSessionUser } from '../../utils/session-user'

const MAX_BACKUP_UPLOAD_BYTES = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const form = await readMultipartFormData(event)
  if (!form) throw createError({ statusCode: 400, statusMessage: 'Geen bestand ontvangen.' })

  const fileEntry = form.find((f) => f.name === 'file')
  if (!fileEntry?.data) throw createError({ statusCode: 400, statusMessage: 'Geen backupbestand ontvangen.' })
  if (fileEntry.data.byteLength > MAX_BACKUP_UPLOAD_BYTES) {
    throw createError({ statusCode: 400, statusMessage: 'Backupbestand is te groot (max 20MB).' })
  }

  let json: unknown
  try {
    json = JSON.parse(fileEntry.data.toString('utf-8'))
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Backupbestand is geen geldige JSON.' })
  }

  const parsed = backupPayloadSchema.safeParse(json)
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: 'Backupbestand heeft een ongeldig formaat.' })
  }

  try {
    const db = useDb()
    const result = importUserData(db, session.user.id, parsed.data)
    // A backup can carry the theme/motion preferences; the session holds a
    // copy of them, so refresh it or the old look sticks until next login.
    const updated = db.select().from(users).where(eq(users.id, session.user.id)).get()
    if (updated) await replaceUserSession(event, { user: toSessionUser(updated) })
    return { status: 'ok', ...result }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
