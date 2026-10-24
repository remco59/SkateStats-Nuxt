import { z } from 'zod'
import { useDb } from '../../../db/client'
import { requireValidSession } from '../../../utils/access'
import { defaultOstaSearchName } from '../../../utils/import/osta'
import { createOstaPreview } from '../../../utils/import/osta-import'
import { ostaSeasonSchema } from '../../../utils/osta-season'

const bodySchema = z
  .object({
    searchName: z.string().trim().optional(),
    season: ostaSeasonSchema,
    pids: z.array(z.string()).optional(),
    /** One profile; kept so older callers keep working. */
    pid: z.string().optional(),
  })
  .transform((b) => ({ ...b, pids: [...(b.pids ?? []), ...(b.pid ? [b.pid] : [])].map((p) => p.trim()).filter(Boolean) }))

/** Import from one or several chosen OSTA profiles; their results are merged into one preview. */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const body = await readValidatedBody(event, bodySchema.parse)
  if (!body.pids.length) throw createError({ statusCode: 400, statusMessage: 'Selecteer minimaal een OSTA-profiel.' })

  try {
    const batchId = await createOstaPreview(useDb(), session.user.id, {
      searchName: body.searchName || defaultOstaSearchName(session.user.skaterName),
      season: body.season,
      pids: body.pids,
    })
    return { status: 'ok', batchId }
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: (err as Error).message })
  }
})
