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
    <h1 class="text-2xl font-heading font-semibold">Statistieken</h1>

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
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-5">
        <div>
          <div class="stat-label">Wedstrijden</div>
          <div class="stat-value">{{ data.basic.competitionCount }}</div>
        </div>
        <div>
          <div class="stat-label">Ritten</div>
          <div class="stat-value">{{ data.basic.raceCount }}</div>
        </div>
        <div>
          <div class="stat-label">Kilometers</div>
          <div class="stat-value">{{ data.basic.totalKm.toFixed(1) }} km</div>
        </div>
        <div>
          <div class="stat-label">PR's</div>
          <div class="stat-value" style="color: var(--color-accent)">{{ data.basic.pbCount }}</div>
        </div>
        <div class="col-span-2 sm:col-span-1">
          <div class="stat-label">SB's</div>
          <div class="stat-value">{{ data.basic.sbCount }}</div>
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
              <th>PR</th>
              <th>SB</th>
              <th>Gem.</th>
              <th>Mediaan</th>
              <th>Std.dev</th>
              <th>Spreiding</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.distanceRows" :key="row.distanceM">
              <td class="font-mono">{{ row.distanceM }}m</td>
              <td class="font-mono font-semibold" style="color: var(--color-accent)">
                <NuxtLink :to="`/results/races/${row.pbRaceId}`" class="hover:underline">{{ fmtMs(row.pbMs) }}</NuxtLink>
              </td>
              <td class="font-mono" :style="{ color: row.seasonBestMs == null ? 'var(--color-text-faint)' : 'var(--color-text)' }">
                {{ fmtMs(row.seasonBestMs) }}
              </td>
              <td class="font-mono" style="color: var(--color-text-muted)">{{ fmtMs(row.averageMs) }}</td>
              <td class="font-mono" style="color: var(--color-text-muted)">{{ fmtMs(row.medianMs) }}</td>
              <td class="font-mono" style="color: var(--color-text-muted)">{{ fmtMs(row.stdDevMs) }}</td>
              <td class="font-mono" style="color: var(--color-text-muted)">{{ fmtMs(row.rangeMs) }}</td>
              <td>{{ trendLabel[row.trend] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="data?.trackRows.length">
      <h2 class="section-heading mb-2">Baanstatistieken</h2>
      <p v-if="data.bestTrack" class="text-sm mb-2" style="color: var(--color-text-muted)">
        Beste baan: {{ data.bestTrack.name }} ({{ data.bestTrack.deltaMs > 0 ? '+' : '' }}{{ fmtMs(data.bestTrack.deltaMs) }} t.o.v. gemiddeld)
      </p>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Baan</th>
              <th>Ritten</th>
              <th>Gem. (500m-eq)</th>
              <th>Beste (500m-eq)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.trackRows" :key="row.venue">
              <td>{{ row.venue }}</td>
              <td class="font-mono" style="color: var(--color-text-muted)">{{ row.raceCount }}</td>
              <td class="font-mono" style="color: var(--color-text-muted)">{{ fmtMs(row.avg500EqMs) }}</td>
              <td class="font-mono font-semibold">{{ fmtMs(row.best500EqMs) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
