<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const q = ref(String(route.query.q ?? ''))
const venue = ref(String(route.query.venue ?? ''))
const dateFrom = ref(String(route.query.dateFrom ?? ''))
const dateTo = ref(String(route.query.dateTo ?? ''))

const { data, error, refresh } = await useFetch('/api/results/competitions', {
  query: { q, venue, dateFrom, dateTo },
})

// The nav search box navigates here with ?q= even when this page is already
// open; Nuxt reuses the component then, so pick the new query up explicitly.
watch(
  () => route.query.q,
  (next) => {
    q.value = String(next ?? '')
  },
)

function applyFilters() {
  router.push({
    query: {
      q: q.value || undefined,
      venue: venue.value || undefined,
      dateFrom: dateFrom.value || undefined,
      dateTo: dateTo.value || undefined,
    },
  })
  refresh()
}
</script>

<template>
  <div class="space-y-6">
    <SubTabs section="results" class="!mb-0" />
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="page-title">Wedstrijden</h1>
      <NuxtLink to="/results/competitions/new" class="btn btn-primary btn-sm">
        Nieuwe wedstrijd
      </NuxtLink>
    </div>

    <div class="filter-bar">
      <input
        v-model="q"
        placeholder="Zoek naam of locatie"
        class="field"
        @keyup.enter="applyFilters"
      >
      <select v-model="venue" aria-label="Filter op locatie" class="field" @change="applyFilters">
        <option value="">Alle locaties</option>
        <option v-for="v in data?.venueOptions" :key="v" :value="v">{{ v }}</option>
      </select>
      <input v-model="dateFrom" type="date" class="field" style="flex: 0 1 auto" @change="applyFilters">
      <input v-model="dateTo" type="date" class="field" style="flex: 0 1 auto" @change="applyFilters">
      <button type="button" class="btn btn-secondary" @click="applyFilters">Filter</button>
    </div>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)">
      Kon wedstrijden niet laden.
    </p>
    <div v-else class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Naam</th>
            <th>Locatie</th>
            <th class="num">Datum</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in data?.competitions" :key="c.id" class="table-row-link">
            <td class="font-medium">
              <NuxtLink :to="`/results/competitions/${c.id}`" class="stretched-link">
                {{ c.name }}
              </NuxtLink>
            </td>
            <td class="text-secondary">{{ c.venue || '-' }}</td>
            <td class="num font-mono text-meta">{{ fmtDate(c.date) }}</td>
          </tr>
          <tr v-if="!data?.competitions?.length">
            <td colspan="3" class="empty-state" style="border: none">
              Nog geen wedstrijden.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
