import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { ostaProfileLinks } from '../db/schema'
import { extractOstaResultsForPid } from './import/osta'
import { ostaResultsToImportPayload } from './import/osta-source'
import {
  classifyImportPayload,
  commitPreviewBatch,
  deleteMonitorBatches,
  savePreviewBatch,
  type ParsedImportPayload,
} from './import/pipeline'

/** One competition with data that is not in the user's results yet. */
export interface AvailableCompetition {
  competitionSignature: string
  name: string
  date: string
  venue: string | null
  /** Races in it that are new (not already stored, not ignored). */
  newRaceCount: number
  /** False when the competition exists and only some races are new. */
  isNewCompetition: boolean
}

export interface OstaDetectionResult {
  checked: number
  hasNew: boolean
  newCompetitionsCount: number
  newRacesCount: number
  /** The stored preview holding `available`; import it or ignore items in it. */
  batchId: string | null
  available: AvailableCompetition[]
  /** What profiles set to "automatisch importeren" brought in during this check. */
  autoImported: { competitions: number; races: number } | null
  errors: { pid: string; message: string }[]
}

// OSTA answers an empty season with this; for a monitor that is "nothing new
// yet", not a failure worth showing.
const NO_RESULTS_PREFIX = 'Geen OSTA ritten gevonden'

/**
 * Checks every linked OSTA profile (monitorMode != 'off') for competitions/
 * races not yet in the user's data and not blacklisted, per plan section 8.
 * Reuses the import pipeline's classification directly, so "new data" means
 * exactly what it means during a manual import.
 *
 * Profiles set to `notify` are merged into ONE stored preview (one banner,
 * one `/import/preview` visit); profiles set to `auto_import` are imported
 * right away -- only data that is new: anything that would change an
 * existing race is left for a manual import.
 */
export async function detectOstaUpdatesForUser(db: Db, userId: number): Promise<OstaDetectionResult> {
  const links = db
    .select()
    .from(ostaProfileLinks)
    .where(eq(ostaProfileLinks.userId, userId))
    .all()
    .filter((l) => l.monitorMode !== 'off')

  const errors: { pid: string; message: string }[] = []
  const notifyPayload: ParsedImportPayload = { source: 'osta', competitions: [] }
  const autoPayload: ParsedImportPayload = { source: 'osta', competitions: [] }

  for (const link of links) {
    try {
      const parsed = await extractOstaResultsForPid(link.searchName, link.season, link.pid)
      const payload = ostaResultsToImportPayload(parsed)
      ;(link.monitorMode === 'auto_import' ? autoPayload : notifyPayload).competitions.push(...payload.competitions)
    } catch (err) {
      const message = (err as Error).message
      if (!message.startsWith(NO_RESULTS_PREFIX)) errors.push({ pid: link.pid, message })
    }
    db.update(ostaProfileLinks)
      .set({ lastCheckedAt: new Date().toISOString() })
      .where(eq(ostaProfileLinks.id, link.id))
      .run()
  }

  let autoImported: OstaDetectionResult['autoImported'] = null
  if (autoPayload.competitions.length) {
    const result = commitPreviewBatch(db, userId, classifyImportPayload(db, userId, autoPayload))
    if (result.importedCompetitions || result.importedRaces) {
      autoImported = { competitions: result.importedCompetitions, races: result.importedRaces }
    }
  }

  // A fresh check replaces the previous "new data" batch.
  deleteMonitorBatches(db, userId)

  const available: AvailableCompetition[] = []
  let batchId: string | null = null
  if (notifyPayload.competitions.length) {
    const preview = classifyImportPayload(db, userId, notifyPayload)
    for (const item of preview.items) {
      if (item.action === 'blacklisted') continue
      const newRaceCount = item.races.filter((r) => r.action === 'new').length
      if (newRaceCount === 0) continue
      available.push({
        competitionSignature: item.competitionSignature,
        name: item.competition.name,
        date: item.competition.date,
        venue: item.competition.venue,
        newRaceCount,
        isNewCompetition: item.action === 'new_competition',
      })
    }
    if (available.length) batchId = savePreviewBatch(db, userId, { ...preview, origin: 'monitor' })
  }

  return {
    checked: links.length,
    hasNew: available.length > 0,
    newCompetitionsCount: available.filter((a) => a.isNewCompetition).length,
    newRacesCount: available.reduce((sum, a) => sum + a.newRaceCount, 0),
    batchId,
    available,
    autoImported,
    errors,
  }
}
