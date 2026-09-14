<script setup lang="ts">
import { raceStatusLabel, raceTagLabel } from '#shared/constants'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const { data: race, error } = await useFetch(`/api/results/races/${id}`)
const actionError = ref('')

async function deleteRace() {
  if (!confirm('Deze rit verwijderen?')) return
  actionError.value = ''
  try {
    await $fetch(`/api/results/races/${id}`, { method: 'DELETE' })
    router.push('/results/races')
  } catch {
    actionError.value = 'Verwijderen mislukt.'
  }
}

async function deleteAndBlacklist() {
  if (!confirm('Deze rit verwijderen en blacklisten (niet opnieuw voorstellen bij import)?')) return
  actionError.value = ''
  try {
    await $fetch(`/api/results/races/${id}/blacklist`, { method: 'POST' })
    router.push('/results/races')
  } catch {
    actionError.value = 'Verwijderen mislukt.'
  }
}

const sourceLabels: Record<string, string> = {
  osta: 'OSTA',
  ssr: 'SpeedSkatingResults',
  pdf: 'PDF',
  manual: 'Handmatig',
}

const autoImportNoteRegex = /^Geimporteerd van (OSTA|SpeedSkatingResults)(: https?:\/\/\S+)?$/

const sourceLabel = computed(() => (race.value ? sourceLabels[race.value.source] ?? race.value.source : ''))
const sourceIsLink = computed(() => !!race.value?.sourceRef && /^https?:\/\//.test(race.value.sourceRef))
const displayNotes = computed(() => {
  const notes = race.value?.notes
  if (!notes || autoImportNoteRegex.test(notes)) return null
  return notes
})
</script>

<template>
  <div v-if="race" class="space-y-6 max-w-2xl">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="page-title break-words">{{ race.distanceM }}m &middot; {{ race.competitionName }}</h1>
        <p class="text-secondary mt-1">
          {{ race.venue || '-' }} &middot;
          <span class="font-mono">{{ fmtDate(race.competitionDate) }}</span> &middot;
          {{ race.trackType === 'outdoor' ? 'Buitenbaan' : 'Binnenbaan' }}
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink :to="`/results/races/${id}/edit`" class="btn btn-secondary btn-sm">
          Bewerken
        </NuxtLink>
        <NuxtLink :to="`/results/races/${id}/compare`" class="btn btn-secondary btn-sm">
          Vergelijken
        </NuxtLink>
        <details class="menu">
          <summary class="btn btn-secondary btn-sm" aria-label="Meer acties">&hellip;</summary>
          <div class="menu-panel">
            <button type="button" class="btn btn-danger btn-sm" @click="deleteRace">
              Verwijderen
            </button>
            <button type="button" class="btn btn-danger btn-sm" @click="deleteAndBlacklist">
              Verwijder + blacklist
            </button>
          </div>
        </details>
      </div>
    </div>

    <p v-if="actionError" class="text-sm" style="color: var(--color-danger)">{{ actionError }}</p>

    <!-- Result summary: the primary information on this page. -->
    <section class="card card-lane-accent">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div class="stat-label">Eindtijd</div>
          <div class="stat-value-lg mt-0.5">
            {{ fmtMs(race.totalTimeMs) }}
            <span v-if="race.isPr" class="badge badge-pr align-middle">PR</span>
            <span v-else-if="race.isSb" class="badge badge-sb align-middle">SB</span>
          </div>
        </div>
        <div class="text-right">
          <div class="stat-label">T.o.v. vorige PR</div>
          <div class="stat-value-sm mt-0.5">
            <span v-if="race.deltaVsPreviousPrMs === null" class="delta-neutral">-</span>
            <span v-else :class="race.deltaVsPreviousPrMs <= 0 ? 'delta-better' : 'delta-worse'">
              {{ race.deltaVsPreviousPrMs > 0 ? '+' : '' }}{{ fmtMs(race.deltaVsPreviousPrMs) }}
            </span>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-4" style="border-top: 1px solid var(--highlight-soft)">
        <div>
          <div class="stat-label">Status</div>
          <div class="text-secondary mt-0.5">{{ raceStatusLabel(race.status) }}</div>
        </div>
        <div>
          <div class="stat-label">Tag</div>
          <div class="text-secondary mt-0.5">{{ raceTagLabel(race.tag) }}</div>
        </div>
      </div>
    </section>

    <section v-if="race.splitRows.length">
      <h2 class="section-heading mb-2">Splits</h2>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Afstand</th>
              <th class="num">Tijd</th>
              <th class="num">Per 400m</th>
              <th class="num">Delta</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in race.splitRows" :key="row.index">
              <td class="text-meta">{{ row.index }}</td>
              <td class="text-meta">{{ row.distanceM }}m</td>
              <td class="num font-mono">{{ row.seconds.toFixed(2) }}</td>
              <td class="num font-mono text-secondary">{{ row.per400Eq?.toFixed(2) ?? '-' }}</td>
              <td class="num font-mono">
                <span v-if="row.deltaPrev400Eq === null" class="delta-neutral">-</span>
                <span v-else :class="row.deltaPrev400Eq <= 0 ? 'delta-better' : 'delta-worse'">
                  {{ row.deltaPrev400Eq > 0 ? '+' : '' }}{{ row.deltaPrev400Eq.toFixed(2) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-meta mt-2">
        Gemiddelde per 400m: {{ race.metrics.avg400?.toFixed(2) ?? '-' }} &middot;
        Fade: {{ race.metrics.fade400Eq?.toFixed(2) ?? '-' }}
      </p>
    </section>

    <section v-if="displayNotes">
      <h2 class="section-heading mb-2">Notities</h2>
      <p class="text-sm whitespace-pre-line text-secondary">{{ displayNotes }}</p>
    </section>

    <!-- Low-value technical metadata: kept out of the way, below the result. -->
    <details class="group">
      <summary class="section-heading cursor-pointer select-none inline-flex items-center gap-1">
        Technische informatie
      </summary>
      <div class="mt-3 flex flex-wrap gap-x-6 gap-y-3 text-sm">
        <div v-if="race.lane">
          <div class="stat-label">Baan</div>
          <div class="text-secondary mt-0.5">{{ race.lane }}</div>
        </div>
        <div v-if="race.opponent">
          <div class="stat-label">Tegenstander</div>
          <div class="text-secondary mt-0.5">{{ race.opponent }}</div>
        </div>
        <div v-if="race.category">
          <div class="stat-label">Categorie</div>
          <div class="text-secondary mt-0.5">{{ race.category }}</div>
        </div>
        <div>
          <div class="stat-label">Bron</div>
          <div class="mt-0.5">
            <a
              v-if="sourceIsLink"
              :href="race.sourceRef!"
              target="_blank"
              rel="noopener noreferrer"
              class="text-secondary hover:!text-[var(--color-accent)] hover:underline"
            >
              {{ sourceLabel }} &#8599;
            </a>
            <span v-else class="text-secondary">{{ sourceLabel }}</span>
          </div>
        </div>
      </div>
    </details>
  </div>
  <p v-else-if="error" style="color: var(--color-danger)">Rit niet gevonden.</p>
</template>
