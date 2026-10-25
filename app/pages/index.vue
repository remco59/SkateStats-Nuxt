<script setup lang="ts">
import type { AvailableCompetition, OstaDetectionResult } from '~~/server/utils/osta-monitor'
import { raceStatusLabel } from '#shared/constants'

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

const isEmpty = computed(() => data.value?.raceCount === 0)

// A race that is both a PR and a season best is shown once, as the PR.
const recentSbs = computed(() => {
  const prIds = new Set(data.value?.notifications.recentPrs.map((r) => r.raceId))
  return (data.value?.notifications.recentSbs ?? []).filter((r) => !prIds.has(r.raceId))
})

// ---- OSTA monitor ------------------------------------------------------
// Checked client-side after the page renders, like the old app's async
// banner -- it makes an outbound OSTA request per linked profile. The
// check shows its state in the header and the result lands below the lead
// card, so nothing the skater is reading moves when it arrives.
type OstaState = 'checking' | 'done' | 'error'

const LATER_KEY = 'skatestats:osta-later-batch'
const UNDO_MS = 6000

const ostaState = ref<OstaState>('checking')
const detection = ref<OstaDetectionResult | null>(null)
const available = ref<AvailableCompetition[]>([])
const later = ref(false)
const busy = ref(false)
const flash = ref<{ tone: 'success' | 'warning'; text: string } | null>(null)

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function readLater(batchId: string | null | undefined) {
  if (!batchId) return false
  try {
    return sessionStorage.getItem(LATER_KEY) === String(batchId)
  } catch {
    return false
  }
}

function postponeBatch() {
  later.value = true
  try {
    if (detection.value?.batchId) sessionStorage.setItem(LATER_KEY, String(detection.value.batchId))
  } catch {
    // Remembering "later" for this tab is a convenience only.
  }
}

async function checkOsta() {
  ostaState.value = 'checking'
  try {
    const result = await $fetch<OstaDetectionResult>('/api/dashboard/osta-detection', { method: 'POST' })
    detection.value = result
    available.value = result.available
    later.value = readLater(result.batchId)
    ostaState.value = 'done'
    if (result.autoImported) {
      flash.value = {
        tone: 'success',
        text: `OSTA automatisch geïmporteerd: ${plural(result.autoImported.competitions, 'wedstrijd', 'wedstrijden')} en ${plural(result.autoImported.races, 'rit', 'ritten')} toegevoegd.`,
      }
      await refresh()
    }
  } catch {
    ostaState.value = 'error'
  }
}

onMounted(checkOsta)

// "Negeer" blacklists a competition for good, so it waits a few seconds
// behind an undo before it is sent to the server.
const pendingIgnore = ref<{ item: AvailableCompetition; index: number } | null>(null)
let undoTimer: ReturnType<typeof setTimeout> | null = null

function clearUndoTimer() {
  if (undoTimer) clearTimeout(undoTimer)
  undoTimer = null
}

async function flushIgnore() {
  clearUndoTimer()
  const pending = pendingIgnore.value
  if (!pending || !detection.value?.batchId) return
  pendingIgnore.value = null
  try {
    await $fetch(`/api/import/preview/${detection.value.batchId}/blacklist-competition`, {
      method: 'POST',
      body: { competitionSignature: pending.item.competitionSignature },
    })
  } catch {
    available.value.splice(Math.min(pending.index, available.value.length), 0, pending.item)
    flash.value = {
      tone: 'warning',
      text: `${pending.item.name} negeren is niet gelukt. Hij staat weer in de lijst; probeer het opnieuw.`,
    }
  }
}

function ignoreCompetition(item: AvailableCompetition) {
  if (pendingIgnore.value) void flushIgnore()
  const index = available.value.findIndex((a) => a.competitionSignature === item.competitionSignature)
  available.value = available.value.filter((a) => a.competitionSignature !== item.competitionSignature)
  pendingIgnore.value = { item, index }
  clearUndoTimer()
  undoTimer = setTimeout(flushIgnore, UNDO_MS)
}

function undoIgnore() {
  clearUndoTimer()
  const pending = pendingIgnore.value
  if (!pending) return
  pendingIgnore.value = null
  available.value.splice(Math.min(pending.index, available.value.length), 0, pending.item)
}

onBeforeUnmount(() => {
  void flushIgnore()
})

async function importAll() {
  if (!detection.value?.batchId || busy.value) return
  busy.value = true
  try {
    await flushIgnore()
    const result = await $fetch<{ importedRaces: number }>(`/api/import/preview/${detection.value.batchId}/commit`, {
      method: 'POST',
      body: {},
    })
    available.value = []
    flash.value = result.importedRaces
      ? { tone: 'success', text: `OSTA geïmporteerd: ${plural(result.importedRaces, 'rit', 'ritten')} toegevoegd.` }
      : { tone: 'warning', text: 'Er was geen nieuwe OSTA-data om te importeren.' }
    await refresh()
  } catch {
    flash.value = {
      tone: 'warning',
      text: 'Importeren vanuit OSTA is niet gelukt. Er is niets toegevoegd; probeer het opnieuw of bekijk eerst de ritten.',
    }
  } finally {
    busy.value = false
  }
}

// ---- Display helpers -----------------------------------------------------
/** Difference to the PR before this race: "−0.42" (faster) / "+0.87" (slower). */
function fmtGap(ms: number) {
  const seconds = (Math.abs(ms) / 1000).toFixed(2)
  if (ms < 0) return `−${seconds}`
  return ms > 0 ? `+${seconds}` : seconds
}

function gapSpeech(ms: number) {
  const seconds = (Math.abs(ms) / 1000).toFixed(2)
  if (ms < 0) return `${seconds} seconde sneller dan je vorige PR`
  return ms > 0 ? `${seconds} seconde trager dan je PR` : 'gelijk aan je PR'
}
</script>

<template>
  <div class="dash">
    <div class="dash-head">
      <h1 class="page-title">Overzicht</h1>
      <p class="osta-status text-secondary" role="status">
        <template v-if="ostaState === 'checking'">
          <span class="spinner" aria-hidden="true" />
          OSTA controleren…
        </template>
        <template v-else-if="ostaState === 'error'">
          OSTA controleren is niet gelukt.
          <button type="button" class="btn-link" @click="checkOsta">Opnieuw proberen</button>
        </template>
        <template v-else-if="available.length && !later">
          <a href="#osta-new" class="btn-link">{{ plural(available.length, 'wedstrijd', 'wedstrijden') }} met nieuwe OSTA-data</a>
        </template>
      </p>
    </div>

    <div
      v-if="flash"
      class="notice"
      :class="flash.tone === 'success' ? 'notice-accent' : 'notice-warning'"
      :role="flash.tone === 'success' ? 'status' : 'alert'"
    >
      <span>{{ flash.text }}</span>
      <button type="button" class="btn btn-ghost btn-sm" @click="flash = null">Sluiten</button>
    </div>
    <p v-for="e in detection?.errors ?? []" :key="e.pid" class="notice" role="status">{{ e.message }}</p>

    <!-- First run: nothing to show yet, so say how to begin. -->
    <section v-if="data && isEmpty" class="card card-lane-accent" aria-labelledby="start-title">
      <h2 id="start-title" class="section-title">Welkom bij SkateStats</h2>
      <p class="text-secondary start-lead">
        Zodra je eerste ritten erin staan, zie je hier je laatste wedstrijd, je beste tijd per afstand en hoe je
        schaatst ten opzichte van je PR.
      </p>
      <ul class="start-actions">
        <li>
          <p class="start-label">Tijden ophalen</p>
          <p class="text-secondary">Importeer uit OSTA, SpeedSkatingResults of een PDF-uitslag.</p>
          <NuxtLink to="/import" class="btn btn-primary">Importeren</NuxtLink>
        </li>
        <li>
          <p class="start-label">Zelf invoeren</p>
          <p class="text-secondary">Voeg een wedstrijd en de ritten met de hand toe.</p>
          <NuxtLink to="/results/races/new" class="btn btn-secondary">Rit toevoegen</NuxtLink>
        </li>
      </ul>
    </section>

    <template v-if="data && !isEmpty">
      <div class="dash-main">
        <!-- The latest result against the PR: the first thing a skater wants. -->
        <section v-if="data.latestCompetition" class="card card-lane-accent hero" aria-labelledby="latest-title">
          <p class="text-secondary hero-meta">
            {{ data.latestCompetition.venue || 'Onbekende locatie' }} &middot;
            <span class="font-mono">{{ fmtDate(data.latestCompetition.date) }}</span>
          </p>
          <h2 id="latest-title" class="hero-title">
            <NuxtLink :to="`/results/competitions/${data.latestCompetition.competitionId}`" class="hero-link">
              {{ data.latestCompetition.name }}
            </NuxtLink>
          </h2>

          <div class="result-head text-meta" aria-hidden="true">
            <span>Afstand</span>
            <span>Eindtijd</span>
            <span class="result-head-gap">Verschil met PR</span>
          </div>
          <ul class="result-list">
            <li v-for="r in data.latestCompetition.races" :key="r.raceId" class="result-row table-row-link">
              <NuxtLink :to="`/results/races/${r.raceId}`" class="result-dist font-mono stretched-link">
                {{ r.distanceM }}&nbsp;m
              </NuxtLink>
              <span class="result-main">
                <template v-if="r.status === 'finished'">
                  <span class="result-time">{{ fmtMs(r.totalTimeMs) }}</span>
                  <abbr v-if="r.isPr" class="badge badge-pr" title="Persoonlijk record">PR</abbr>
                  <span v-if="r.openingMs !== null" class="result-opening text-meta">
                    opening <span class="font-mono">{{ fmtMs(r.openingMs) }}</span>
                  </span>
                </template>
                <span v-else class="result-time result-status">{{ raceStatusLabel(r.status) }}</span>
              </span>
              <span class="result-gap font-mono">
                <template v-if="r.status !== 'finished'">
                  <span class="delta-neutral">-</span>
                </template>
                <template v-else-if="r.deltaVsPreviousPrMs === null">
                  <span class="delta-neutral">{{ r.isPr ? 'eerste tijd' : '-' }}</span>
                </template>
                <template v-else>
                  <span :class="r.deltaVsPreviousPrMs <= 0 ? 'delta-better' : 'delta-worse'" aria-hidden="true">
                    {{ fmtGap(r.deltaVsPreviousPrMs) }}
                  </span>
                  <span class="sr-only">{{ gapSpeech(r.deltaVsPreviousPrMs) }}</span>
                </template>
              </span>
            </li>
          </ul>

          <div
            v-if="data.notifications.recentPrs.length || recentSbs.length || data.notifications.streakCount > 1"
            class="records"
          >
            <h3 class="sr-only">Recente records</h3>
            <span v-if="data.notifications.streakCount > 1" class="tag tag-streak">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3c.6 3.2-2.8 4.6-2.8 8a4 4 0 008 0c0-1.7-.8-2.8-1.4-3.6-.4 1.1-1 1.7-1.8 1.9.3-2.2.2-4.6-2-6.3z"
                  stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"
                />
              </svg>
              {{ data.notifications.streakCount }} PR's op rij
            </span>
            <NuxtLink
              v-for="r in data.notifications.recentPrs"
              :key="`pr-${r.raceId}`"
              :to="`/results/races/${r.raceId}`"
              class="tag"
            >
              <abbr class="badge badge-pr" title="Persoonlijk record">PR</abbr>
              {{ r.distanceM }}&nbsp;m &middot; {{ fmtMs(r.totalTimeMs) }}
            </NuxtLink>
            <NuxtLink
              v-for="r in recentSbs"
              :key="`sb-${r.raceId}`"
              :to="`/results/races/${r.raceId}`"
              class="tag"
            >
              <abbr class="badge badge-sb" title="Seizoensbeste">SB</abbr>
              {{ r.distanceM }}&nbsp;m &middot; {{ fmtMs(r.totalTimeMs) }}
            </NuxtLink>
          </div>

          <p class="text-meta legend">
            PR = persoonlijk record, SB = seizoensbeste. Verschil = jouw tijd min je beste tijd tot dan toe.
          </p>
        </section>

        <section class="best" aria-labelledby="best-title">
          <h2 id="best-title" class="section-title">Beste tijden per afstand</h2>
          <div v-if="data.bestTimes.length" class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Afstand</th>
                  <th scope="col" class="num">Beste tijd</th>
                  <th scope="col" class="num">Datum</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in data.bestTimes" :key="r.distanceM" class="table-row-link">
                  <td class="font-mono best-dist">
                    <NuxtLink :to="`/results/races/${r.raceId}`" class="stretched-link">{{ r.distanceM }}&nbsp;m</NuxtLink>
                  </td>
                  <td class="num">
                    <abbr
                      v-if="r.isRecentPr"
                      class="badge badge-pr"
                      title="Nieuw PR: gereden in de afgelopen 7 dagen"
                    >PR</abbr>
                    <span class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
                  </td>
                  <td class="num text-meta font-mono">{{ fmtDate(r.competitionDate) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-secondary">Nog geen geldige tijden.</p>
        </section>
      </div>

      <!-- New OSTA data: below the lead card on purpose, see checkOsta(). -->
      <div v-if="pendingIgnore || (available.length && !later)" id="osta-new" class="osta">
        <p v-if="pendingIgnore" class="notice" role="status">
          <span>{{ pendingIgnore.item.name }} wordt niet meer voorgesteld.</span>
          <button type="button" class="btn btn-ghost btn-sm" @click="undoIgnore">Ongedaan maken</button>
        </p>
        <section v-if="available.length && !later" class="card" aria-labelledby="osta-new-title">
          <h2 id="osta-new-title" class="card-title">Nieuwe OSTA-data beschikbaar</h2>
          <p class="text-secondary">
            {{ plural(available.length, 'wedstrijd', 'wedstrijden') }} met ritten die nog niet in SkateStats staan.
          </p>
          <ul class="osta-list">
            <li v-for="item in available" :key="item.competitionSignature" class="osta-item">
              <div class="osta-item-text">
                <p class="osta-name">{{ item.name }}</p>
                <p class="text-meta">
                  <span class="font-mono">{{ fmtDate(item.date) }}</span> &middot;
                  {{ plural(item.newRaceCount, 'nieuwe rit', 'nieuwe ritten') }}
                </p>
              </div>
              <button type="button" class="btn btn-ghost btn-sm" @click="ignoreCompetition(item)">
                Niet meer voorstellen
              </button>
            </li>
          </ul>
          <div class="osta-actions">
            <button type="button" class="btn btn-primary" :disabled="busy" @click="importAll">
              {{ busy ? 'Importeren…' : 'Alles importeren' }}
            </button>
            <NuxtLink :to="`/import/preview?batchId=${detection?.batchId}`" class="btn btn-secondary">Eerst bekijken</NuxtLink>
            <button type="button" class="btn btn-ghost" @click="postponeBatch">Later</button>
          </div>
        </section>
      </div>

      <section id="home-trends-section" aria-labelledby="trends-title">
        <div class="trends-head">
          <h2 id="trends-title" class="section-title">Ontwikkeling per afstand</h2>
          <label v-if="data.trendSeasonOptions.length" class="trends-filter">
            <span class="text-secondary">Seizoen</span>
            <select
              v-model="trendSeasonSelect"
              class="field"
              style="width: auto"
              @change="applyTrendSeason"
            >
              <option value="">Alle seizoenen</option>
              <option v-for="s in data.trendSeasonOptions" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
        </div>
        <div v-if="data.trends.length" class="trend-grid">
          <div v-for="trend in data.trends" :key="trend.distanceM" class="card trend-card">
            <div class="trend-top">
              <h3 class="trend-dist font-mono">{{ trend.distanceM }}&nbsp;m</h3>
              <p v-if="trend.deltaMs !== null" class="trend-meta font-mono">
                <span v-if="Math.abs(trend.deltaMs) >= 10" :class="trend.deltaMs <= 0 ? 'delta-better' : 'delta-worse'">
                  {{ trend.deltaMs <= 0 ? '↓' : '↑' }}
                  {{ (Math.abs(trend.deltaMs) / 1000).toFixed(1) }}s
                </span>
                <span class="text-meta">beste {{ fmtMs(trend.bestMs) }}</span>
              </p>
            </div>
            <TrendSparkline :sparkline="trend.sparkline" :distance-m="trend.distanceM" :latest="trend.latest" />
          </div>
        </div>
        <p v-else class="empty-state">Nog onvoldoende data voor grafieken.</p>
      </section>

      <!-- Counts are context, not the headline. -->
      <section class="facts" aria-label="Totalen">
        <dl class="facts-list">
          <div><dt class="text-meta">Wedstrijden</dt><dd class="font-mono">{{ data.competitionCount }}</dd></div>
          <div><dt class="text-meta">Ritten</dt><dd class="font-mono">{{ data.raceCount }}</dd></div>
          <div><dt class="text-meta">PR's</dt><dd class="font-mono">{{ data.prCount }}</dd></div>
          <div><dt class="text-meta">Favoriete locatie</dt><dd>{{ data.favoriteVenue || '-' }}</dd></div>
          <div>
            <dt class="text-meta">Favoriete afstand</dt>
            <dd class="font-mono">{{ data.favoriteDistance ? `${data.favoriteDistance}\u00a0m` : '-' }}</dd>
          </div>
        </dl>
        <NuxtLink to="/progress/stats" class="facts-link">Alle statistieken &rarr;</NuxtLink>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dash {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.dash-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  min-height: 2.25rem;
}

.osta-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
}

.spinner {
  width: 0.9rem;
  height: 0.9rem;
  border-radius: 50%;
  border: 2px solid var(--color-border-strong);
  border-top-color: var(--color-accent);
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ---- First run ---------------------------------------------------------- */
.start-lead {
  max-width: 60ch;
  margin-top: var(--space-2);
}

.start-actions {
  display: grid;
  gap: var(--space-5);
  margin: var(--space-5) 0 0;
  padding: 0;
  list-style: none;
}

.start-actions li {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.start-label {
  font-family: var(--font-display);
  font-size: 1.125rem;
  font-weight: 600;
}

@media (min-width: 640px) {
  .start-actions {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-6);
  }
}

/* ---- Lead card + best times -------------------------------------------- */
.dash-main {
  display: grid;
  gap: var(--space-6);
}

@media (min-width: 1024px) {
  .dash-main {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: start;
  }
}

.hero-meta {
  margin: 0;
}

.hero-title {
  margin-top: var(--space-1);
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1.1;
}

.hero-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.result-head,
.result-row {
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
}

.result-head {
  margin-top: var(--space-5);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--color-border-strong);
}

.result-head-gap {
  text-align: right;
}

.result-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.result-row {
  min-height: 3.75rem;
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--color-border);
}

.result-row:last-child {
  border-bottom: none;
}

.result-dist {
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.2;
}

.result-main {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
}

.result-time {
  font-family: var(--font-data);
  font-variant-numeric: tabular-nums lining-nums;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.1;
}

.result-status {
  font-size: 1.25rem;
  color: var(--color-text-muted);
}

.result-opening {
  flex-basis: 100%;
}

.result-gap {
  font-size: 1.25rem;
  font-weight: 600;
  text-align: right;
}

.records {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.legend {
  margin-top: var(--space-4);
  max-width: 60ch;
}

.best {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.best-dist {
  font-size: 1.125rem;
  font-weight: 600;
  min-height: 2.75rem;
}

.best .table .badge {
  margin-right: var(--space-2);
}

.best .table td {
  padding-top: var(--space-3);
  padding-bottom: var(--space-3);
}

/* ---- OSTA --------------------------------------------------------------- */
.osta {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  scroll-margin-top: 4.5rem;
}

.osta .card {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.osta-list {
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
}

.osta-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  padding: var(--space-3) 0;
  border-top: 1px solid var(--color-border);
}

.osta-item-text {
  min-width: 0;
}

.osta-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.osta-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

/* ---- Trends ------------------------------------------------------------- */
.trends-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.trends-filter {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.trend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-4);
}

.trend-top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  margin-bottom: var(--space-2);
}

.trend-dist {
  font-size: 1.25rem;
  font-weight: 600;
}

.trend-meta {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  margin: 0;
  font-size: 0.9375rem;
}

/* ---- Totals ------------------------------------------------------------- */
.facts {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  padding-top: var(--space-5);
  border-top: 1px solid var(--color-border-strong);
}

.facts-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
  margin: 0;
}

.facts-list dd {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  line-height: 1.3;
}

.facts-link {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  font-weight: 600;
  color: var(--color-accent);
}

.facts-link:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
