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
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-heading font-semibold">Wedstrijden</h1>
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
            <th>Datum</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in data?.competitions" :key="c.id" class="table-row-link">
            <td class="font-medium">
              <NuxtLink :to="`/results/competitions/${c.id}`" class="stretched-link">
                {{ c.name }}
              </NuxtLink>
            </td>
            <td style="color: var(--color-text-muted)">{{ c.venue || '-' }}</td>
            <td class="font-mono" style="color: var(--color-text-muted)">{{ fmtDate(c.date) }}</td>
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
