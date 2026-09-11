import { z } from 'zod'
import { useDb } from '../../../db/client'
import { requireValidSession } from '../../../utils/access'
import { extractOstaResultsForPid, ostaLookupPid, OstaMultipleMatchesError, type OstaCandidate } from '../../../utils/import/osta'
import { ostaResultsToImportPayload } from '../../../utils/import/osta-source'
import { classifyImportPayload, savePreviewBatch } from '../../../utils/import/pipeline'

const bodySchema = z.object({
  searchName: z.string().min(1),
  season: z.string().regex(/^\d{4}$/),
})

interface OstaSearchResult {
  status: 'multiple_matches' | 'ok'
  candidates?: OstaCandidate[]
  searchName?: string
  season?: string
  batchId?: string
}

export default defineEventHandler(async (event): Promise<OstaSearchResult> => {
  const session = await requireValidSession(event)
  const { searchName, season } = await readValidatedBody(event, bodySchema.parse)

  let pid: string
  try {
    const found = await ostaLookupPid(searchName)
    pid = found.pid
  } catch (err) {
    if (err instanceof OstaMultipleMatchesError) {
      return { status: 'multiple_matches', candidates: err.candidates, searchName, season }
    }
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }

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
