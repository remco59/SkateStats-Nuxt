import { z } from 'zod'
import { requireValidSession } from '../../../utils/access'
import { listUserRacesChronological, buildUserProfiles } from '../../../utils/target-service'
import { generateSplitTargets } from '../../../utils/targets'

const bodySchema = z.object({
  distanceM: z.number().int().positive(),
  targetTimeMs: z.number().int().positive(),
})

/**
 * "Genereer targets": turns a target time into opening / average lap / last
 * lap / fade, using the skater's own recent races on that distance (or the
 * per-distance default pacing when there is no lap history yet). Kept on the
 * server so there is exactly one implementation of the maths.
 */
export default defineEventHandler(async (event) => {
  const session = await requireValidSession(event)
  const { distanceM, targetTimeMs } = await readValidatedBody(event, bodySchema.parse)

  const profile = buildUserProfiles(listUserRacesChronological(session.user.id)).get(distanceM) ?? null
  const generated = generateSplitTargets(distanceM, targetTimeMs, profile)

  return {
    splits: {
      openingMs: generated.targetOpeningMs,
      avg400Ms: generated.targetAvg400Ms,
      last400Ms: generated.targetLast400Ms,
      fade400Ms: generated.targetFade400Ms,
    },
    sampleSize: profile?.sampleSize ?? null,
  }
})
