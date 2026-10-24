<script setup lang="ts">
import type { AvailableCompetition, OstaDetectionResult } from '~~/server/utils/osta-monitor'

const route = useRoute()
const router = useRouter()

// A URL without `trendSeason` is "just opened": the server then shows the
// current season. `trendSeason=` (empty) is an explicit "all seasons".
const trendSeasonParam = computed(() =>
  route.query.trendSeason === undefined ? undefined : String(route.query.trendSeason),
)
const { data, refresh } = await useFetch('/api/dashboard/overview', {
  query: { trendSeason: trendSeasonParam },
})

const trendSeasonSelect = ref(data.value?.selectedTrendSeason ?? '')
watch(data, (d) => {
  trendSeasonSelect.value = d?.selectedTrendSeason ?? ''
})

function applyTrendSeason() {
  router.replace({ query: { trendSeason: trendSeasonSelect.value } })
}

// ---- OSTA monitor ------------------------------------------------------
// Checked client-side after the page renders, like the old app's async
// banner -- it makes an outbound OSTA request per linked profile.
const detection = ref<OstaDetectionResult | null>(null)
const available = ref<AvailableCompetition[]>([])
const later = ref(false)
const busy = ref(false)
const flash = ref<{ tone: 'success' | 'warning'; text: string } | null>(null)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

onMounted(async () => {
  try {
    const result = await $fetch<OstaDetectionResult>('/api/dashboard/osta-detection', { method: 'POST' })
    detection.value = result
    available.value = result.available
    if (result.autoImported) {
      flash.value = {
        tone: 'success',
        text: `OSTA automatisch geïmporteerd: ${plural(result.autoImported.competitions, 'wedstrijd', 'wedstrijden')} en ${plural(result.autoImported.races, 'rit', 'ritten')} toegevoegd.`,
      }
      await refresh()
    }
  } catch {
    // The banner is a convenience; the dashboard works without it.
  }
})

async function ignoreCompetition(item: AvailableCompetition) {
  if (!detection.value?.batchId || busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/import/preview/${detection.value.batchId}/blacklist-competition`, {
      method: 'POST',
      body: { competitionSignature: item.competitionSignature },
    })
    available.value = available.value.filter((a) => a.competitionSignature !== item.competitionSignature)
    flash.value = { tone: 'success', text: `${item.name} wordt niet meer voorgesteld.` }
  } catch {
    flash.value = { tone: 'warning', text: 'Negeren is niet gelukt.' }
  } finally {
    busy.value = false
  }
}

async function importAll() {
  if (!detection.value?.batchId || busy.value) return
  busy.value = true
  try {
    const result = await $fetch<{ importedRaces: number }>(`/api/import/preview/${detection.value.batchId}/commit`, {
      method: 'POST',
      body: {},
    })
    available.value = []
    flash.value = result.importedRaces
      ? { tone: 'success', text: `OSTA geïmporteerd: ${plural(result.importedRaces, 'rit', 'ritten')} toegevoegd.` }
      : { tone: 'warning', text: 'Geen nieuwe OSTA-data gevonden.' }
    await refresh()
  } catch {
    flash.value = { tone: 'warning', text: 'OSTA-import is niet gelukt.' }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="page-title">Overzicht</h1>

    <p v-if="flash" class="notice" :class="flash.tone === 'success' ? 'notice-accent' : ''" role="status">
      {{ flash.text }}
    </p>
    <p v-for="e in detection?.errors ?? []" :key="e.pid" class="notice" role="status">{{ e.message }}</p>

    <section v-if="available.length && !later" class="card space-y-3" aria-labelledby="osta-new-title">
      <div>
        <h2 id="osta-new-title" class="card-title">Nieuwe OSTA-data beschikbaar</h2>
        <p class="text-secondary text-sm">
          {{ plural(available.length, 'wedstrijd', 'wedstrijden') }} met nieuwe ritten gevonden.
        </p>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Wedstrijd</th>
              <th class="num">Datum</th>
              <th class="num">Ritten</th>
              <th class="num">Actie</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in available" :key="item.competitionSignature">
              <td>{{ item.name }}</td>
              <td class="num text-meta">{{ fmtDate(item.date) }}</td>
              <td class="num font-mono">{{ item.newRaceCount }}</td>
              <td class="num">
                <button type="button" class="btn btn-secondary btn-sm" :disabled="busy" @click="ignoreCompetition(item)">
                  Negeer
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary btn-sm" :disabled="busy" @click="importAll">Importeer alles</button>
        <NuxtLink :to="`/import/preview?batchId=${detection?.batchId}`" class="btn btn-secondary btn-sm">Bekijken</NuxtLink>
        <button type="button" class="btn btn-secondary btn-sm" @click="later = true">Later</button>
      </div>
    </section>

    <section v-if="data && data.raceCount === 0" class="empty-state">
      Er is nog geen data. <NuxtLink to="/import" class="underline">Importeer</NuxtLink> of
      <NuxtLink to="/results/races/new" class="underline">voeg handmatig een rit toe</NuxtLink>.
    </section>

    <section
      v-if="data && (data.notifications.recentPrs.length || data.notifications.recentSbs.length || data.notifications.streakCount > 1)"
      class="notice flex-wrap"
    >
      <div class="flex flex-wrap items-center gap-2">
        <span v-if="data.notifications.streakCount > 1" class="tag tag-streak">
          🔥 {{ data.notifications.streakCount }} PR's op rij
        </span>
        <NuxtLink
          v-for="r in data.notifications.recentPrs"
          :key="`pr-${r.raceId}`"
          :to="`/results/races/${r.raceId}`"
          class="tag"
        >
          PR {{ r.distanceM }}m &middot; {{ fmtMs(r.totalTimeMs) }}
        </NuxtLink>
        <NuxtLink
          v-for="r in data.notifications.recentSbs"
          :key="`sb-${r.raceId}`"
          :to="`/results/races/${r.raceId}`"
          class="tag"
        >
          SB {{ r.distanceM }}m &middot; {{ fmtMs(r.totalTimeMs) }}
        </NuxtLink>
      </div>
    </section>

    <section v-if="data" class="card card-lane-accent">
      <div class="grid grid-cols-3 gap-x-4 gap-y-6">
        <div>
          <div class="stat-label">Wedstrijden</div>
          <div class="stat-value-lg">{{ data.competitionCount }}</div>
        </div>
        <div>
          <div class="stat-label">Ritten</div>
          <div class="stat-value-lg">{{ data.raceCount }}</div>
        </div>
        <div>
          <div class="stat-label">PR's</div>
          <div class="stat-value-lg" style="color: var(--color-accent)">{{ data.prCount }}</div>
        </div>
      </div>
      <div
        class="grid grid-cols-3 gap-x-4 gap-y-6 mt-5 pt-4"
        style="border-top: 1px solid var(--highlight-soft)"
      >
        <div class="hidden sm:block">
          <div class="stat-label">Favoriete locatie</div>
          <div class="text-secondary font-medium mt-0.5">{{ data.favoriteVenue || '-' }}</div>
        </div>
        <div class="hidden sm:block">
          <div class="stat-label">Favoriete afstand</div>
          <div class="text-secondary font-mono mt-0.5">{{ data.favoriteDistance ? `${data.favoriteDistance}m` : '-' }}</div>
        </div>
        <NuxtLink to="/progress/stats" class="col-span-3 sm:col-span-1 group">
          <div class="stat-label">Meer statistieken</div>
          <div class="font-medium mt-0.5 group-hover:underline" style="color: var(--color-accent)">Bekijk alles &rarr;</div>
        </NuxtLink>
      </div>
    </section>

    <div class="grid md:grid-cols-2 gap-5">
      <section class="card">
        <h2 class="card-title mb-3">Beste tijden per afstand</h2>
        <div v-if="data?.bestTimes.length" class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Afstand</th>
                <th class="num">Beste tijd</th>
                <th class="num">Datum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in data.bestTimes" :key="r.distanceM" class="table-row-link">
                <td class="font-mono">
                  <NuxtLink :to="`/results/races/${r.raceId}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
                </td>
                <td class="num">
                  <span class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
                  <span v-if="r.isRecentPr" class="badge badge-pr ml-1">PR</span>
                </td>
                <td class="num text-meta">{{ fmtDate(r.competitionDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="text-secondary">Nog geen geldige tijden.</p>
      </section>

      <section class="card">
        <h2 class="card-title mb-3">Laatste wedstrijd</h2>
        <template v-if="data?.latestCompetition">
          <p class="mb-3">
            <NuxtLink
              :to="`/results/competitions/${data.latestCompetition.competitionId}`"
              class="font-medium hover:underline"
            >
              {{ data.latestCompetition.name }}
            </NuxtLink>
            <span class="text-meta">
              &middot; {{ data.latestCompetition.venue || '-' }} &middot;
              <span class="font-mono">{{ fmtDate(data.latestCompetition.date) }}</span>
            </span>
          </p>
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Rit</th>
                  <th class="num">Opening</th>
                  <th class="num">Eindtijd</th>
                  <th class="num">T.o.v. PR</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.latestCompetition.races" :key="r.raceId" class="table-row-link">
                  <td class="font-mono">
                    <NuxtLink :to="`/results/races/${r.raceId}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
                  </td>
                  <td class="num text-meta">{{ r.openingMs === null ? '-' : fmtMs(r.openingMs) }}</td>
                  <td class="num">
                    <span class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
                    <span v-if="r.isPr" class="badge badge-pr ml-1">PR</span>
                  </td>
                  <td class="num">
                    <span v-if="r.isPr" class="delta-neutral">PR</span>
                    <span v-else-if="r.deltaVsPreviousPrMs === null" class="delta-neutral">-</span>
                    <span v-else :class="r.deltaVsPreviousPrMs <= 0 ? 'delta-better' : 'delta-worse'">
                      {{ r.deltaVsPreviousPrMs > 0 ? '+' : '' }}{{ fmtMs(r.deltaVsPreviousPrMs) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <p v-else class="text-secondary">Nog geen ritten.</p>
      </section>
    </div>

    <section v-if="data" id="home-trends-section">
      <div class="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h2 class="section-heading">Ontwikkeling per afstand</h2>
        <label v-if="data.trendSeasonOptions.length" class="flex items-center gap-2 text-sm">
          <span class="text-secondary">Seizoen</span>
          <select
            v-model="trendSeasonSelect"
            class="field"
            style="width: auto"
            aria-label="Filter op seizoen"
            @change="applyTrendSeason"
          >
            <option value="">Alle seizoenen</option>
            <option v-for="s in data.trendSeasonOptions" :key="s" :value="s">{{ s }}</option>
          </select>
        </label>
      </div>
      <div v-if="data.trends.length" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="trend in data.trends" :key="trend.distanceM" class="card">
          <div class="flex items-baseline justify-between mb-2">
            <div class="font-mono text-sm font-medium">{{ trend.distanceM }}m</div>
            <div v-if="trend.deltaMs !== null" class="text-xs font-mono flex items-center gap-1.5">
              <span v-if="Math.abs(trend.deltaMs) >= 10" :class="trend.deltaMs <= 0 ? 'delta-better' : 'delta-worse'">
                {{ trend.deltaMs <= 0 ? '↓' : '↑' }}
                {{ (Math.abs(trend.deltaMs) / 1000).toFixed(1) }}s
              </span>
              <span class="text-meta">best {{ fmtMs(trend.bestMs) }}</span>
            </div>
          </div>
          <TrendSparkline :sparkline="trend.sparkline" :distance-m="trend.distanceM" :latest="trend.latest" />
        </div>
      </div>
      <p v-else class="empty-state">Nog onvoldoende data voor grafieken.</p>
    </section>
  </div>
</template>
