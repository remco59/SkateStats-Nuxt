import { useDb } from '../../db/client'
import { requireValidSession } from '../../utils/access'
import { detectOstaUpdatesForUser } from '../../utils/osta-monitor'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  return detectOstaUpdatesForUser(useDb(), session.user.id)
})
