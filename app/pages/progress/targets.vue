<script setup lang="ts">
import { COMMON_DISTANCES } from '#shared/constants'

const { data, refresh } = await useFetch('/api/progress/targets')

const distanceM = ref(1500)
const targetTimeStr = ref('')
const error = ref('')

function parseTimeInput(v: string): number | null {
  const value = v.trim().replace(',', '.')
  const match = value.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/)
  if (!match) return null
  const minutes = match[1] ? Number.parseInt(match[1], 10) : 0
  const seconds = Number.parseFloat(match[2] ?? '0')
  return Math.round((minutes * 60 + seconds) * 1000)
}

async function saveTarget() {
  error.value = ''
  const targetTimeMs = parseTimeInput(targetTimeStr.value)
  if (!targetTimeMs) {
    error.value = 'Ongeldige tijd.'
    return
  }
  try {
    await $fetch('/api/progress/targets', { method: 'POST', body: { distanceM: distanceM.value, targetTimeMs } })
    targetTimeStr.value = ''
    await refresh()
  } catch {
    error.value = 'Opslaan mislukt.'
  }
}

async function deleteTarget(distance: number) {
  error.value = ''
  try {
    await $fetch(`/api/progress/targets/${distance}`, { method: 'DELETE' })
    await refresh()
  } catch {
    error.value = 'Verwijderen mislukt.'
  }
}

function forecastLabel(forecast: Record<string, unknown>): string {
  switch (forecast.status) {
    case 'no_target': return 'Geen doel ingesteld'
    case 'no_data': return 'Nog geen ritten op deze afstand'
    case 'reached': return 'Doel al bereikt!'
    case 'insufficient': return 'Te weinig recente ritten voor een voorspelling'
    case 'flat': return 'Geen recente verbetering'
    case 'forecast':
      return `Verwacht over ${forecast.racesToTarget} ritten (rond ${fmtDate(forecast.etaDate as string)})`
    default: return ''
  }
}
</script>

<template>
  <div class="space-y-8 max-w-2xl">
    <h1 class="text-xl font-semibold">Targets</h1>

    <section class="space-y-2">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Target instellen</h2>
      <div class="flex gap-2">
        <select
          v-model.number="distanceM"
          aria-label="Afstand"
          class="rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border)"
        >
          <option v-for="d in COMMON_DISTANCES" :key="d" :value="d">{{ d }}m</option>
        </select>
        <input
          v-model="targetTimeStr"
          placeholder="Tijd (m:ss.hh)"
          aria-label="Doeltijd"
          class="flex-1 rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border)"
        >
        <button
          class="rounded-md px-3 py-1.5 text-sm"
          style="background: var(--color-accent); color: var(--color-accent-contrast)"
          @click="saveTarget"
        >
          Opslaan
        </button>
      </div>
      <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
    </section>

    <section v-if="!data?.cards?.length">
      <p style="color: var(--color-text-muted)">Nog geen actieve targets.</p>
    </section>

    <section v-for="card in data?.cards" :key="card.target.distanceM" class="rounded-lg p-4 space-y-3" style="border: 1px solid var(--color-border)">
      <div class="flex items-center justify-between">
        <h3 class="font-mono text-lg">{{ card.target.distanceM }}m</h3>
        <button class="text-sm underline" style="color: var(--color-danger)" @click="deleteTarget(card.target.distanceM)">
          Verwijderen
        </button>
      </div>
      <p class="text-sm">
        Doeltijd: <span class="font-mono">{{ fmtMs(card.target.targetTimeMs) }}</span>
      </p>
      <p class="text-sm" style="color: var(--color-text-muted)">{{ forecastLabel(card.forecast) }}</p>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <div style="color: var(--color-text-muted)">Opening</div>
          <div class="font-mono">{{ fmtMs(card.generated.targetOpeningMs) }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Gem. 400m</div>
          <div class="font-mono">{{ fmtMs(card.generated.targetAvg400Ms) }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Laatste 400m</div>
          <div class="font-mono">{{ fmtMs(card.generated.targetLast400Ms) }}</div>
        </div>
        <div>
          <div style="color: var(--color-text-muted)">Fade</div>
          <div class="font-mono">{{ fmtMs(card.generated.targetFade400Ms) }}</div>
        </div>
      </div>
    </section>
  </div>
</template>
