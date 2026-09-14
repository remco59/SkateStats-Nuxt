<script setup lang="ts">
import { raceStatusLabel } from '#shared/constants'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const { data, error } = await useFetch(`/api/results/competitions/${id}`)
const actionError = ref('')

async function deleteCompetition() {
  if (!confirm('Wedstrijd (en alle ritten erin) verwijderen?')) return
  actionError.value = ''
  try {
    await $fetch(`/api/results/competitions/${id}`, { method: 'DELETE' })
    router.push('/results/competitions')
  } catch {
    actionError.value = 'Verwijderen mislukt.'
  }
}

async function deleteAndBlacklist() {
  if (!confirm('Wedstrijd verwijderen en blacklisten (niet meer voorstellen bij import)?')) return
  actionError.value = ''
  try {
    await $fetch(`/api/results/competitions/${id}/blacklist`, { method: 'POST' })
    router.push('/results/competitions')
  } catch {
    actionError.value = 'Verwijderen mislukt.'
  }
}
</script>

<template>
  <div v-if="data" class="space-y-6">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="page-title break-words">{{ data.competition.name }}</h1>
        <p class="text-secondary mt-1">
          {{ data.competition.venue || '-' }} &middot;
          <span class="font-mono">{{ fmtDate(data.competition.date) }}</span>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink :to="`/results/races/new?competitionId=${id}`" class="btn btn-primary btn-sm">
          + Rit toevoegen
        </NuxtLink>
        <NuxtLink :to="`/results/competitions/${id}/edit`" class="btn btn-secondary btn-sm">
          Bewerken
        </NuxtLink>
        <details class="menu">
          <summary class="btn btn-secondary btn-sm" aria-label="Meer acties">&hellip;</summary>
          <div class="menu-panel">
            <button type="button" class="btn btn-danger btn-sm" @click="deleteCompetition">
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

    <section>
      <h2 class="section-heading mb-2">Ritten</h2>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Afstand</th>
              <th>Status</th>
              <th>Baan</th>
              <th class="num">Tijd</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data.races" :key="r.id" class="table-row-link">
              <td class="font-mono">
                <NuxtLink :to="`/results/races/${r.id}`" class="stretched-link">{{ r.distanceM }}m</NuxtLink>
              </td>
              <td class="text-secondary">{{ raceStatusLabel(r.status) }}</td>
              <td class="text-secondary">{{ r.trackType === 'outdoor' ? 'Buiten' : 'Binnen' }}</td>
              <td class="num">
                <span class="stat-value-sm">{{ fmtMs(r.totalTimeMs) }}</span>
                <span v-if="r.isPr" class="badge badge-pr ml-1">PR</span>
                <span v-else-if="r.isSb" class="badge badge-sb ml-1">SB</span>
              </td>
            </tr>
            <tr v-if="!data.races.length">
              <td colspan="4" class="empty-state" style="border: none">Nog geen ritten.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
  <p v-else-if="error" style="color: var(--color-danger)">Wedstrijd niet gevonden.</p>
</template>
