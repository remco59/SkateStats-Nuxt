import { useDb } from '../../db/client'
import { requireValidSession } from '../../utils/access'
import { detectOstaUpdatesForUser } from '../../utils/osta-monitor'

/**
 * POST because a check has side effects: it fetches from OSTA, imports for
 * profiles set to "automatisch importeren", and replaces the user's stored
 * "new data" batch. The dashboard calls it once per visit.
 */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  return detectOstaUpdatesForUser(useDb(), session.user.id)
})
