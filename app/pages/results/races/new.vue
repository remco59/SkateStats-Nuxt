<script setup lang="ts">
import { RACE_STATUSES, RACE_STATUS_LABELS, RACE_TAGS, RACE_TAG_LABELS } from '#shared/constants'

const route = useRoute()
const router = useRouter()

const { data: competitionsData, error: competitionsError } = await useFetch('/api/results/competitions')

const useExisting = ref(!!route.query.competitionId)
const competitionId = ref(route.query.competitionId ? String(route.query.competitionId) : '')
const newName = ref('')
const newVenue = ref('')
const newDate = ref('')

const distanceM = ref(1500)
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
    const body: Record<string, unknown> = {
      distanceM: distanceM.value,
      status: status.value,
      trackType: trackType.value,
      lane: lane.value || undefined,
      opponent: opponent.value || undefined,
      category: category.value || undefined,
      className: className.value || undefined,
      tag: tag.value || undefined,
      notes: notes.value || undefined,
      lapsCsv: lapsCsv.value || undefined,
      totalTimeMs: parseTimeInput(totalTimeStr.value),
    }
    if (useExisting.value) {
      body.competitionId = Number(competitionId.value)
    } else {
      body.newCompetition = { name: newName.value, venue: newVenue.value || undefined, date: newDate.value }
    }
    const created = await $fetch('/api/results/races', { method: 'POST', body })
    router.push(`/results/races/${created.id}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Aanmaken mislukt.'
  }
}
</script>

<template>
  <div class="max-w-lg space-y-4">
    <h1 class="text-xl font-semibold">Nieuwe rit</h1>

    <div class="space-y-2">
      <label class="flex items-center gap-2 text-sm">
        <input v-model="useExisting" type="checkbox">
        Bestaande wedstrijd gebruiken
      </label>

      <select
        v-if="useExisting"
        v-model="competitionId"
        aria-label="Wedstrijd"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
        <option value="">Kies een wedstrijd</option>
        <option v-for="c in competitionsData?.competitions" :key="c.id" :value="c.id">
          {{ c.name }} ({{ c.date }})
        </option>
      </select>
      <p v-if="useExisting && competitionsError" class="text-sm" style="color: var(--color-danger)">
        Kon wedstrijden niet laden.
      </p>

      <template v-else>
        <input
          v-model="newName"
          placeholder="Naam wedstrijd"
          aria-label="Naam wedstrijd"
          class="w-full rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border)"
        >
        <input
          v-model="newVenue"
          placeholder="Locatie"
          aria-label="Locatie"
          class="w-full rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border)"
        >
        <input
          v-model="newDate"
          type="date"
          aria-label="Datum"
          class="w-full rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border)"
        >
      </template>
    </div>

    <div class="grid grid-cols-2 gap-2">
      <input
        v-model.number="distanceM"
        type="number"
        placeholder="Afstand (m)"
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
      placeholder="Eindtijd (m:ss.hh) -- optioneel als rondetijden zijn ingevuld"
      aria-label="Eindtijd"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    >
    <input
      v-model="lapsCsv"
      placeholder="Rondetijden, komma-gescheiden (bv. 41.5,30.2,30.8,31.4)"
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
      placeholder="Notities"
      aria-label="Notities"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    />

    <button
      class="rounded-md px-3 py-1.5 text-sm"
      style="background: var(--color-accent); color: var(--color-accent-contrast)"
      @click="submit"
    >
      Aanmaken
    </button>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
  </div>
</template>
