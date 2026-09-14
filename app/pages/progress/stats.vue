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
    <h1 class="page-title">Statistieken</h1>

    <div class="filter-bar">
      <select v-model="season" aria-label="Filter op seizoen" class="field" style="width: auto" @change="applyFilters">
        <option value="">Alle seizoenen</option>
        <option v-for="s in data?.seasonOptions" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="distanceM" aria-label="Filter op afstand" class="field" style="width: auto" @change="applyFilters">
        <option value="">Alle afstanden</option>
        <option v-for="d in data?.distanceOptions" :key="d" :value="d">{{ d }}m</option>
      </select>
    </div>

    <p v-if="error" class="text-sm" style="color: var(--color-danger)">Kon statistieken niet laden.</p>

    <section v-if="data && data.basic.raceCount === 0" class="empty-state">
      Nog geen data voor dit filter.
    </section>

    <section v-if="data && data.basic.raceCount > 0" class="card">
      <h2 class="section-heading mb-3">Basisstatistieken</h2>
      <div class="grid grid-cols-3 gap-x-4 gap-y-6">
        <div>
          <div class="stat-label">Wedstrijden</div>
          <div class="stat-value-lg">{{ data.basic.competitionCount }}</div>
        </div>
        <div>
          <div class="stat-label">Ritten</div>
          <div class="stat-value-lg">{{ data.basic.raceCount }}</div>
        </div>
        <div>
          <div class="stat-label">PR's</div>
          <div class="stat-value-lg" style="color: var(--color-accent)">{{ data.basic.pbCount }}</div>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-8 gap-y-3 mt-5 pt-4" style="border-top: 1px solid var(--highlight-soft)">
        <div>
          <div class="stat-label">Kilometers</div>
          <div class="text-secondary font-mono mt-0.5">{{ data.basic.totalKm.toFixed(1) }} km</div>
        </div>
        <div>
          <div class="stat-label">SB's</div>
          <div class="text-secondary font-mono mt-0.5">{{ data.basic.sbCount }}</div>
        </div>
      </div>
    </section>

    <section v-if="data?.distanceRows.length">
      <h2 class="section-heading mb-2">Per afstand</h2>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Afstand</th>
              <th class="num">PR</th>
              <th class="num">SB</th>
              <th class="num">Gem.</th>
              <th class="num">Mediaan</th>
              <th class="num">Std.dev</th>
              <th class="num">Spreiding</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.distanceRows" :key="row.distanceM">
              <td class="font-mono">{{ row.distanceM }}m</td>
              <td class="num font-mono font-semibold" style="color: var(--color-accent)">
                <NuxtLink :to="`/results/races/${row.pbRaceId}`" class="hover:underline">{{ fmtMs(row.pbMs) }}</NuxtLink>
              </td>
              <td class="num font-mono" :class="row.seasonBestMs == null ? 'delta-neutral' : ''">
                {{ fmtMs(row.seasonBestMs) }}
              </td>
              <td class="num font-mono text-secondary">{{ fmtMs(row.averageMs) }}</td>
              <td class="num font-mono text-secondary">{{ fmtMs(row.medianMs) }}</td>
              <td class="num font-mono text-secondary">{{ fmtMs(row.stdDevMs) }}</td>
              <td class="num font-mono text-secondary">{{ fmtMs(row.rangeMs) }}</td>
              <td class="text-secondary">{{ trendLabel[row.trend] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="data?.trackRows.length">
      <h2 class="section-heading mb-2">Baanstatistieken</h2>
      <p v-if="data.bestTrack" class="text-secondary mb-2">
        Beste baan: {{ data.bestTrack.name }} ({{ data.bestTrack.deltaMs > 0 ? '+' : '' }}{{ fmtMs(data.bestTrack.deltaMs) }} t.o.v. gemiddeld)
      </p>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Baan</th>
              <th class="num">Ritten</th>
              <th class="num">Gem. (500m-eq)</th>
              <th class="num">Beste (500m-eq)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.trackRows" :key="row.venue">
              <td>{{ row.venue }}</td>
              <td class="num font-mono text-secondary">{{ row.raceCount }}</td>
              <td class="num font-mono text-secondary">{{ fmtMs(row.avg500EqMs) }}</td>
              <td class="num font-mono font-semibold">{{ fmtMs(row.best500EqMs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
