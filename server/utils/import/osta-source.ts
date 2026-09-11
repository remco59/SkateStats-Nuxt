import type { OstaParsedResults } from './osta'
import type { ParsedImportPayload } from './pipeline'

/** Converts OSTA's parsed shape into the generic import pipeline's payload shape. */
export function ostaResultsToImportPayload(parsed: OstaParsedResults): ParsedImportPayload {
  return {
    source: 'osta',
    competitions: parsed.competitions.map((c) => ({
      name: c.name,
      venue: c.venue,
      date: c.date,
      sourceRef: `https://www.osta.nl/index.php?pid=${encodeURIComponent(c.sourcePid)}`,
      results: c.results.map((r) => ({
        distanceM: r.distanceM,
        totalTimeMs: r.totalTimeMs,
        status: 'finished',
        lane: null,
        opponent: null,
        lapsMs: r.lapsCsv ? r.lapsCsv.split(',').map((v) => Math.round(Number.parseFloat(v) * 1000)) : null,
        notes: `Geimporteerd van OSTA: ${r.sourceRef}`,
        sourceRef: r.sourceRef,
      })),
    })),
  }
}
