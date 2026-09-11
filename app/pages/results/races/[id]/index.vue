<script setup lang="ts">
import { raceStatusLabel, raceTagLabel } from '#shared/constants'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const { data: race } = await useFetch(`/api/results/races/${id}`)

async function deleteRace() {
  if (!confirm('Deze rit verwijderen?')) return
  await $fetch(`/api/results/races/${id}`, { method: 'DELETE' })
  router.push('/results/races')
}

async function deleteAndBlacklist() {
  if (!confirm('Deze rit verwijderen en blacklisten (niet opnieuw voorstellen bij import)?')) return
  await $fetch(`/api/results/races/${id}/blacklist`, { method: 'POST' })
  router.push('/results/races')
}
</script>

<template>
  <div v-if="race" class="space-y-6 max-w-2xl">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold">{{ race.distanceM }}m &middot; {{ race.competitionName }}</h1>
        <p class="text-sm" style="color: var(--color-text-muted)">
          {{ race.venue || '-' }} &middot;
          <span class="font-mono">{{ fmtDate(race.competitionDate) }}</span> &middot;
          {{ race.trackType === 'outdoor' ? 'Buitenbaan' : 'Binnenbaan' }}
        </p>
      </div>
      <div class="flex gap-2">
        <NuxtLink
          :to="`/results/races/${id}/edit`"
          class="rounded-md px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-border)"
        >
          Bewerken
        </NuxtLink>
        <NuxtLink
          :to="`/results/races/${id}/compare`"
          class="rounded-md px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-border)"
        >
          Vergelijken
        </NuxtLink>
        <button
          class="rounded-md px-3 py-1.5 text-sm"
          style="border: 1px solid var(--color-danger); color: var(--color-danger)"
          @click="deleteRace"
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

    <section class="rounded-lg p-4" style="border: 1px solid var(--color-border)">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <div style="color: var(--color-text-muted)">Status</div>
          <div>{{ raceStatusLabel(race.status) }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Eindtijd</div>
          <div class="font-mono">
            {{ fmtMs(race.totalTimeMs) }}
            <span v-if="race.isPr" class="text-xs" style="color: var(--color-accent)">PR</span>
            <span v-else-if="race.isSb" class="text-xs" style="color: var(--color-success)">SB</span>
          </div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">T.o.v. vorige PR</div>
          <div class="font-mono">
            <span v-if="race.deltaVsPreviousPrMs === null">-</span>
            <span v-else :style="{ color: race.deltaVsPreviousPrMs <= 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
              {{ race.deltaVsPreviousPrMs > 0 ? '+' : '' }}{{ fmtMs(race.deltaVsPreviousPrMs) }}
            </span>
          </div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Tag</div>
          <div>{{ raceTagLabel(race.tag) }}</div>
        </div>
        <div v-if="race.lane">
          <div style="color: var(--color-text-muted)">Baan</div>
          <div>{{ race.lane }}</div>
        </div>
        <div v-if="race.opponent">
          <div style="color: var(--color-text-muted)">Tegenstander</div>
          <div>{{ race.opponent }}</div>
        </div>
        <div v-if="race.category">
          <div style="color: var(--color-text-muted)">Categorie</div>
          <div>{{ race.category }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Bron</div>
          <div class="capitalize">{{ race.source }}</div>
        </div>
      </div>
    </section>

    <section v-if="race.splitRows.length">
      <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Splits</h2>
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left" style="color: var(--color-text-muted)">
            <th class="py-1 pr-4">#</th>
            <th class="py-1 pr-4">Afstand</th>
            <th class="py-1 pr-4">Tijd</th>
            <th class="py-1 pr-4">Per 400m</th>
            <th class="py-1 pr-4">Delta</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in race.splitRows" :key="row.index" style="border-top: 1px solid var(--color-border)">
            <td class="py-1 pr-4">{{ row.index }}</td>
            <td class="py-1 pr-4">{{ row.distanceM }}m</td>
            <td class="py-1 pr-4 font-mono">{{ row.seconds.toFixed(2) }}</td>
            <td class="py-1 pr-4 font-mono">{{ row.per400Eq?.toFixed(2) ?? '-' }}</td>
            <td class="py-1 pr-4 font-mono">
              <span v-if="row.deltaPrev400Eq === null">-</span>
              <span v-else :style="{ color: row.deltaPrev400Eq <= 0 ? 'var(--color-success)' : 'var(--color-danger)' }">
                {{ row.deltaPrev400Eq > 0 ? '+' : '' }}{{ row.deltaPrev400Eq.toFixed(2) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-xs mt-2" style="color: var(--color-text-muted)">
        Gemiddelde per 400m: {{ race.metrics.avg400?.toFixed(2) ?? '-' }} &middot;
        Fade: {{ race.metrics.fade400Eq?.toFixed(2) ?? '-' }}
      </p>
    </section>

    <section v-if="race.notes">
      <h2 class="text-sm font-medium mb-2" style="color: var(--color-text-muted)">Notities</h2>
      <p class="text-sm whitespace-pre-line">{{ race.notes }}</p>
    </section>
  </div>
</template>
