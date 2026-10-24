import { z } from 'zod'
import { useDb } from '../../../db/client'
import { requireValidSession } from '../../../utils/access'
import { defaultOstaSearchName, ostaLookupPid, OstaMultipleMatchesError, type OstaCandidate } from '../../../utils/import/osta'
import { createOstaPreview } from '../../../utils/import/osta-import'
import { ostaSeasonSchema } from '../../../utils/osta-season'

const bodySchema = z.object({
  // Blank falls back to the account's skater name, like the old import form.
  searchName: z.string().trim().optional(),
  season: ostaSeasonSchema,
  // Known PID: skip the name search altogether.
  pid: z.string().trim().optional(),
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
  const body = await readValidatedBody(event, bodySchema.parse)
  const { season } = body
  const searchName = body.searchName || defaultOstaSearchName(session.user.skaterName)
  if (!searchName && !body.pid) throw createError({ statusCode: 400, statusMessage: 'Vul een naam of PID in.' })

  let pid = body.pid ?? ''
  if (!pid) {
    try {
      pid = (await ostaLookupPid(searchName)).pid
    } catch (err) {
      if (err instanceof OstaMultipleMatchesError) {
        return { status: 'multiple_matches', candidates: err.candidates, searchName, season }
      }
      throw createError({ statusCode: 400, statusMessage: (err as Error).message })
    }
  }

  try {
    const batchId = await createOstaPreview(useDb(), session.user.id, { searchName, season, pids: [pid] })
    return { status: 'ok', batchId }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
