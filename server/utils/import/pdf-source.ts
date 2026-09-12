import type { PdfParsedCompetition } from './pdf'
import type { ParsedImportPayload } from './pipeline'

export function pdfResultsToImportPayload(competitions: PdfParsedCompetition[]): ParsedImportPayload {
  return {
    source: 'pdf',
    competitions: competitions.map((c) => ({
      name: c.name,
      venue: c.venue,
      date: c.date,
      sourceRef: null,
      results: c.results.map((r) => ({
        distanceM: r.distanceM,
        totalTimeMs: r.totalTimeMs,
        status: r.status,
        lane: r.lane,
        opponent: r.opponent || null,
        lapsMs: r.lapsMs,
        notes: r.notes,
        sourceRef: null,
      })),
    })),
  }
}
