import { z } from 'zod'
import { useDb } from '../../../db/client'
import { requireValidSession } from '../../../utils/access'
import { extractSsrResultsForSkater, ssrLookupSkaterId } from '../../../utils/import/ssr'
import { ssrResultsToImportPayload } from '../../../utils/import/ssr-source'
import { classifyImportPayload, savePreviewBatch } from '../../../utils/import/pipeline'

const bodySchema = z
  .object({
    // A known SSR skater id skips the name lookup.
    skaterId: z.string().trim().optional(),
    givenName: z.string().trim().optional(),
    familyName: z.string().trim().optional(),
    season: z.string().regex(/^\d{4}$/),
  })
  .refine((b) => b.skaterId || (b.givenName && b.familyName), {
    message: 'Vul een voor- en achternaam of een Skater ID in.',
  })

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const { skaterId, givenName, familyName, season } = await readValidatedBody(event, bodySchema.parse)

  try {
    const id = skaterId || (await ssrLookupSkaterId(givenName!, familyName!)).id
    const parsed = await extractSsrResultsForSkater(id, season)
    const db = useDb()
    const preview = classifyImportPayload(db, session.user.id, ssrResultsToImportPayload(parsed))
    const batchId = savePreviewBatch(db, session.user.id, preview)
    return { status: 'ok', batchId }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
