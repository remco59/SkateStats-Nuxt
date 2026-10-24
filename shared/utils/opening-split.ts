/**
 * Typical long-track opening split distance (port of the old app's
 * opening_split_m). Lives in shared/ so the browser-side target split plan
 * and the server-side split maths can never disagree about it.
 */
export function openingSplitM(distanceM: number): number {
  if (distanceM === 500) return 100
  if (distanceM === 1500) return 300
  if (distanceM === 100) return 100
  return 200
}
