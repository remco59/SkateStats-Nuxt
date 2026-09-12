import { z } from 'zod'
import { useDb } from '../../../db/client'
import { requireValidSession } from '../../../utils/access'
import { extractSsrResultsForSkater, ssrLookupSkaterId } from '../../../utils/import/ssr'
import { ssrResultsToImportPayload } from '../../../utils/import/ssr-source'
import { classifyImportPayload, savePreviewBatch } from '../../../utils/import/pipeline'

const bodySchema = z.object({
  givenName: z.string().min(1),
  familyName: z.string().min(1),
  season: z.string().regex(/^\d{4}$/),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const { givenName, familyName, season } = await readValidatedBody(event, bodySchema.parse)

  try {
    const skater = await ssrLookupSkaterId(givenName, familyName)
    const parsed = await extractSsrResultsForSkater(skater.id, season)
    const db = useDb()
    const preview = classifyImportPayload(db, session.user.id, ssrResultsToImportPayload(parsed))
    const batchId = savePreviewBatch(db, session.user.id, preview)
    return { status: 'ok', batchId }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
