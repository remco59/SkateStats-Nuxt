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
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Wedstrijden</h1>
      <NuxtLink
        to="/results/competitions/new"
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
      >
        Nieuwe wedstrijd
      </NuxtLink>
    </div>

    <div class="flex flex-wrap gap-2">
      <input
        v-model="q"
        placeholder="Zoek naam of locatie"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @keyup.enter="applyFilters"
      >
      <select
        v-model="venue"
        aria-label="Filter op locatie"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @change="applyFilters"
      >
        <option value="">Alle locaties</option>
        <option v-for="v in data?.venueOptions" :key="v" :value="v">{{ v }}</option>
      </select>
      <input
        v-model="dateFrom"
        type="date"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @change="applyFilters"
      >
      <input
        v-model="dateTo"
        type="date"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @change="applyFilters"
      >
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
        @click="applyFilters"
      >
        Filter
      </button>
    </div>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)">
      Kon wedstrijden niet laden.
    </p>
    <div v-else class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left" style="color: var(--color-text-muted)">
            <th class="py-1 pr-4">Naam</th>
            <th class="py-1 pr-4">Locatie</th>
            <th class="py-1 pr-4">Datum</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="c in data?.competitions"
            :key="c.id"
            style="border-top: 1px solid var(--color-border)"
          >
            <td class="py-2 pr-4">
              <NuxtLink :to="`/results/competitions/${c.id}`" class="hover:underline">
                {{ c.name }}
              </NuxtLink>
            </td>
            <td class="py-2 pr-4">{{ c.venue || '-' }}</td>
            <td class="py-2 pr-4 font-mono">{{ fmtDate(c.date) }}</td>
          </tr>
          <tr v-if="!data?.competitions?.length">
            <td colspan="3" class="py-4" style="color: var(--color-text-muted)">
              Nog geen wedstrijden.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
