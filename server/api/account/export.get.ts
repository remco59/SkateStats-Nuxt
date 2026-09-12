import { useDb } from '../../db/client'
import { exportUserData } from '../../utils/backup'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const payload = exportUserData(useDb(), session.user.id)

  setHeader(event, 'Content-Type', 'application/json')
  setHeader(
    event,
    'Content-Disposition',
    `attachment; filename="skatestats-backup-${new Date().toISOString().slice(0, 10)}.json"`,
  )
  return payload
})
