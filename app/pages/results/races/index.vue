<script setup lang="ts">
import { RACE_TAGS, RACE_TAG_LABELS, raceStatusLabel } from '#shared/constants'

const route = useRoute()
const router = useRouter()

const q = ref(String(route.query.q ?? ''))
const distanceM = ref(String(route.query.distanceM ?? ''))
const tag = ref(String(route.query.tag ?? ''))
const lane = ref(String(route.query.lane ?? ''))
const venue = ref(String(route.query.venue ?? ''))
const dateFrom = ref(String(route.query.dateFrom ?? ''))
const dateTo = ref(String(route.query.dateTo ?? ''))

const { data, error } = await useFetch('/api/results/races', {
  query: { q, distanceM, tag, lane, venue, dateFrom, dateTo },
})

// The filter panel starts open when the URL already carries a filter.
const filtersOpen = ref(!!(distanceM.value || tag.value || lane.value || venue.value || dateFrom.value || dateTo.value))
const filterCount = computed(() => [distanceM, tag, lane, venue, dateFrom, dateTo].filter((f) => f.value).length)

function applyFilters() {
  router.push({
    query: {
      q: q.value || undefined,
      distanceM: distanceM.value || undefined,
      tag: tag.value || undefined,
      lane: lane.value || undefined,
      venue: venue.value || undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
    },
  })
}

// Dropdowns and dates apply as soon as they change; the search box on Enter
// (or the button), so typing doesn't reload the list on every keystroke.
watch([distanceM, tag, lane, venue, dateFrom, dateTo], applyFilters)

// Browser back/forward changes the URL under us: follow it.
watch(
  () => route.query,
  (qs) => {
    q.value = String(qs.q ?? '')
    distanceM.value = String(qs.distanceM ?? '')
    tag.value = String(qs.tag ?? '')
    lane.value = String(qs.lane ?? '')
    venue.value = String(qs.venue ?? '')
    dateFrom.value = String(qs.dateFrom ?? '')
    dateTo.value = String(qs.dateTo ?? '')
  },
)

function resetFilters() {
  distanceM.value = ''
  tag.value = ''
  lane.value = ''
  venue.value = ''
  dateFrom.value = ''
  dateTo.value = ''
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="page-title">Ritten</h1>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          :aria-expanded="filtersOpen"
          aria-controls="race-filters"
          @click="filtersOpen = !filtersOpen"
        >
          Filters<span v-if="filterCount" class="filter-count">{{ filterCount }}</span>
        </button>
        <NuxtLink to="/results/races/new" class="btn btn-primary btn-sm">
          Nieuwe rit
        </NuxtLink>
      </div>
    </div>

    <div class="filter-bar">
      <input
        v-model="q"
        placeholder="Zoek wedstrijd of locatie"
        aria-label="Zoek wedstrijd of locatie"
        class="field"
        @keyup.enter="applyFilters"
      >
      <button type="button" class="btn btn-secondary" @click="applyFilters">Zoek</button>
    </div>

    <section v-show="filtersOpen" id="race-filters" class="card space-y-3">
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Afstand</span>
          <select v-model="distanceM" class="field">
            <option value="">Alle afstanden</option>
            <option v-for="d in data?.distanceOptions" :key="d" :value="String(d)">{{ d }}m</option>
          </select>
        </label>
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Tag</span>
          <select v-model="tag" class="field">
            <option value="">Alle tags</option>
            <option v-for="t in RACE_TAGS" :key="t" :value="t">{{ RACE_TAG_LABELS[t] }}</option>
          </select>
        </label>
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Baan / lane</span>
          <select v-model="lane" class="field">
            <option value="">Alle banen</option>
            <option v-for="l in data?.laneOptions" :key="l" :value="l">{{ l }}</option>
          </select>
        </label>
        <label class="block text-sm space-y-1">
          <span class="text-secondary">Locatie</span>
          <select v-model="venue" class="field">
            <option value="">Alle locaties</option>
            <option v-for="v in data?.venueOptions" :key="v" :value="v">{{ v }}</option>
          </select>
        </label>
        <div class="block text-sm space-y-1">
          <span class="text-secondary">Datum vanaf</span>
          <DateInput v-model="dateFrom" aria-label="Datum vanaf" />
        </div>
        <div class="block text-sm space-y-1">
          <span class="text-secondary">Datum t/m</span>
          <DateInput v-model="dateTo" aria-label="Datum t/m" />
        </div>
      </div>
      <button type="button" class="btn btn-secondary btn-sm" @click="resetFilters">Reset</button>
    </section>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)">Kon ritten niet laden.</p>
    <div v-else class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Afstand</th>
            <th class="num">Tijd</th>
            <th>Baan</th>
            <th>Locatie</th>
            <th>Wedstrijd</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data?.races" :key="r.id" class="table-row-link">
            <td class="font-mono text-meta whitespace-nowrap">{{ fmtDate(r.competitionDate) }}</td>
            <td class="font-mono">
              <NuxtLink :to="`/results/races/${r.id}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
            </td>
            <td class="num whitespace-nowrap">
              <span v-if="r.totalTimeMs !== null" class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
              <span v-else class="text-secondary">{{ raceStatusLabel(r.status) }}</span>
              <span v-if="r.isPr" class="badge badge-pr ml-1">PR</span>
              <span v-else-if="r.isSb" class="badge badge-sb ml-1">SB</span>
              <RaceTagChip :tag="r.tag" class="ml-1" />
            </td>
            <td><LaneDot :lane="r.lane" /></td>
            <td class="text-secondary">{{ r.venue || '-' }}</td>
            <td class="text-secondary">
              <NuxtLink :to="`/results/competitions/${r.competitionId}`" class="relative z-10 hover:underline">
                {{ r.competitionName }}
              </NuxtLink>
            </td>
          </tr>
          <tr v-if="!data?.races?.length">
            <td colspan="6" class="empty-state" style="border: none">
              {{ filterCount || q ? 'Geen ritten gevonden voor deze filters.' : 'Nog geen ritten.' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.filter-count {
  margin-left: 0.4rem;
  min-width: 1.2rem;
  padding: 0 0.3rem;
  border-radius: 999px;
  font-size: 0.7rem;
  line-height: 1.2rem;
  text-align: center;
  color: var(--color-accent-contrast);
  background: var(--color-accent);
}
</style>
