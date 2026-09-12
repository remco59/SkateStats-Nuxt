import { useDb } from '../../db/client'
import { backupPayloadSchema, importUserData } from '../../utils/backup'

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
    const result = importUserData(useDb(), session.user.id, parsed.data)
    return { status: 'ok', ...result }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
