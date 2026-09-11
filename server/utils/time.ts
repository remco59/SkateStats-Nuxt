import { pythonRound } from '../../shared/utils/round'

/**
 * Time parsing/formatting ported from app/main.py (old app, commit
 * 4dc6959): parse_laps_to_ms, fmt_ms, parse_time_to_ms.
 * Behavior is pinned by reference/fixtures/calculations/golden_calculations.json
 * -- see test/unit/time.test.ts.
 */

export interface ParsedLaps {
  lapsMs: number[];
  totalMs: number | null;
  error: string | null;
}

/**
 * Accepts '30.12,31.00,31.50' or tab/newline/semicolon/space separated
 * seconds per split. A single invalid split invalidates the WHOLE input
 * (all-or-nothing) -- this is deliberate old-app behavior, preserved.
 */
export function parseLapsToMs(lapsStr: string): ParsedLaps {
  if (!lapsStr.trim()) {
    return { lapsMs: [], totalMs: null, error: null };
  }

  const raw = lapsStr
    .replace(/;/g, ',')
    .replace(/\t/g, ',')
    .replace(/\r/g, ',')
    .replace(/\n/g, ',');
  const parts = raw.split(/[\s,]+/).filter((p) => p.trim().length > 0);
  const lapsMs: number[] = [];

  for (const p of parts) {
    const sec = Number(p);
    if (Number.isNaN(sec)) {
      return {
        lapsMs: [],
        totalMs: null,
        error: `Kon rondetijd niet lezen: ${p}`,
      };
    }
    if (!Number.isFinite(sec) || sec <= 0 || sec > 86_400) {
      return { lapsMs: [], totalMs: null, error: `Ongeldige rondetijd: ${p}` };
    }
    lapsMs.push(pythonRound(sec * 1000));
  }

  const totalMs = lapsMs.length ? lapsMs.reduce((a, b) => a + b, 0) : null;
  return { lapsMs, totalMs, error: null };
}

/** Parses 'mm:ss.hh' or 'ss.hh' into integer milliseconds. */
export function parseTimeToMs(t: string): number {
  const value = t.trim().replace(',', '.');
  const match = value.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
  if (!match) {
    throw new Error(`Ongeldige tijd: ${t}`);
  }
  const minutes = match[1] ? Number.parseInt(match[1], 10) : 0;
  const seconds = Number.parseFloat(match[2] ?? '0');
  return pythonRound((minutes * 60 + seconds) * 1000);
}
