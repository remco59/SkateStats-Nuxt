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
      <h1 class="text-xl font-semibold">Ritten</h1>
      <NuxtLink
        to="/results/races/new"
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
      >
        Nieuwe rit
      </NuxtLink>
    </div>

    <div class="flex flex-wrap gap-2">
      <input
        v-model="q"
        placeholder="Zoek wedstrijd of locatie"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @keyup.enter="applyFilters"
      >
      <select
        v-model="distanceM"
        aria-label="Filter op afstand"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @change="applyFilters"
      >
        <option value="">Alle afstanden</option>
        <option v-for="d in data?.distanceOptions" :key="d" :value="d">{{ d }}m</option>
      </select>
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @click="applyFilters"
      >
        Filter
      </button>
    </div>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)">Kon ritten niet laden.</p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left" style="color: var(--color-text-muted)">
            <th class="py-1 pr-4">Afstand</th>
            <th class="py-1 pr-4">Wedstrijd</th>
            <th class="py-1 pr-4">Datum</th>
            <th class="py-1 pr-4">Status</th>
            <th class="py-1 pr-4">Tijd</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data?.races" :key="r.id" style="border-top: 1px solid var(--color-border)">
            <td class="py-2 pr-4">
              <NuxtLink :to="`/results/races/${r.id}`" class="font-mono hover:underline">
                {{ r.distanceM }}m
              </NuxtLink>
            </td>
            <td class="py-2 pr-4">{{ r.competitionName }}</td>
            <td class="py-2 pr-4 font-mono">{{ fmtDate(r.competitionDate) }}</td>
            <td class="py-2 pr-4">{{ raceStatusLabel(r.status) }}</td>
            <td class="py-2 pr-4 font-mono">
              {{ fmtMs(r.totalTimeMs) }}
              <span v-if="r.isPr" class="text-xs" style="color: var(--color-accent)">PR</span>
            </td>
          </tr>
          <tr v-if="!data?.races?.length">
            <td colspan="5" class="py-4" style="color: var(--color-text-muted)">Nog geen ritten.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
