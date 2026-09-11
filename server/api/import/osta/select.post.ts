import { z } from 'zod'
import { useDb } from '../../../db/client'
import { requireValidSession } from '../../../utils/access'
import { extractOstaResultsForPid } from '../../../utils/import/osta'
import { ostaResultsToImportPayload } from '../../../utils/import/osta-source'
import { classifyImportPayload, savePreviewBatch } from '../../../utils/import/pipeline'

const bodySchema = z.object({
  searchName: z.string().min(1),
  season: z.string().regex(/^\d{4}$/),
  pid: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const { searchName, season, pid } = await readValidatedBody(event, bodySchema.parse)

  try {
    const parsed = await extractOstaResultsForPid(searchName, season, pid)
    const db = useDb()
    const preview = classifyImportPayload(db, session.user.id, ostaResultsToImportPayload(parsed))
    const batchId = savePreviewBatch(db, session.user.id, preview)
    return { status: 'ok', batchId }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
