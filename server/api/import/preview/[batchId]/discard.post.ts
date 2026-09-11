import { useDb } from '../../../../db/client'
import { requireValidSession } from '../../../../utils/access'
import { deletePreviewBatch } from '../../../../utils/import/pipeline'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const batchId = getRouterParam(event, 'batchId')!

  deletePreviewBatch(useDb(), session.user.id, batchId)
  return { ok: true }
})
