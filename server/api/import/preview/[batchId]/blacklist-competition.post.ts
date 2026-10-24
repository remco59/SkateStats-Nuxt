import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { requireValidSession } from '../../../../utils/access'
import {
  addCompetitionToBlacklist,
  loadPreviewBatch,
  updatePreviewBatch,
  withCompetitionBlacklisted,
} from '../../../../utils/import/pipeline'

const bodySchema = z.object({ competitionSignature: z.string().min(1) })

/** "Ignore this competition" from the import preview -- blacklists it so it isn't suggested again. */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const batchId = getRouterParam(event, 'batchId')!
  const { competitionSignature } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const preview = loadPreviewBatch(db, session.user.id, batchId)
  if (!preview) throw createError({ statusCode: 404, statusMessage: 'Import batch niet gevonden of verlopen.' })

  const item = preview.items.find((i) => i.competitionSignature === competitionSignature)
  if (!item) throw createError({ statusCode: 404, statusMessage: 'Wedstrijd niet gevonden in deze batch.' })

  addCompetitionToBlacklist(db, session.user.id, item)
  // Also mark it in the stored batch: otherwise committing that same batch
  // afterwards (e.g. the dashboard's "importeer alles") would import the very
  // competition that was just ignored.
  updatePreviewBatch(db, session.user.id, batchId, withCompetitionBlacklisted(preview, competitionSignature))
  return { ok: true }
})
