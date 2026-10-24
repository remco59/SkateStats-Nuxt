import { openingSplitM } from './opening-split'

/**
 * Target split plan: how a target time is spread over the segments of a
 * race, and how editing one split rebalances the ones after it. Ported 1:1
 * from the old app's goals.html (buildTargetSplitPlan /
 * rebalanceTargetSplits / segmentDistancesForTarget) and pinned by
 * reference/fixtures/calculations/golden_targets.json, which was produced
 * by running that original JavaScript. Pure functions, used by the browser
 * (live editing) and by the unit tests.
 */

export interface PlanRow {
  index: number
  distanceM: number
  splitMs: number
}

/** Opening segment, then 400 m segments, the last one taking the remainder. */
export function planSegments(distanceM: number): number[] {
  if (!distanceM) return []
  const first = Math.min(openingSplitM(distanceM), distanceM)
  if (distanceM <= first) return [distanceM]
  const segments = [first]
  let remaining = Math.max(distanceM - first, 0)
  while (remaining > 0) {
    const segment = Math.min(400, remaining)
    segments.push(segment)
    remaining -= segment
  }
  return segments
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

/**
 * Spreads `targetTimeMs` over the segments. The opening takes `openingMs`
 * when given (else its share of the distance); the rest follow a straight
 * line from a first to a last 400 m-equivalent so that their average is
 * `avgRoundMs` and the final one is `lastRoundMs`. Whatever rounding leaves
 * over is absorbed by the final segment so the total always equals the target.
 */
export function buildTargetSplitPlan(
  distanceM: number,
  targetTimeMs: number,
  openingMs: number | null,
  avgRoundMs: number | null,
  lastRoundMs: number | null,
): PlanRow[] {
  const segments = planSegments(distanceM)
  if (!targetTimeMs || !segments.length) return []
  if (segments.length === 1) return [{ index: 1, distanceM: segments[0]!, splitMs: targetTimeMs }]

  const opening = openingMs ?? Math.round((targetTimeMs * segments[0]!) / distanceM)
  const remainingSegments = segments.slice(1)
  const remainingTargetMs = Math.max(targetTimeMs - opening, 0)
  let remainingSplits: number[]

  if (remainingSegments.length === 1) {
    remainingSplits = [remainingTargetMs]
  } else {
    const avgRound = avgRoundMs ?? Math.round((remainingTargetMs * 400) / sum(remainingSegments))
    const lastRound = lastRoundMs ?? avgRound
    const firstRound = 2 * avgRound - lastRound
    const eqValues = remainingSegments.map(
      (_, i) => firstRound + ((lastRound - firstRound) * i) / (remainingSegments.length - 1),
    )
    remainingSplits = eqValues.map((eq, i) => Math.max(Math.round((eq * remainingSegments[i]!) / 400), 0))
    const usedBeforeLast = sum(remainingSplits.slice(0, -1))
    remainingSplits[remainingSplits.length - 1] = Math.max(remainingTargetMs - usedBeforeLast, 0)
  }

  const splitMs = [opening, ...remainingSplits]
  splitMs[splitMs.length - 1] = Math.max(targetTimeMs - sum(splitMs.slice(0, -1)), 0)

  return segments.map((segmentM, i) => ({ index: i + 1, distanceM: segmentM, splitMs: splitMs[i] || 0 }))
}

/**
 * After the split at `editedIndex` was changed: cap it so the earlier splits
 * plus this one never exceed the target, then redistribute the time that is
 * left over the later splits in proportion to what they were. Editing the
 * LAST split instead changes the total. Returns new rows; does not mutate.
 */
export function rebalanceTargetSplits(
  inputRows: PlanRow[],
  editedIndex: number,
  targetTimeMs: number,
): { rows: PlanRow[]; totalTimeMs: number } {
  const rows = inputRows.map((r) => ({ ...r }))
  const edited = rows[editedIndex]
  if (!edited) return { rows, totalTimeMs: targetTimeMs }

  const previousTotal = sum(rows.slice(0, editedIndex).map((r) => r.splitMs))

  if (editedIndex === rows.length - 1) {
    edited.splitMs = Math.max(edited.splitMs, 0)
    return { rows, totalTimeMs: sum(rows.map((r) => r.splitMs)) }
  }

  const maxAllowed = Math.max(targetTimeMs - previousTotal, 0)
  edited.splitMs = Math.min(edited.splitMs, maxAllowed)

  const lockedTotal = sum(rows.slice(0, editedIndex + 1).map((r) => r.splitMs))
  const remainingRows = rows.slice(editedIndex + 1)
  const remainingTargetMs = Math.max(targetTimeMs - lockedTotal, 0)

  if (!remainingRows.length) {
    edited.splitMs = Math.max(targetTimeMs - previousTotal, 0)
    return { rows, totalTimeMs: targetTimeMs }
  }

  const baseTotal = sum(remainingRows.map((r) => r.splitMs))
  if (baseTotal <= 0) {
    const even = Math.floor(remainingTargetMs / remainingRows.length)
    remainingRows.forEach((row, i) => {
      row.splitMs = i === remainingRows.length - 1 ? Math.max(remainingTargetMs - even * (remainingRows.length - 1), 0) : even
    })
    return { rows, totalTimeMs: targetTimeMs }
  }

  let distributed = 0
  remainingRows.forEach((row, i) => {
    if (i === remainingRows.length - 1) {
      row.splitMs = Math.max(remainingTargetMs - distributed, 0)
      return
    }
    row.splitMs = Math.max(Math.round((row.splitMs / baseTotal) * remainingTargetMs), 0)
    distributed += row.splitMs
  })
  return { rows, totalTimeMs: targetTimeMs }
}
