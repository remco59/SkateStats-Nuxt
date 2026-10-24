<script setup lang="ts">
const route = useRoute()
const router = useRouter()

// The URL is the source of truth for the filters. A URL without `season` is
// "just opened": the server then shows the current season. `season=` (empty)
// is an explicit "all seasons" -- which is why we push an empty string below
// instead of dropping the parameter.
const seasonParam = computed(() => (route.query.season === undefined ? undefined : String(route.query.season)))
const distanceParam = computed(() => String(route.query.distanceM ?? ''))

const { data, error } = await useFetch('/api/progress/stats', {
  query: { season: seasonParam, distanceM: distanceParam },
})

// What the selects show: whatever season the server actually applied.
const seasonSelect = ref(data.value?.selectedSeason ?? '')
const distanceSelect = ref(distanceParam.value)
watch(data, (d) => {
  seasonSelect.value = d?.selectedSeason ?? ''
  distanceSelect.value = distanceParam.value
})

function applyFilters() {
  router.push({ query: { season: seasonSelect.value, distanceM: distanceSelect.value || undefined } })
}

const trendLabel: Record<string, string> = {
  verbeterend: 'Verbeterend',
  verslechterend: 'Verslechterend',
  stabiel: 'Stabiel',
  'n.v.t.': 'n.v.t.',
}

const trendClass = (trend: string) =>
  trend === 'verbeterend' ? 'delta-better' : trend === 'verslechterend' ? 'delta-worse' : 'text-secondary'

const toneClass = (tone: string) => (tone === 'positive' ? 'delta-better' : tone === 'negative' ? 'delta-worse' : '')

const signedMs = (ms: number) => `${ms > 0 ? '+' : ''}${fmtMs(ms)}`
const signedSec = (s: number) => `${s > 0 ? '+' : ''}${fmtSec(s)}`

// No opening / lap split for the sprint distances (the old app skipped them).
const hasLapStats = (distanceM: number) => distanceM !== 100 && distanceM !== 300
</script>

<template>
  <div class="space-y-8">
    <SubTabs section="progress" class="!mb-0" />
    <h1 class="page-title">Statistieken</h1>

    <section v-if="data?.story" class="card story" aria-label="Coach analyse">
      <div class="stat-label mb-2">{{ data.story.title }}</div>
      <p v-for="(paragraph, i) in data.story.paragraphs" :key="i" class="story-paragraph">
        <template v-for="(part, j) in paragraph" :key="j">
          <template v-if="needsSpaceBefore(paragraph[j - 1], part)">{{ ' ' }}</template>
          <NuxtLink v-if="part.raceId" :to="`/results/races/${part.raceId}`" class="underline" :class="toneClass(part.tone)">{{ part.text }}</NuxtLink>
          <span v-else :class="toneClass(part.tone)">{{ part.text }}</span>
        </template>
      </p>
    </section>

    <div class="filter-bar">
      <select v-model="seasonSelect" aria-label="Filter op seizoen" class="field" style="width: auto" @change="applyFilters">
        <option value="">Alle seizoenen</option>
        <option v-for="s in data?.seasonOptions" :key="s" :value="s">{{ s }}</option>
      </select>
      <select v-model="distanceSelect" aria-label="Filter op afstand" class="field" style="width: auto" @change="applyFilters">
        <option value="">Alle afstanden</option>
        <option v-for="d in data?.distanceOptions" :key="d" :value="d">{{ d }}m</option>
      </select>
      <NuxtLink to="/progress/stats" class="btn btn-secondary btn-sm">Reset</NuxtLink>
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
      <h2 class="section-heading mb-2">Consistentie</h2>
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
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-meta mt-2">SB = beste tijd in seizoen {{ data.sbReferenceSeason }}.</p>
    </section>

    <section v-if="data?.trackRows.length">
      <h2 class="section-heading mb-2">Baanstatistieken</h2>
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
      <div class="text-secondary mt-2 space-y-0.5">
        <p v-if="data.bestTrack">
          Beste baan: {{ data.bestTrack.name }}
          (<span :class="data.bestTrack.deltaMs <= 0 ? 'delta-better' : 'delta-worse'">{{ signedMs(data.bestTrack.deltaMs) }}</span>
          t.o.v. gemiddeld)
        </p>
        <p v-if="data.worstTrack">
          Slechtste baan: {{ data.worstTrack.name }}
          (<span :class="data.worstTrack.deltaMs <= 0 ? 'delta-better' : 'delta-worse'">{{ signedMs(data.worstTrack.deltaMs) }}</span>
          t.o.v. gemiddeld)
        </p>
      </div>
    </section>

    <section v-if="data?.distanceRows.length">
      <h2 class="section-heading mb-2">Progressie</h2>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Afstand</th>
              <th class="num">Eerste rit</th>
              <th class="num">Laatste rit</th>
              <th class="num">Verbetering</th>
              <th class="num">Gem. laatste 5</th>
              <th class="num">Seizoensgem.</th>
              <th>Ontwikkeling</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in data.distanceRows" :key="row.distanceM">
              <td class="font-mono">{{ row.distanceM }}m</td>
              <td class="num font-mono">
                <NuxtLink :to="`/results/races/${row.firstRaceId}`" class="hover:underline">{{ fmtMs(row.firstMs) }}</NuxtLink>
              </td>
              <td class="num font-mono">
                <NuxtLink :to="`/results/races/${row.latestRaceId}`" class="hover:underline">{{ fmtMs(row.latestMs) }}</NuxtLink>
              </td>
              <td class="num font-mono" :class="row.improvementMs <= 0 ? 'delta-better' : 'delta-worse'">
                {{ signedMs(row.improvementMs) }}
              </td>
              <td class="num font-mono text-secondary">{{ fmtMs(row.last5AvgMs) }}</td>
              <td class="num font-mono text-secondary">{{ fmtMs(row.seasonAvgMs) }}</td>
              <td :class="trendClass(row.trend)">{{ trendLabel[row.trend] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="data?.distanceRows.length">
      <h2 class="section-heading mb-2">Tijden per afstand</h2>
      <div class="grid md:grid-cols-2 gap-4">
        <article v-for="row in data.distanceRows" :key="row.distanceM" class="card">
          <h3 class="font-mono text-lg font-semibold mb-2">{{ row.distanceM }}m</h3>
          <table class="table facts">
            <tbody>
              <tr>
                <td class="text-secondary">PB</td>
                <td class="num font-mono">
                  <NuxtLink :to="`/results/races/${row.pbRaceId}`" class="hover:underline">{{ fmtMs(row.pbMs) }}</NuxtLink>
                </td>
              </tr>
              <tr>
                <td class="text-secondary">Seizoensbeste ({{ data.sbReferenceSeason }})</td>
                <td class="num font-mono">
                  <NuxtLink v-if="row.seasonBestRaceId" :to="`/results/races/${row.seasonBestRaceId}`" class="hover:underline">
                    {{ fmtMs(row.seasonBestMs) }}
                  </NuxtLink>
                  <span v-else class="delta-neutral">-</span>
                </td>
              </tr>
              <tr>
                <td class="text-secondary">Gemiddelde</td>
                <td class="num font-mono">{{ fmtMs(row.averageMs) }}</td>
              </tr>
              <tr>
                <td class="text-secondary">Mediaan</td>
                <td class="num font-mono">{{ fmtMs(row.medianMs) }}</td>
              </tr>
              <template v-if="hasLapStats(row.distanceM)">
                <tr>
                  <td class="text-secondary">Gemiddelde opening</td>
                  <td class="num font-mono">{{ fmtSec(row.avgOpeningS) }}</td>
                </tr>
                <tr>
                  <td class="text-secondary">Beste opening</td>
                  <td class="num font-mono">
                    <NuxtLink v-if="row.bestOpeningRaceId" :to="`/results/races/${row.bestOpeningRaceId}`" class="hover:underline">
                      {{ fmtSec(row.bestOpeningS) }}
                    </NuxtLink>
                    <span v-else class="delta-neutral">-</span>
                  </td>
                </tr>
                <tr>
                  <td class="text-secondary">Gemiddelde ronde</td>
                  <td class="num font-mono">{{ fmtSec(row.avgLapS) }}</td>
                </tr>
                <tr>
                  <td class="text-secondary">Beste ronde</td>
                  <td class="num font-mono">
                    <NuxtLink v-if="row.bestLapRaceId" :to="`/results/races/${row.bestLapRaceId}`" class="hover:underline">
                      {{ fmtSec(row.bestLapS) }}
                    </NuxtLink>
                    <span v-else class="delta-neutral">-</span>
                  </td>
                </tr>
                <tr>
                  <td class="text-secondary">Gem. verval</td>
                  <td class="num font-mono">
                    <span v-if="row.avgFadeS === null" class="delta-neutral">-</span>
                    <span v-else :class="row.avgFadeS <= 0 ? 'delta-better' : 'delta-worse'">{{ signedSec(row.avgFadeS) }}</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
          <details v-if="hasLapStats(row.distanceM) && row.lapAverages.length" class="mt-3">
            <summary class="lap-summary">Rondetijden</summary>
            <table class="table facts mt-2">
              <tbody>
                <tr v-for="lap in row.lapAverages" :key="lap.lapNo">
                  <td class="text-secondary">Gem ronde {{ lap.lapNo }}</td>
                  <td class="num font-mono">{{ fmtSec(lap.avgS) }}</td>
                </tr>
              </tbody>
            </table>
          </details>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.story-paragraph {
  font-size: 0.95rem;
  line-height: 1.7;
  color: var(--color-text);
}

.story-paragraph + .story-paragraph {
  margin-top: var(--space-2);
}

.facts td {
  padding-top: var(--space-2);
  padding-bottom: var(--space-2);
}

.lap-summary {
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-muted);
}
</style>
