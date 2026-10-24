<script setup lang="ts">
import { fmtDeltaMs } from '#shared/utils/delta'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const compareRaceId = computed(() => (route.query.compareRaceId ? String(route.query.compareRaceId) : ''))

const { data, error } = await useFetch(`/api/results/races/${id}/compare`, {
  query: { compareRaceId },
})

// ---- picking the race to compare with -------------------------------------
const pickerModal = ref<{ open: () => void; close: () => void }>()
const filterQuery = ref('')
const filterVenue = ref('')
const filterFrom = ref('')
const filterTo = ref('')

const venueOptions = computed(() =>
  [...new Set((data.value?.candidates ?? []).map((c) => c.venue).filter((v): v is string => !!v))].sort(),
)

const filteredCandidates = computed(() => {
  const q = filterQuery.value.trim().toLowerCase()
  return (data.value?.candidates ?? []).filter((c) => {
    if (q && !`${c.competitionName} ${c.venue ?? ''}`.toLowerCase().includes(q)) return false
    if (filterVenue.value && (c.venue ?? '') !== filterVenue.value) return false
    if (filterFrom.value && c.competitionDate < filterFrom.value) return false
    if (filterTo.value && c.competitionDate > filterTo.value) return false
    return true
  })
})

function resetFilters() {
  filterQuery.value = ''
  filterVenue.value = ''
  filterFrom.value = ''
  filterTo.value = ''
}

function pick(candidateId: number) {
  pickerModal.value?.close()
  router.push({ query: { compareRaceId: String(candidateId) } })
}

// Like the old page: nothing chosen yet but there is something to choose
// from -> open the picker straight away.
onMounted(() => {
  if (data.value?.candidates.length && !data.value.compareRace) pickerModal.value?.open()
})

// ---- presentation helpers --------------------------------------------------
const deltaClass = (ms: number | null) => (ms === null ? 'delta-neutral' : ms <= 0 ? 'delta-better' : 'delta-worse')

const comparison = computed(() => data.value?.comparison ?? null)

const deltaPoints = computed(() => (comparison.value?.splits ?? []).filter((s) => s.splitDeltaMs !== null))

const lapLabels = computed(() => (comparison.value?.splits ?? []).map((s) => String(s.index)))
const hasLaps = computed(() => (comparison.value?.splits ?? []).some((s) => s.baseSplit !== null || s.compareSplit !== null))

const highlights = computed(() => {
  const h = comparison.value?.highlights
  return h
    ? [
        { label: 'Tijdsverschil', value: h.totalDeltaMs },
        { label: 'Opening', value: h.openingDeltaMs },
        { label: 'Slotronde', value: h.slotDeltaMs },
        { label: 'Verval', value: h.vervalDeltaMs },
      ]
    : []
})

const side = computed(() => {
  if (!data.value?.compareRace) return []
  return [
    { title: 'Basisrit', race: data.value.baseRace },
    { title: 'Vergelijkingsrit', race: data.value.compareRace },
  ]
})
</script>

<template>
  <div v-if="data" class="space-y-6 max-w-3xl">
    <div>
      <h1 class="page-title">Vergelijk races</h1>
      <p class="text-secondary mt-1">
        Basisrit: {{ data.baseRace.distanceM }}m &middot;
        <span class="font-mono">{{ fmtDate(data.baseRace.competitionDate) }}</span> &middot;
        {{ data.baseRace.competitionName }}
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <button v-if="data.candidates.length" type="button" class="btn btn-primary btn-sm" @click="pickerModal?.open()">
        Kies rit voor vergelijking
      </button>
      <NuxtLink :to="`/results/races/${id}`" class="btn btn-secondary btn-sm">Terug naar basisrit</NuxtLink>
      <NuxtLink
        v-if="data.compareRace"
        :to="{ path: `/results/races/${data.compareRace.id}/compare`, query: { compareRaceId: String(data.baseRace.id) } }"
        class="btn btn-secondary btn-sm"
      >
        Wissel basis en vergelijking
      </NuxtLink>
    </div>

    <p v-if="!data.candidates.length" class="text-secondary">
      Geen andere ritten op deze afstand om mee te vergelijken.
    </p>
    <p v-else-if="data.compareRace" class="text-secondary" aria-live="polite">
      Vergelijking met: {{ fmtDate(data.compareRace.competitionDate) }} &ndash; {{ data.compareRace.competitionName }}
      &ndash; <span class="font-mono">{{ fmtMs(data.compareRace.totalTimeMs) }}</span>
    </p>
    <p v-else class="text-secondary">Geen vergelijkingsrit geselecteerd.</p>

    <Modal ref="pickerModal" title="Selecteer vergelijkingsrit">
      <form class="space-y-3" @submit.prevent>
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Zoeken</span>
          <input v-model="filterQuery" type="search" class="field" placeholder="Zoek op wedstrijd of locatie">
        </label>
        <div class="grid grid-cols-3 gap-2">
          <label class="block text-sm space-y-1">
            <span class="text-secondary">Locatie</span>
            <select v-model="filterVenue" class="field">
              <option value="">Alle locaties</option>
              <option v-for="v in venueOptions" :key="v" :value="v">{{ v }}</option>
            </select>
          </label>
          <label class="block text-sm space-y-1">
            <span class="text-secondary">Datum vanaf</span>
            <input v-model="filterFrom" type="date" class="field">
          </label>
          <label class="block text-sm space-y-1">
            <span class="text-secondary">Datum t/m</span>
            <input v-model="filterTo" type="date" class="field">
          </label>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" @click="resetFilters">Reset filters</button>
      </form>

      <div class="overflow-x-auto mt-4 picker-table">
        <table class="table">
          <thead>
            <tr>
              <th>Datum</th>
              <th class="num">Tijd</th>
              <th>Locatie</th>
              <th>Wedstrijd</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in filteredCandidates" :key="c.id" class="table-row-link">
              <td class="font-mono text-meta">{{ fmtDate(c.competitionDate) }}</td>
              <td class="num font-mono">
                <button type="button" class="stretched-link picker-pick" @click="pick(c.id)">{{ fmtMs(c.totalTimeMs) }}</button>
              </td>
              <td class="text-secondary">{{ c.venue || '-' }}</td>
              <td class="text-secondary">{{ c.competitionName }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="!filteredCandidates.length" class="text-secondary mt-3">Geen ritten gevonden voor deze filters.</p>
      </div>
    </Modal>

    <template v-if="comparison && data.compareRace">
      <section class="card space-y-3">
        <h2 class="card-title">Ritcontext</h2>
        <div class="grid sm:grid-cols-2 gap-4">
          <div v-for="s in side" :key="s.title">
            <div class="stat-label">{{ s.title }}</div>
            <div class="stat-value mt-0.5">{{ fmtMs(s.race.totalTimeMs) }}</div>
            <dl class="context-list">
              <div><dt>Datum</dt><dd class="font-mono">{{ fmtDate(s.race.competitionDate) }}</dd></div>
              <div><dt>Baan</dt><dd>{{ s.race.venue || '-' }}</dd></div>
              <div><dt>Tegenstander</dt><dd>{{ s.race.opponent || '-' }}</dd></div>
              <div><dt>Startbaan</dt><dd>{{ s.race.lane || '-' }}</dd></div>
            </dl>
          </div>
        </div>
      </section>

      <section class="card space-y-3">
        <h2 class="card-title">Analyse</h2>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div v-for="h in highlights" :key="h.label">
            <div class="stat-label">{{ h.label }}</div>
            <div class="stat-value-sm mt-0.5" :class="deltaClass(h.value)">{{ fmtDeltaMs(h.value) }}</div>
          </div>
        </div>
        <p>
          <strong>Waar werd tijd gewonnen of verloren?</strong>
          {{ comparison.samenvattingTekst }}
        </p>
      </section>

      <section>
        <h2 class="card-title mb-2">Samenvatting</h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th/>
                <th class="num">Basis</th>
                <th class="num">Vergelijking</th>
                <th class="num">Delta</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparison.summary" :key="row.label">
                <td class="text-secondary">{{ row.label }}</td>
                <td class="num font-mono">{{ fmtMs(row.baseMs) }}</td>
                <td class="num font-mono">{{ fmtMs(row.compareMs) }}</td>
                <td class="num font-mono">
                  <span :class="deltaClass(row.deltaMs)">{{ fmtDeltaMs(row.deltaMs) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="deltaPoints.length" class="card space-y-4">
        <h2 class="card-title">Waar werd tijd gewonnen of verloren?</h2>
        <div>
          <h3 class="section-heading mb-1">Tijdsverschil per split</h3>
          <SplitChart
            kind="delta"
            :labels="deltaPoints.map((s) => String(s.index))"
            :series="[{ name: 'Verschil', values: deltaPoints.map((s) => s.splitDeltaMs), tone: 'accent' }]"
            label="Tijdsverschil per split, in milliseconden"
          />
        </div>
        <div>
          <h3 class="section-heading mb-1">Cumulatief tijdsverschil</h3>
          <SplitChart
            kind="delta"
            :labels="deltaPoints.map((s) => String(s.index))"
            :series="[{ name: 'Cumulatief', values: deltaPoints.map((s) => s.cumulativeDeltaMs), tone: 'accent' }]"
            label="Cumulatief tijdsverschil, in milliseconden"
          />
        </div>
      </section>

      <section class="card space-y-3">
        <h2 class="card-title">Rondetijden</h2>
        <template v-if="hasLaps">
          <div class="flex gap-4 text-secondary" aria-hidden="true">
            <span class="legend-item"><span class="legend-dot legend-base" />Basisrit</span>
            <span class="legend-item"><span class="legend-dot legend-compare" />Vergelijkingsrit</span>
          </div>
          <SplitChart
            kind="seconds"
            :height="240"
            :labels="lapLabels"
            :series="[
              { name: 'Basisrit', values: comparison.splits.map((s) => s.baseSplit), tone: 'muted' },
              { name: 'Vergelijkingsrit', values: comparison.splits.map((s) => s.compareSplit), tone: 'accent' },
            ]"
            label="Rondetijden van beide ritten, in seconden"
          />
        </template>
        <p v-else class="text-secondary">Geen rondetijden beschikbaar.</p>
      </section>

      <section class="card space-y-4">
        <h2 class="card-title">Ritopbouw</h2>
        <div class="grid grid-cols-3 gap-3">
          <div
v-for="item in [
            { label: 'Opening', base: comparison.pacing.basisOpeningMs, other: comparison.pacing.vergelijkingOpeningMs },
            { label: 'Slotronde', base: comparison.pacing.basisSlotMs, other: comparison.pacing.vergelijkingSlotMs },
            { label: 'Verval', base: comparison.pacing.basisVervalMs, other: comparison.pacing.vergelijkingVervalMs },
          ]" :key="item.label">
            <div class="stat-label">{{ item.label }}</div>
            <div class="text-secondary mt-0.5">Basisrit: <span class="font-mono">{{ fmtMs(item.base) }}</span></div>
            <div class="text-secondary">Vergelijkingsrit: <span class="font-mono">{{ fmtMs(item.other) }}</span></div>
          </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-3">
          <div
v-for="p in [
            { title: 'Labels basisrit', labels: comparison.pacing.basisLabels },
            { title: 'Labels vergelijkingsrit', labels: comparison.pacing.vergelijkingLabels },
          ]" :key="p.title">
            <div class="stat-label mb-1">{{ p.title }}</div>
            <div v-if="p.labels.length" class="flex flex-wrap gap-1.5">
              <span v-for="label in p.labels" :key="label" class="tag">{{ label }}</span>
            </div>
            <p v-else class="text-meta">Geen pacinglabels beschikbaar.</p>
          </div>
        </div>
      </section>

      <section class="card space-y-3">
        <h2 class="card-title">Sterkste en zwakste onderdeel</h2>
        <div class="grid grid-cols-2 gap-3">
          <div
v-for="part in [
            { title: 'Sterkste onderdeel', row: comparison.onderdelen.sterkste },
            { title: 'Zwakste onderdeel', row: comparison.onderdelen.zwakste },
          ]" :key="part.title">
            <div class="stat-label">{{ part.title }}</div>
            <template v-if="part.row">
              <div class="stat-value-sm mt-0.5">Split {{ part.row.index }}</div>
              <div class="text-secondary">
                {{ part.row.distanceM ?? '-' }}m &middot;
                <span class="font-mono" :class="deltaClass(part.row.splitDeltaMs)">{{ fmtDeltaMs(part.row.splitDeltaMs) }}</span>
              </div>
            </template>
            <div v-else class="text-secondary">Niet beschikbaar.</div>
          </div>
        </div>
      </section>

      <section>
        <h2 class="card-title mb-2">Splitvergelijking</h2>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Afstand</th>
                <th class="num">Basis</th>
                <th class="num">Vergelijking</th>
                <th class="num">Delta</th>
                <th class="num">Cumulatief</th>
                <th class="num">400m-eq (basis / vergelijking)</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in comparison.splits"
                :key="row.index"
                :style="{
                  background:
                    row.index === comparison.onderdelen.sterkste?.index
                      ? 'color-mix(in srgb, var(--color-success) 8%, transparent)'
                      : row.index === comparison.onderdelen.zwakste?.index
                        ? 'color-mix(in srgb, var(--color-danger) 8%, transparent)'
                        : undefined,
                }"
              >
                <td class="text-meta">{{ row.index }}</td>
                <td class="text-meta">{{ row.distanceM ?? '-' }}m</td>
                <td class="num font-mono">{{ row.baseSplit?.toFixed(2) ?? '-' }}</td>
                <td class="num font-mono">{{ row.compareSplit?.toFixed(2) ?? '-' }}</td>
                <td class="num font-mono">
                  <span :class="deltaClass(row.splitDeltaMs)">{{ fmtDeltaMs(row.splitDeltaMs) }}</span>
                </td>
                <td class="num font-mono">
                  <span :class="deltaClass(row.cumulativeDeltaMs)">{{ fmtDeltaMs(row.cumulativeDeltaMs) }}</span>
                </td>
                <td class="num font-mono text-secondary">
                  <template v-if="row.base400 === null || row.compare400 === null">-</template>
                  <template v-else>{{ row.base400.toFixed(2) }} / {{ row.compare400.toFixed(2) }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
  <p v-else-if="error" style="color: var(--color-danger)">Rit niet gevonden.</p>
</template>

<style scoped>
.context-list {
  margin-top: var(--space-2);
  font-size: 0.85rem;
}

.context-list > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--highlight-soft);
}

.context-list dt {
  color: var(--color-text-faint);
}

.context-list dd {
  margin: 0;
  color: var(--color-text-muted);
  text-align: right;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.8rem;
}

.legend-dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
}

.legend-base {
  background: var(--color-text-muted);
}

.legend-compare {
  background: var(--color-accent);
}

.picker-table {
  max-height: 45vh;
  overflow-y: auto;
}

.picker-pick {
  background: transparent;
  border: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  padding: 0;
}
</style>
