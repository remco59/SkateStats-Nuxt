<script setup lang="ts">
import { raceStatusLabel } from '#shared/constants'

const route = useRoute()
const router = useRouter()
const batchId = String(route.query.batchId ?? '')

const { data: preview, error: loadError } = await useFetch(`/api/import/preview/${batchId}`)

type Item = NonNullable<typeof preview.value>['items'][number]
type RaceItem = Item['races'][number]

// Corrections are never applied unless asked for: every one starts on "overslaan".
const updateChoices = reactive<Record<string, string>>(
  Object.fromEntries(
    (preview.value?.items ?? []).flatMap((i) => i.races.filter((r) => r.action === 'update_candidate').map((r) => [r.updateChoiceKey, 'skip'])),
  ),
)
const submitting = ref(false)
const errorMessage = ref('')

// ---- Cards: new / overlapping / ignored (like the old preview) -------------
const cards = computed(() => {
  const items = preview.value?.items ?? []
  return [
    { key: 'new', title: 'Nieuwe data', hint: '', items: items.filter((i) => i.action === 'new_competition') },
    {
      key: 'overlap',
      title: 'Overlappende data',
      hint: 'Deze wedstrijden staan al in je resultaten. Ritten die al bestaan worden overgeslagen; vink je er een aan, dan kun je de wedstrijd als nieuwe wedstrijd toevoegen.',
      items: items.filter((i) => i.action === 'attach_to_existing'),
    },
    {
      key: 'blacklist',
      title: 'Genegeerd (blacklist)',
      hint: 'Vink je een rit aan, dan haal je de wedstrijd van de blacklist en importeer je die rit.',
      items: items.filter((i) => i.action === 'blacklisted'),
    },
  ]
})

// ---- Selection --------------------------------------------------------------
// New races start ticked; everything else (already present, ignored) starts
// unticked, as in the old app where only the "new" card was ticked.
const selected = ref<Set<string>>(
  new Set((preview.value?.items ?? []).flatMap((i) => (i.action === 'blacklisted' ? [] : i.races.filter((r) => r.action === 'new').map((r) => r.updateChoiceKey)))),
)

// update_candidate rows are decided with their own dropdown, not a checkbox.
const isTickable = (race: RaceItem) => race.action !== 'update_candidate'
const tickableKeys = (items: Item[]) => items.flatMap((i) => i.races.filter(isTickable).map((r) => r.updateChoiceKey))

function toggle(key: string, on: boolean) {
  const next = new Set(selected.value)
  if (on) next.add(key)
  else next.delete(key)
  selected.value = next
}

function allTicked(items: Item[]) {
  const keys = tickableKeys(items)
  return keys.length > 0 && keys.every((k) => selected.value.has(k))
}

function toggleCard(items: Item[]) {
  const keys = tickableKeys(items)
  const next = new Set(selected.value)
  if (allTicked(items)) keys.forEach((k) => next.delete(k))
  else keys.forEach((k) => next.add(k))
  selected.value = next
}

// "Toevoegen als nieuwe wedstrijd" is for the case where a race that is already
// present is ticked: the competition on that day is then a different one.
const identicalTicked = computed(() =>
  (preview.value?.items ?? []).some((i) =>
    i.action === 'attach_to_existing' && i.races.some((r) => r.action === 'identical' && selected.value.has(r.updateChoiceKey)),
  ),
)

const raceLabel = (race: RaceItem) =>
  race.race.status !== 'finished' ? raceStatusLabel(race.race.status).toUpperCase() : fmtMs(race.race.totalTimeMs)

const actionLabel: Record<string, string> = {
  new: 'Nieuw',
  identical: 'Al aanwezig',
  update_candidate: 'Mogelijke correctie',
  blacklisted: 'Genegeerd',
}

async function commit(forceNewCompetition: boolean) {
  submitting.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch(`/api/import/preview/${batchId}/commit`, {
      method: 'POST',
      body: { updateChoices, selectedRaceKeys: [...selected.value], forceNewCompetition },
    })
    const nothing = result.importedRaces === 0 && result.importedCompetitions === 0 && result.updatedRaces === 0
    await router.push({
      path: '/import',
      query: nothing
        ? { notice: 'nothing' }
        : {
            notice: 'imported',
            competitions: result.importedCompetitions,
            races: result.importedRaces,
            updated: result.updatedRaces,
          },
    })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    errorMessage.value = err.data?.statusMessage || 'Verwerken mislukt.'
  } finally {
    submitting.value = false
  }
}

async function discard() {
  errorMessage.value = ''
  try {
    await $fetch(`/api/import/preview/${batchId}/discard`, { method: 'POST' })
    await router.push({ path: '/import', query: { notice: 'cancelled' } })
  } catch {
    errorMessage.value = 'Annuleren mislukt.'
  }
}

async function ignoreCompetition(competitionSignature: string) {
  errorMessage.value = ''
  try {
    await $fetch(`/api/import/preview/${batchId}/blacklist-competition`, {
      method: 'POST',
      body: { competitionSignature },
    })
    await router.push('/import')
  } catch {
    errorMessage.value = 'Negeren mislukt.'
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <h1 class="page-title">Import preview</h1>

    <p v-if="loadError" style="color: var(--color-danger)">
      Deze import-batch is niet gevonden of verlopen. <NuxtLink to="/import" class="underline">Opnieuw proberen</NuxtLink>.
    </p>

    <template v-if="preview">
      <p v-if="errorMessage" class="notice" role="alert" style="color: var(--color-danger)">{{ errorMessage }}</p>

      <section v-for="card in cards" :key="card.key" class="space-y-3" :aria-label="card.title">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="section-heading">{{ card.title }} ({{ card.items.length }})</h2>
          <button
            v-if="tickableKeys(card.items).length"
            type="button"
            class="btn btn-secondary btn-sm"
            @click="toggleCard(card.items)"
          >
            {{ allTicked(card.items) ? 'Deselecteer alles' : 'Selecteer alles' }}
          </button>
        </div>
        <p v-if="card.hint && card.items.length" class="text-xs" style="color: var(--color-text-faint)">{{ card.hint }}</p>
        <p v-if="!card.items.length" class="text-secondary text-sm">Geen wedstrijden in deze kaart.</p>

        <article v-for="item in card.items" :key="item.competitionSignature" class="card space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h3 class="card-title">{{ item.competition.name }}</h3>
              <div class="text-meta mt-0.5">
                {{ item.competition.venue || '-' }} &middot;
                <span class="font-mono">{{ fmtDate(item.competition.date) }}</span> &middot;
                {{ item.races.length }} {{ item.races.length === 1 ? 'rit' : 'ritten' }}
              </div>
            </div>
            <button
              v-if="item.action !== 'blacklisted'"
              type="button"
              class="btn-link text-xs shrink-0"
              style="color: var(--color-danger)"
              @click="ignoreCompetition(item.competitionSignature)"
            >
              Negeren
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th class="w-8"><span class="sr-only">Importeren</span></th>
                  <th>Afstand</th>
                  <th class="num">Tijd</th>
                  <th>Baan</th>
                  <th>Tegenstander</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="raceItem in item.races" :key="raceItem.updateChoiceKey">
                  <td>
                    <input
                      v-if="isTickable(raceItem)"
                      type="checkbox"
                      :checked="selected.has(raceItem.updateChoiceKey)"
                      :aria-label="`Importeer ${raceItem.race.distanceM}m van ${item.competition.name}`"
                      @change="toggle(raceItem.updateChoiceKey, ($event.target as HTMLInputElement).checked)"
                    >
                  </td>
                  <td class="font-mono">{{ raceItem.race.distanceM }}m</td>
                  <td class="num font-mono">{{ raceLabel(raceItem) }}</td>
                  <td class="text-secondary">{{ raceItem.race.lane || '-' }}</td>
                  <td class="text-secondary">{{ raceItem.race.opponent || '-' }}</td>
                  <td class="text-secondary">
                    <select
                      v-if="raceItem.action === 'update_candidate'"
                      v-model="updateChoices[raceItem.updateChoiceKey]"
                      aria-label="Actie voor deze rit"
                      class="field"
                      style="min-height: 2rem; padding: 0 0.5rem; font-size: 0.8rem"
                    >
                      <option value="skip">Mogelijke correctie: overslaan</option>
                      <option value="replace">Vervang bestaande tijd</option>
                      <option value="keep_both">Beide behouden</option>
                    </select>
                    <template v-else>{{ actionLabel[raceItem.action] }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <div class="flex flex-wrap gap-3">
        <button type="button" class="btn btn-primary" :disabled="submitting" @click="commit(false)">
          {{ submitting ? 'Bezig...' : 'Importeren' }}
        </button>
        <button
          v-if="identicalTicked"
          type="button"
          class="btn btn-secondary"
          :disabled="submitting"
          title="Maakt een nieuwe wedstrijd aan met de aangevinkte ritten, ook als de wedstrijd al bestaat"
          @click="commit(true)"
        >
          Toevoegen als nieuwe wedstrijd
        </button>
        <button type="button" class="btn btn-secondary" :disabled="submitting" @click="discard">
          Annuleren
        </button>
      </div>
    </template>
  </div>
</template>
