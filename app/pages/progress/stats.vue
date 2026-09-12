<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const season = ref(String(route.query.season ?? ''))
const distanceM = ref(String(route.query.distanceM ?? ''))

const { data, error, refresh } = await useFetch('/api/progress/stats', { query: { season, distanceM } })

function applyFilters() {
  router.push({ query: { season: season.value || undefined, distanceM: distanceM.value || undefined } })
  refresh()
}

const trendLabel: Record<string, string> = {
  verbeterend: 'Verbeterend',
  verslechterend: 'Verslechterend',
  stabiel: 'Stabiel',
  'n.v.t.': 'n.v.t.',
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-xl font-semibold">Statistieken</h1>

    <div class="flex flex-wrap gap-2">
      <select
        v-model="season"
        aria-label="Filter op seizoen"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border)"
        @change="applyFilters"
      >
        <option value="">Alle seizoenen</option>
        <option v-for="s in data?.seasonOptions" :key="s" :value="s">{{ s }}</option>
      </select>
      <select
        v-model="distanceM"
        aria-label="Filter op afstand"
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-border)"
        @change="applyFilters"
      >
        <option value="">Alle afstanden</option>
        <option v-for="d in data?.distanceOptions" :key="d" :value="d">{{ d }}m</option>
      </select>
    </div>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)">Kon statistieken niet laden.</p>

    <section v-if="data && data.basic.raceCount === 0" class="rounded-lg p-4" style="border: 1px solid var(--color-border)">
      <p style="color: var(--color-text-muted)">Nog geen data voor dit filter.</p>
    </section>

    <section v-if="data && data.basic.raceCount > 0" class="rounded-lg p-4" style="border: 1px solid var(--color-border)">
      <h2 class="text-sm font-medium mb-3" style="color: var(--color-text-muted)">Basisstatistieken</h2>
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm">
        <div>
          <div style="color: var(--color-text-muted)">Wedstrijden</div>
          <div class="font-mono text-lg">{{ data.basic.competitionCount }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Ritten</div>
          <div class="font-mono text-lg">{{ data.basic.raceCount }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Kilometers</div>
          <div class="font-mono text-lg">{{ data.basic.totalKm.toFixed(1) }} km</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">PR's</div>
          <div class="font-mono text-lg">{{ data.basic.pbCount }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">SB's</div>
          <div class="font-mono text-lg">{{ data.basic.sbCount }}</div>
        </div>
      </div>
    </section>

    <section v-if="data?.distanceRows.length">
      <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Per afstand</h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left" style="color: var(--color-text-muted)">
              <th class="py-1 pr-4">Afstand</th>
              <th class="py-1 pr-4">PR</th>
              <th class="py-1 pr-4">SB</th>
              <th class="py-1 pr-4">Gem.</th>
              <th class="py-1 pr-4">Mediaan</th>
              <th class="py-1 pr-4">Std.dev</th>
              <th class="py-1 pr-4">Spreiding</th>
              <th class="py-1 pr-4">Trend</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.distanceRows" :key="row.distanceM" style="border-top: 1px solid var(--color-border)">
              <td class="py-2 pr-4 font-mono">{{ row.distanceM }}m</td>
              <td class="py-2 pr-4 font-mono">
                <NuxtLink :to="`/results/races/${row.pbRaceId}`" class="hover:underline">{{ fmtMs(row.pbMs) }}</NuxtLink>
              </td>
              <td class="py-2 pr-4 font-mono">{{ fmtMs(row.seasonBestMs) }}</td>
              <td class="py-2 pr-4 font-mono">{{ fmtMs(row.averageMs) }}</td>
              <td class="py-2 pr-4 font-mono">{{ fmtMs(row.medianMs) }}</td>
              <td class="py-2 pr-4 font-mono">{{ fmtMs(row.stdDevMs) }}</td>
              <td class="py-2 pr-4 font-mono">{{ fmtMs(row.rangeMs) }}</td>
              <td class="py-2 pr-4">{{ trendLabel[row.trend] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="data?.trackRows.length">
      <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Baanstatistieken</h2>
      <p v-if="data.bestTrack" class="text-sm" style="color: var(--color-text-muted)">
        Beste baan: {{ data.bestTrack.name }} ({{ data.bestTrack.deltaMs > 0 ? '+' : '' }}{{ fmtMs(data.bestTrack.deltaMs) }} t.o.v. gemiddeld)
      </p>
      <div class="overflow-x-auto">
        <table class="w-full text-sm mt-2">
          <thead>
            <tr class="text-left" style="color: var(--color-text-muted)">
              <th class="py-1 pr-4">Baan</th>
              <th class="py-1 pr-4">Ritten</th>
              <th class="py-1 pr-4">Gem. (500m-eq)</th>
              <th class="py-1 pr-4">Beste (500m-eq)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.trackRows" :key="row.venue" style="border-top: 1px solid var(--color-border)">
              <td class="py-2 pr-4">{{ row.venue }}</td>
              <td class="py-2 pr-4 font-mono">{{ row.raceCount }}</td>
              <td class="py-2 pr-4 font-mono">{{ fmtMs(row.avg500EqMs) }}</td>
              <td class="py-2 pr-4 font-mono">{{ fmtMs(row.best500EqMs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
