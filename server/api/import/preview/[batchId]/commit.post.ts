import { z } from 'zod'
import { useDb } from '../../../../db/client'
import { requireValidSession } from '../../../../utils/access'
import {
  commitPreviewBatch,
  deletePreviewBatch,
  loadPreviewBatch,
  releaseBlacklistedSelection,
} from '../../../../utils/import/pipeline'

const bodySchema = z.object({
  updateChoices: z.record(z.string(), z.enum(['replace', 'keep_both', 'skip'])).optional().default({}),
  /** The races ticked in the preview. Omitted = every new race. */
  selectedRaceKeys: z.array(z.string()).optional(),
  /** "Toevoegen als nieuwe wedstrijd" instead of matching existing competitions. */
  forceNewCompetition: z.boolean().optional().default(false),
})

export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const batchId = getRouterParam(event, 'batchId')!
  const { updateChoices, selectedRaceKeys, forceNewCompetition } = await readValidatedBody(event, bodySchema.parse)

  const db = useDb()
  const loaded = loadPreviewBatch(db, session.user.id, batchId)
  if (!loaded) throw createError({ statusCode: 404, statusMessage: 'Import batch niet gevonden of verlopen.' })

  const selected = selectedRaceKeys ? new Set(selectedRaceKeys) : undefined
  const choosesCorrections = Object.values(updateChoices).some((c) => c !== 'skip')
  if (selected && !selected.size && !choosesCorrections) {
    throw createError({ statusCode: 400, statusMessage: 'Selecteer minimaal één rit om te importeren.' })
  }

  // Ticking an ignored competition/race lifts the ignore (as the old app did).
  const preview = selected ? releaseBlacklistedSelection(db, session.user.id, loaded, selected) : loaded

  const result = commitPreviewBatch(db, session.user.id, preview, updateChoices, {
    selectedRaceKeys: selected,
    forceNewCompetition,
  })
  deletePreviewBatch(db, session.user.id, batchId)

  return result
})
