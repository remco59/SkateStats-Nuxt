import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { requireValidSession } from '../../../../utils/access'
import { commitPreviewBatch, deletePreviewBatch, loadPreviewBatch } from '../../../../utils/import/pipeline'

const bodySchema = z.object({
  updateChoices: z.record(z.string(), z.enum(['replace', 'keep_both', 'skip'])).optional().default({}),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const batchId = getRouterParam(event, 'batchId')!
  const { updateChoices } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const preview = loadPreviewBatch(db, session.user.id, batchId)
  if (!preview) throw createError({ statusCode: 404, statusMessage: 'Import batch niet gevonden of verlopen.' })

  const result = commitPreviewBatch(db, session.user.id, preview, updateChoices)
  deletePreviewBatch(db, session.user.id, batchId)

  return result
})
