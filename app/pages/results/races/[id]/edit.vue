<script setup lang="ts">
import { RACE_STATUSES, RACE_STATUS_LABELS, RACE_TAGS, RACE_TAG_LABELS } from '#shared/constants'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const { data: race, error: loadError } = await useFetch(`/api/results/races/${id}`)

const distanceM = ref(0)
const status = ref<(typeof RACE_STATUSES)[number]>('finished')
const lapsCsv = ref('')
const totalTimeStr = ref('')
const trackType = ref<'indoor' | 'outdoor'>('indoor')
const lane = ref('')
const opponent = ref('')
const category = ref('')
const className = ref('')
const tag = ref('')
const notes = ref('')
const error = ref('')

watchEffect(() => {
  if (!race.value) return
  distanceM.value = race.value.distanceM
  status.value = race.value.status as (typeof RACE_STATUSES)[number]
  lapsCsv.value = race.value.lapsMs.map((ms) => (ms / 1000).toFixed(2)).join(',')
  totalTimeStr.value = race.value.totalTimeMs ? fmtMs(race.value.totalTimeMs) : ''
  trackType.value = race.value.trackType as 'indoor' | 'outdoor'
  lane.value = race.value.lane ?? ''
  opponent.value = race.value.opponent ?? ''
  category.value = race.value.category ?? ''
  className.value = race.value.className ?? ''
  tag.value = race.value.tag ?? ''
  notes.value = race.value.notes ?? ''
})

function parseTimeInput(v: string): number | undefined {
  if (!v.trim()) return undefined
  const value = v.trim().replace(',', '.')
  const match = value.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/)
  if (!match) return undefined
  const minutes = match[1] ? Number.parseInt(match[1], 10) : 0
  const seconds = Number.parseFloat(match[2] ?? '0')
  return Math.round((minutes * 60 + seconds) * 1000)
}

async function submit() {
  error.value = ''
  try {
    await $fetch(`/api/results/races/${id}`, {
      method: 'PATCH',
      body: {
        distanceM: distanceM.value,
        status: status.value,
        trackType: trackType.value,
        lane: lane.value || undefined,
        opponent: opponent.value || undefined,
        category: category.value || undefined,
        className: className.value || undefined,
        tag: tag.value || undefined,
        notes: notes.value || undefined,
        lapsCsv: lapsCsv.value,
        totalTimeMs: parseTimeInput(totalTimeStr.value),
      },
    })
    router.push(`/results/races/${id}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Opslaan mislukt.'
  }
}
</script>

<template>
  <div v-if="race" class="max-w-lg space-y-4">
    <h1 class="text-xl font-semibold">Bewerk rit</h1>

    <div class="grid grid-cols-2 gap-2">
      <input
        v-model.number="distanceM"
        type="number"
        aria-label="Afstand (m)"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <select
        v-model="status"
        aria-label="Status"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
        <option v-for="s in RACE_STATUSES" :key="s" :value="s">{{ RACE_STATUS_LABELS[s] }}</option>
      </select>
    </div>

    <input
      v-model="totalTimeStr"
      placeholder="Eindtijd (m:ss.hh)"
      aria-label="Eindtijd"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    >
    <input
      v-model="lapsCsv"
      placeholder="Rondetijden, komma-gescheiden"
      aria-label="Rondetijden"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    >

    <div class="grid grid-cols-2 gap-2">
      <select
        v-model="trackType"
        aria-label="Baantype"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
        <option value="indoor">Binnenbaan</option>
        <option value="outdoor">Buitenbaan</option>
      </select>
      <select
        v-model="tag"
        aria-label="Tag"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
        <option value="">Geen tag</option>
        <option v-for="t in RACE_TAGS" :key="t" :value="t">{{ RACE_TAG_LABELS[t] }}</option>
      </select>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <input
        v-model="lane"
        placeholder="Baan/lane"
        aria-label="Baan/lane"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <input
        v-model="opponent"
        placeholder="Tegenstander"
        aria-label="Tegenstander"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
    </div>
    <div class="grid grid-cols-2 gap-2">
      <input
        v-model="category"
        placeholder="Categorie"
        aria-label="Categorie"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <input
        v-model="className"
        placeholder="Klasse"
        aria-label="Klasse"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
    </div>
    <textarea
      v-model="notes"
      aria-label="Notities"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    />

    <button
      class="rounded-md px-3 py-1.5 text-sm"
      style="background: var(--color-accent); color: var(--color-accent-contrast)"
      @click="submit"
    >
      Opslaan
    </button>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
  </div>
  <p v-else-if="loadError" style="color: var(--color-danger)">Rit niet gevonden.</p>
</template>
