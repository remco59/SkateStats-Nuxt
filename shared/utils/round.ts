/**
 * Python 3's built-in `round()` uses round-half-to-even ("banker's
 * rounding"); JavaScript's `Math.round()` always rounds half away from
 * zero (for positive numbers, half up). These agree everywhere except
 * exact .5 ties, which DO occur in this codebase's ports -- e.g. averaging
 * two integer millisecond values lands exactly on a half whenever their
 * sum is odd. Discovered via a golden-fixture mismatch (stats_engine's
 * Alkmaar 500m-equivalent average: 42816 in the old app, 42817 with plain
 * Math.round). Any TS port of an old-app function that calls Python's
 * round() should use this instead of Math.round() to stay byte-for-byte
 * compatible, per REBUILD_PLAN.md's reproduce-old-behavior-deliberately
 * stance. Not every Math.round() in this codebase has been audited for
 * this -- treat a future golden-fixture off-by-one near a .5 average as
 * this same class of bug, not a new one.
 */
export function pythonRound(value: number): number {
  const floor = Math.floor(value)
  const diff = value - floor
  if (diff < 0.5) return floor
  if (diff > 0.5) return floor + 1
  // Exact tie: round to even.
  return floor % 2 === 0 ? floor : floor + 1
}
