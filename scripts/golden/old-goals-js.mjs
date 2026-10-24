// Runs the ORIGINAL split-plan JavaScript from the old app's goals.html
// (extracted verbatim, not re-typed) and prints JSON test cases to stdout.
// Called by targets.py; usage: node old-goals-js.mjs <path/to/goals.html>
import fs from 'node:fs'
import vm from 'node:vm'

const html = fs.readFileSync(process.argv[2], 'utf-8')

function extractFunction(name) {
  const start = html.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`function ${name} not found in goals.html`)
  let i = html.indexOf('{', start)
  let depth = 0
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++
    else if (html[i] === '}' && --depth === 0) return html.slice(start, i + 1)
  }
  throw new Error(`unbalanced braces in ${name}`)
}

const names = ['segmentDistancesForTarget', 'buildTargetSplitPlan', 'rebalanceTargetSplits']
const ctx = vm.createContext({})
vm.runInContext(names.map(extractFunction).join('\n'), ctx)
const old = Object.fromEntries(names.map((n) => [n, ctx[n]]))
const clone = (v) => JSON.parse(JSON.stringify(v))

const distances = [100, 300, 500, 1000, 1500, 3000, 5000, 10000]
const times = { 100: 9800, 300: 26500, 500: 40500, 1000: 81000, 1500: 126500, 3000: 270000, 5000: 460000, 10000: 960000 }

const segments = distances.map((d) => ({ distance_m: d, expected: clone(old.segmentDistancesForTarget(d)) }))

const plans = []
for (const d of distances) {
  const t = times[d]
  // A realistic average 400 m lap for this target, and plausible opening/last.
  const avg = Math.round((t * 400) / d)
  const variants = [
    { realistic: true, opening: null, avg: null, last: null },
    { realistic: true, opening: Math.round(t * (d === 100 ? 1 : d <= 500 ? 0.26 : 0.9 * (200 / d) + 0.1 * 0)), avg, last: Math.round(avg * 0.98) },
    { realistic: true, opening: null, avg, last: null },
    { realistic: true, opening: null, avg: null, last: Math.round(avg * 1.02) },
    // Inputs that cannot add up to the target: parity with the old
    // behaviour only, the "sums to the target" invariant does not apply.
    { realistic: false, opening: Math.round(t * 0.2), avg: Math.round(t / 4), last: Math.round(t / 3.6) },
  ]
  for (const v of variants) {
    plans.push({
      distance_m: d,
      target_time_ms: t,
      realistic: v.realistic,
      opening_ms: v.opening,
      avg_round_ms: v.avg,
      last_round_ms: v.last,
      expected: clone(old.buildTargetSplitPlan(d, t, v.opening, v.avg, v.last)),
    })
  }
}
plans.push({ distance_m: 1500, target_time_ms: 0, realistic: false, opening_ms: null, avg_round_ms: null, last_round_ms: null, expected: clone(old.buildTargetSplitPlan(1500, 0, null, null, null)) })

const rebalances = []
function addRebalance(d, editedIndex, newSplitMs) {
  const t = times[d]
  const base = clone(old.buildTargetSplitPlan(d, t, null, null, null))
  const input = clone(base)
  input[editedIndex].splitMs = newSplitMs
  const out = old.rebalanceTargetSplits(clone(input), editedIndex, t)
  rebalances.push({
    distance_m: d,
    target_time_ms: t,
    edited_index: editedIndex,
    input_rows: input,
    expected_rows: clone(out.rows),
    expected_total_time_ms: out.totalTimeMs,
  })
}
const planLen = (d) => old.segmentDistancesForTarget(d).length
for (const d of [500, 1000, 1500, 3000]) {
  const t = times[d]
  const last = planLen(d) - 1
  addRebalance(d, 0, Math.round(t * 0.3)) // slower opening: later splits shrink
  addRebalance(d, 0, Math.round(t * 0.1)) // faster opening: later splits grow
  if (last > 1) addRebalance(d, 1, Math.round(t * 0.4))
  if (last > 1) addRebalance(d, last - 1, Math.round(t * 0.9)) // capped by the target
  addRebalance(d, last, Math.round(t * 0.4)) // last split edit changes the total
}
// Everything after the edited split is zero: spread evenly.
{
  const d = 1500
  const t = times[d]
  const input = clone(old.buildTargetSplitPlan(d, t, null, null, null)).map((r, i) => (i === 0 ? r : { ...r, splitMs: 0 }))
  const out = old.rebalanceTargetSplits(clone(input), 0, t)
  rebalances.push({ distance_m: d, target_time_ms: t, edited_index: 0, input_rows: input, expected_rows: clone(out.rows), expected_total_time_ms: out.totalTimeMs })
}

console.log(JSON.stringify({ segments, plans, rebalances }))
