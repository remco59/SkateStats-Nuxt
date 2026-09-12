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
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold">{{ data.competition.name }}</h1>
        <p class="text-sm" style="color: var(--color-text-muted)">
          {{ data.competition.venue || '-' }} &middot;
          <span class="font-mono">{{ fmtDate(data.competition.date) }}</span>
        </p>
      </div>
      <div class="flex gap-2">
        <NuxtLink
          :to="`/results/competitions/${id}/edit`"
          class="rounded-md px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-border)"
        >
          Bewerken
        </NuxtLink>
        <button
          class="rounded-md px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-danger); color: var(--color-danger)"
          @click="deleteCompetition"
        >
          Verwijderen
        </button>
        <button
          class="rounded-md px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-danger); color: var(--color-danger)"
          @click="deleteAndBlacklist"
        >
          Verwijder + blacklist
        </button>
      </div>
    </div>

    <div class="flex items-center justify-between">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Ritten</h2>
      <NuxtLink
        :to="`/results/races/new?competitionId=${id}`"
        class="text-sm underline"
      >
        + Rit toevoegen
      </NuxtLink>
    </div>
    <p v-if="actionError" class="text-sm" style="color: var(--color-danger)">{{ actionError }}</p>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left" style="color: var(--color-text-muted)">
            <th class="py-1 pr-4">Afstand</th>
            <th class="py-1 pr-4">Status</th>
            <th class="py-1 pr-4">Tijd</th>
            <th class="py-1 pr-4">Baan</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data.races" :key="r.id" style="border-top: 1px solid var(--color-border)">
            <td class="py-2 pr-4">
              <NuxtLink :to="`/results/races/${r.id}`" class="font-mono hover:underline">
                {{ r.distanceM }}m
              </NuxtLink>
            </td>
            <td class="py-2 pr-4">{{ raceStatusLabel(r.status) }}</td>
            <td class="py-2 pr-4 font-mono">
              {{ fmtMs(r.totalTimeMs) }}
              <span v-if="r.isPr" class="text-xs" style="color: var(--color-accent)">PR</span>
            </td>
            <td class="py-2 pr-4">{{ r.trackType === 'outdoor' ? 'Buiten' : 'Binnen' }}</td>
          </tr>
          <tr v-if="!data.races.length">
            <td colspan="4" class="py-4" style="color: var(--color-text-muted)">Nog geen ritten.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <p v-else-if="error" style="color: var(--color-danger)">Wedstrijd niet gevonden.</p>
</template>
