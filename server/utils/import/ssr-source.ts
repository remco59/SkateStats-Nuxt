import type { SsrParsedResults } from './ssr'
import type { ParsedImportPayload } from './pipeline'

/**
 * Converts SSR's parsed shape into the generic import pipeline's payload
 * shape. SSR never provides lap times (lapsMs always null) -- see
 * server/utils/import/ssr.ts's module comment.
 */
export function ssrResultsToImportPayload(parsed: SsrParsedResults): ParsedImportPayload {
  return {
    source: 'ssr',
    competitions: parsed.competitions.map((c) => ({
      name: c.name,
      venue: c.venue,
      date: c.date,
      sourceRef: c.sourceRef,
      results: c.results.map((r) => ({
        distanceM: r.distanceM,
        totalTimeMs: r.totalTimeMs,
        status: r.status,
        lane: null,
        opponent: null,
        lapsMs: null,
        notes: r.sourceRef ? `Geimporteerd van SpeedSkatingResults: ${r.sourceRef}` : 'Geimporteerd van SpeedSkatingResults',
        sourceRef: r.sourceRef,
      })),
    })),
  }
}
