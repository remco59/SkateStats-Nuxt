<script setup lang="ts">
import { RACE_STATUSES, RACE_STATUS_LABELS, RACE_TAGS, RACE_TAG_LABELS } from '#shared/constants'

const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const { data: race, error: loadError } = await useFetch(`/api/results/races/${id}`)
const { data: competitionsData } = await useFetch('/api/results/competitions')

// Which competition the race belongs to: an existing one (its id), or ''
// for "make a new one" (then the three fields below are used).
const competitionChoice = ref('')
const newName = ref('')
const newVenue = ref('')
const newDate = ref('')

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
  competitionChoice.value = String(race.value.competitionId)
  distanceM.value = race.value.distanceM
  status.value = race.value.status as (typeof RACE_STATUSES)[number]
  // Not toFixed(2): that would round a lap like 30.125 to 30.13 on every save.
  lapsCsv.value = race.value.lapsMs.map((ms) => String(ms / 1000)).join(',')
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

  const competition: Record<string, unknown> = {}
  if (competitionChoice.value === '') {
    if (!newName.value.trim() || !newDate.value) {
      error.value = 'Vul een naam en een geldige datum (dd/mm/jjjj) in voor de nieuwe wedstrijd, of kies een bestaande.'
      return
    }
    competition.newCompetition = {
      name: newName.value.trim(),
      venue: newVenue.value.trim() || undefined,
      date: newDate.value,
    }
  } else {
    competition.competitionId = Number(competitionChoice.value)
  }

  try {
    await $fetch(`/api/results/races/${id}`, {
      method: 'PATCH',
      body: {
        ...competition,
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

    <section class="space-y-2">
      <label class="block text-sm space-y-1">
        <span class="text-secondary">Wedstrijd</span>
        <select v-model="competitionChoice" class="field">
          <option v-for="c in competitionsData?.competitions" :key="c.id" :value="String(c.id)">
            {{ fmtDate(c.date) }} - {{ c.name }}
          </option>
          <option value="">- Nieuwe wedstrijd aanmaken -</option>
        </select>
      </label>
      <div v-if="competitionChoice === ''" class="space-y-2">
        <div class="grid grid-cols-2 gap-2">
          <input v-model="newName" class="field" placeholder="Nieuwe wedstrijdnaam" aria-label="Nieuwe wedstrijdnaam">
          <input v-model="newVenue" class="field" placeholder="Locatie (optioneel)" aria-label="Nieuwe locatie">
        </div>
        <DateInput v-model="newDate" aria-label="Datum nieuwe wedstrijd" />
      </div>
    </section>

    <div class="grid grid-cols-2 gap-2">
      <input
        v-model.number="distanceM"
        type="number"
        aria-label="Afstand (m)"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
      <select
        v-model="status"
        aria-label="Status"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
        <option v-for="s in RACE_STATUSES" :key="s" :value="s">{{ RACE_STATUS_LABELS[s] }}</option>
      </select>
    </div>

    <input
      v-model="totalTimeStr"
      placeholder="Eindtijd (m:ss.hh)"
      aria-label="Eindtijd"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    >
    <input
      v-model="lapsCsv"
      placeholder="Rondetijden, komma-gescheiden"
      aria-label="Rondetijden"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    >

    <div class="grid grid-cols-2 gap-2">
      <select
        v-model="trackType"
        aria-label="Baantype"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
        <option value="indoor">Binnenbaan</option>
        <option value="outdoor">Buitenbaan</option>
      </select>
      <select
        v-model="tag"
        aria-label="Tag"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
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
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
      <input
        v-model="opponent"
        placeholder="Tegenstander"
        aria-label="Tegenstander"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
    </div>
    <div class="grid grid-cols-2 gap-2">
      <input
        v-model="category"
        placeholder="Categorie"
        aria-label="Categorie"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
      <input
        v-model="className"
        placeholder="Klasse"
        aria-label="Klasse"
        class="rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
    </div>
    <textarea
      v-model="notes"
      aria-label="Notities"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    />

    <button
      class="rounded-md px-3 py-1.5 text-sm"
      style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
      @click="submit"
    >
      Opslaan
    </button>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
  </div>
  <p v-else-if="loadError" style="color: var(--color-danger)">Rit niet gevonden.</p>
</template>
