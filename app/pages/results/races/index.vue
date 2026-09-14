<script setup lang="ts">
import { raceStatusLabel } from '#shared/constants'

const route = useRoute()
const router = useRouter()

const q = ref(String(route.query.q ?? ''))
const distanceM = ref(String(route.query.distanceM ?? ''))
const dateFrom = ref(String(route.query.dateFrom ?? ''))
const dateTo = ref(String(route.query.dateTo ?? ''))

const { data, error, refresh } = await useFetch('/api/results/races', {
  query: { q, distanceM, dateFrom, dateTo },
})

function applyFilters() {
  router.push({
    query: {
      q: q.value || undefined,
      distanceM: distanceM.value || undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
    },
  })
  refresh()
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="page-title">Ritten</h1>
      <NuxtLink to="/results/races/new" class="btn btn-primary btn-sm">
        Nieuwe rit
      </NuxtLink>
    </div>

    <div class="filter-bar">
      <input
        v-model="q"
        placeholder="Zoek wedstrijd of locatie"
        class="field"
        @keyup.enter="applyFilters"
      >
      <select v-model="distanceM" aria-label="Filter op afstand" class="field" @change="applyFilters">
        <option value="">Alle afstanden</option>
        <option v-for="d in data?.distanceOptions" :key="d" :value="d">{{ d }}m</option>
      </select>
      <button type="button" class="btn btn-secondary" @click="applyFilters">Filter</button>
    </div>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)">Kon ritten niet laden.</p>
    <div v-else class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Afstand</th>
            <th>Wedstrijd</th>
            <th>Status</th>
            <th class="num">Datum</th>
            <th class="num">Tijd</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data?.races" :key="r.id" class="table-row-link">
            <td class="font-mono">
              <NuxtLink :to="`/results/races/${r.id}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
            </td>
            <td class="text-secondary">{{ r.competitionName }}</td>
            <td class="text-secondary">{{ raceStatusLabel(r.status) }}</td>
            <td class="num font-mono text-meta">{{ fmtDate(r.competitionDate) }}</td>
            <td class="num">
              <span class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
              <span v-if="r.isPr" class="badge badge-pr ml-1">PR</span>
            </td>
          </tr>
          <tr v-if="!data?.races?.length">
            <td colspan="5" class="empty-state" style="border: none">Nog geen ritten.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
