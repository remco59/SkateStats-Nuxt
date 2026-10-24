<script setup lang="ts">
import { buildTargetSplitPlan, rebalanceTargetSplits, type PlanRow } from '#shared/utils/split-plan'
import { parseTimeInput } from '#shared/utils/time-input'

// "Live split-simulatie": the target time spread over the race's segments.
// Change one split and the splits after it rebalance so the total stays on
// target; change the LAST split and the total itself moves. Nothing here is
// saved -- it is a what-if tool (as in the old app).
const props = defineProps<{
  distanceM: number
  targetTimeMs: number
  openingMs: number | null
  avg400Ms: number | null
  last400Ms: number | null
}>()

const rows = ref<PlanRow[]>([])
const total = ref(props.targetTimeMs)
const fields = ref<string[]>([])
const inputEls: HTMLInputElement[] = []

function reset() {
  rows.value = buildTargetSplitPlan(
    props.distanceM,
    props.targetTimeMs,
    props.openingMs,
    props.avg400Ms,
    props.last400Ms,
  )
  total.value = props.targetTimeMs
  fields.value = rows.value.map((r) => fmtMs(r.splitMs))
}

watch(() => [props.distanceM, props.targetTimeMs, props.openingMs, props.avg400Ms, props.last400Ms], reset, {
  immediate: true,
})

function onChange(index: number) {
  const parsed = parseTimeInput(fields.value[index])
  if (!parsed.ok || parsed.ms === null) {
    fields.value[index] = fmtMs(rows.value[index]!.splitMs)
    return
  }
  const next = rows.value.map((r) => ({ ...r }))
  next[index]!.splitMs = parsed.ms
  const out = rebalanceTargetSplits(next, index, total.value)
  rows.value = out.rows
  total.value = out.totalTimeMs
  fields.value = out.rows.map((r) => fmtMs(r.splitMs))
}

function focusNext(index: number) {
  const next = inputEls[index + 1]
  next?.focus()
  next?.select()
}

const cumulative = computed(() => {
  let running = 0
  return rows.value.map((r) => (running += r.splitMs))
})
</script>

<template>
  <details class="sim">
    <summary class="sim-summary">Live split-simulatie</summary>
    <div class="overflow-x-auto mt-3">
      <table class="table">
        <thead>
          <tr>
            <th>#</th>
            <th>Afstand</th>
            <th class="num">Split</th>
            <th class="num">Cumulatief</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="row.index">
            <td class="text-meta">{{ row.index }}</td>
            <td class="text-meta">{{ row.distanceM }}m</td>
            <td class="num">
              <input
                :ref="(el) => { if (el) inputEls[i] = el as HTMLInputElement }"
                v-model="fields[i]"
                class="field sim-input font-mono"
                inputmode="decimal"
                :aria-label="`Split ${row.index} (${row.distanceM}m)`"
                @change="onChange(i)"
                @keydown.enter.prevent="focusNext(i)"
              >
            </td>
            <td class="num font-mono text-secondary">{{ fmtMs(cumulative[i]) }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" class="section-heading pt-3">Totaal</td>
            <td class="num font-mono font-semibold pt-3">{{ fmtMs(total) }}</td>
            <td class="num font-mono text-secondary pt-3">{{ fmtMs(cumulative[cumulative.length - 1]) }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <button type="button" class="btn btn-secondary btn-sm mt-3" @click="reset">Herstel</button>
  </details>
</template>

<style scoped>
.sim-summary {
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.sim-summary:hover {
  color: var(--color-text);
}

.sim-input {
  width: 6rem;
  min-height: 2rem;
  text-align: right;
}
</style>
