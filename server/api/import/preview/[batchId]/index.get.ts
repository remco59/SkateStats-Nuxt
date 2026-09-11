import { useDb } from '../../../../db/client'
import { requireValidSession } from '../../../../utils/access'
import { loadPreviewBatch } from '../../../../utils/import/pipeline'

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const batchId = getRouterParam(event, 'batchId')!

  const preview = loadPreviewBatch(useDb(), session.user.id, batchId)
  if (!preview) throw createError({ statusCode: 404, statusMessage: 'Import batch niet gevonden of verlopen.' })

  return preview
})
