import { pythonRound } from '../../shared/utils/round'

/**
 * Split/pace math ported 1:1 from app/main.py (old app, commit 4dc6959):
 * opening_split_m, segment_distances, per400_times, build_split_rows,
 * compute_race_metrics.
 *
 * KNOWN QUIRK (see REBUILD_PLAN.md section 5.1 and
 * reference/fixtures/calculations/golden_calculations.json): when the lap
 * count doesn't evenly divide the remaining distance into 400m segments,
 * the leftover distance is dumped into the final segment, but its raw lap
 * TIME is still normalized as if it were run at that inflated distance --
 * producing an implausibly fast '400m-equivalent' for the last split (e.g.
 * a 3000m race with 7 laps gets an 800m final segment whose 34.2s lap
 * normalizes to 17.1s). This port REPRODUCES that behavior exactly
 * (byte-for-byte parity with the old app), per the Phase 2 decision -- see
 * the PR that ports this file for the rationale. Fixing it is a separate,
 * deliberate follow-up, not bundled into this port.
 */

export function openingSplitM(distanceM: number): number {
  if (distanceM === 500) return 100;
  if (distanceM === 1500) return 300;
  if (distanceM === 100) return 100;
  return 200;
}

export function segmentDistances(
  distanceM: number,
  nSegments: number,
): number[] {
  if (nSegments <= 0) return [];

  const first = Math.min(openingSplitM(distanceM), distanceM);
  if (nSegments === 1) return [distanceM];

  const remainingDist = Math.max(distanceM - first, 0);
  const remainingSegments = nSegments - 1;

  const segs = [first];
  if (remainingSegments === 1) {
    segs.push(remainingDist);
    return segs;
  }

  const DEFAULT_SEGMENT = 400;
  for (let i = 0; i < remainingSegments - 1; i++) {
    segs.push(DEFAULT_SEGMENT);
  }

  const last = remainingDist - DEFAULT_SEGMENT * (remainingSegments - 1);
  if (last <= 0) {
    // fallback: distribute evenly
    const even = Math.max(pythonRound(remainingDist / remainingSegments), 1);
    const evenSegs = [first, ...Array(remainingSegments).fill(even)];
    evenSegs[evenSegs.length - 1] += remainingDist - even * remainingSegments;
    return evenSegs;
  }

  segs.push(last);
  return segs;
}

/** Normalize each split to a 400m-equivalent time. */
export function per400Times(laps: number[], distanceM: number): number[] {
  const segM = segmentDistances(distanceM, laps.length);
  const out: number[] = [];
  for (let i = 0; i < laps.length; i++) {
    const m = segM[i];
    const lap = laps[i];
    if (m === undefined || m <= 0 || lap === undefined) continue;
    out.push((lap * 400) / m);
  }
  return out;
}

export interface SplitRow {
  index: number;
  distanceM: number | null;
  seconds: number;
  per400Eq: number | null;
  deltaPrev400Eq: number | null;
}

export function buildSplitRows(laps: number[], distanceM: number): SplitRow[] {
  const segmentM = segmentDistances(distanceM, laps.length);
  const per400 = per400Times(laps, distanceM);
  const rows: SplitRow[] = [];
  let previous400: number | null = null;

  for (let idx = 0; idx < laps.length; idx++) {
    const lap = laps[idx];
    if (lap === undefined) continue;
    const normalized = idx < per400.length ? (per400[idx] ?? null) : null;
    let deltaPrev: number | null = null;
    if (normalized !== null && previous400 !== null) {
      deltaPrev = normalized - previous400;
    }
    rows.push({
      index: idx + 1,
      distanceM: idx < segmentM.length ? (segmentM[idx] ?? null) : null,
      seconds: lap,
      per400Eq: normalized,
      deltaPrev400Eq: deltaPrev,
    });
    if (normalized !== null) previous400 = normalized;
  }

  return rows;
}

export interface RaceMetrics {
  segmentCount: number;
  openingM: number;
  avg400: number | null;
  first400Eq: number | null;
  last400Eq: number | null;
  fade400Eq: number | null;
  avgFadePerSegment400Eq: number | null;
}

/** Metrics based on 400m-equivalent splits (fair across 500m/1500m openings). */
export function computeRaceMetrics(
  laps: number[],
  distanceM: number,
): RaceMetrics {
  const empty: RaceMetrics = {
    segmentCount: 0,
    openingM: openingSplitM(distanceM),
    avg400: null,
    first400Eq: null,
    last400Eq: null,
    fade400Eq: null,
    avgFadePerSegment400Eq: null,
  };
  if (!laps.length) return empty;

  const p400 = per400Times(laps, distanceM);
  if (!p400.length) {
    return { ...empty, segmentCount: laps.length };
  }

  const roundSegments = p400.length > 1 ? p400.slice(1) : [];
  const avg400 = roundSegments.length
    ? roundSegments.reduce((a, b) => a + b, 0) / roundSegments.length
    : null;
  const first = p400[0] as number;
  const last = p400[p400.length - 1] as number;
  const fade = last - first;
  const avgFadePerSegment = p400.length > 1 ? fade / (p400.length - 1) : 0.0;

  return {
    segmentCount: laps.length,
    openingM: openingSplitM(distanceM),
    avg400,
    first400Eq: first,
    last400Eq: last,
    fade400Eq: fade,
    avgFadePerSegment400Eq: avgFadePerSegment,
  };
}
