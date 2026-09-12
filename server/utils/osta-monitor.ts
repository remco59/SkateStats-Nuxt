import { eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { ostaProfileLinks } from '../db/schema'
import { extractOstaResultsForPid } from './import/osta'
import { ostaResultsToImportPayload } from './import/osta-source'
import { classifyImportPayload, savePreviewBatch, type ParsedImportPayload } from './import/pipeline'

export interface OstaDetectionResult {
  checked: number
  hasNew: boolean
  newCompetitionsCount: number
  newRacesCount: number
  batchId: string | null
  errors: { pid: string; message: string }[]
}

/**
 * Checks every linked OSTA profile (monitorMode != 'off') for competitions/
 * races not yet in the user's data and not blacklisted, per plan section 8
 * (Phase 8: "OSTA monitor config... detection check on dashboard load").
 * Reuses the Phase 6/7 import pipeline's classification directly, so "new
 * data" here means exactly the same thing it means during a manual import.
 *
 * All linked profiles are merged into ONE preview batch (one banner, one
 * `/import/preview` visit) rather than one batch per profile.
 */
export async function detectOstaUpdatesForUser(db: Db, userId: number): Promise<OstaDetectionResult> {
  const links = db
    .select()
    .from(ostaProfileLinks)
    .where(eq(ostaProfileLinks.userId, userId))
    .all()
    .filter((l) => l.monitorMode !== 'off')

  const errors: { pid: string; message: string }[] = []
  const mergedPayload: ParsedImportPayload = { source: 'osta', competitions: [] }

  for (const link of links) {
    try {
      const parsed = await extractOstaResultsForPid(link.searchName, link.season, link.pid)
      const payload = ostaResultsToImportPayload(parsed)
      mergedPayload.competitions.push(...payload.competitions)
    } catch (err) {
      errors.push({ pid: link.pid, message: (err as Error).message })
    }
    db.update(ostaProfileLinks)
      .set({ lastCheckedAt: new Date().toISOString() })
      .where(eq(ostaProfileLinks.id, link.id))
      .run()
  }

  if (!mergedPayload.competitions.length) {
    return { checked: links.length, hasNew: false, newCompetitionsCount: 0, newRacesCount: 0, batchId: null, errors }
  }

  const preview = classifyImportPayload(db, userId, mergedPayload)
  let newCompetitionsCount = 0
  let newRacesCount = 0
  for (const item of preview.items) {
    if (item.action === 'new_competition') newCompetitionsCount += 1
    for (const raceItem of item.races) {
      if (raceItem.action === 'new') newRacesCount += 1
    }
  }

  if (newCompetitionsCount === 0 && newRacesCount === 0) {
    return { checked: links.length, hasNew: false, newCompetitionsCount: 0, newRacesCount: 0, batchId: null, errors }
  }

  const batchId = savePreviewBatch(db, userId, preview)
  return { checked: links.length, hasNew: true, newCompetitionsCount, newRacesCount, batchId, errors }
}
