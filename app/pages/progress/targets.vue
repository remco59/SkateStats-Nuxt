<script setup lang="ts">
const { data, refresh } = await useFetch('/api/progress/targets')

type Card = NonNullable<typeof data.value>['cards'][number]

const actionError = ref('')

// Edit: the same form as "new", in a dialog, prefilled from the saved target.
const editModal = ref<{ open: () => void; close: () => void }>()
const editing = ref<Card | null>(null)

async function startEdit(card: Card) {
  editing.value = card
  await nextTick()
  editModal.value?.open()
}

function onEdited() {
  editModal.value?.close()
  editing.value = null
  refresh()
}

// Delete, with confirmation.
const deleteDialog = ref<{ open: () => void; close: () => void }>()
const deleting = ref<number | null>(null)

function askDelete(distanceM: number) {
  deleting.value = distanceM
  deleteDialog.value?.open()
}

async function confirmDelete() {
  if (deleting.value === null) return
  actionError.value = ''
  try {
    await $fetch(`/api/progress/targets/${deleting.value}`, { method: 'DELETE' })
    await refresh()
  } catch {
    actionError.value = 'Verwijderen mislukt.'
  } finally {
    deleteDialog.value?.close()
    deleting.value = null
  }
}

// What each tile shows: the hand-set value, or -- if none was set -- the
// suggestion derived from the target time (marked as such).
function tile(card: Card, key: 'openingMs' | 'avg400Ms' | 'last400Ms' | 'fade400Ms') {
  const generatedKey = {
    openingMs: 'targetOpeningMs',
    avg400Ms: 'targetAvg400Ms',
    last400Ms: 'targetLast400Ms',
    fade400Ms: 'targetFade400Ms',
  } as const
  const stored = card.splits[key]
  if (stored !== null) return { ms: stored, computed: false }
  const generated = card.generated[generatedKey[key]]
  return { ms: generated, computed: generated !== null }
}

const tiles = [
  { key: 'openingMs', label: 'Opening' },
  { key: 'avg400Ms', label: 'Gem. ronde' },
  { key: 'last400Ms', label: 'Laatste ronde' },
  { key: 'fade400Ms', label: 'Verval' },
] as const

function signed(ms: number | null) {
  if (ms === null) return '-'
  return `${ms > 0 ? '+' : ''}${fmtMs(ms)}`
}
</script>

<template>
  <div class="space-y-8 max-w-3xl">
    <SubTabs section="progress" class="!mb-0" />
    <h1 class="page-title">Targets</h1>

    <section class="card space-y-3">
      <div>
        <h2 class="card-title">Target instellen</h2>
        <p class="text-secondary">
          Stel een doeltijd in en laat de opening, gemiddelde ronde, laatste ronde en het verval berekenen op basis
          van je eigen ritten. Een bestaand target voor dezelfde afstand wordt overschreven.
        </p>
      </div>
      <TargetForm @saved="refresh" />
    </section>

    <p v-if="actionError" class="text-sm" style="color: var(--color-danger)" role="alert">{{ actionError }}</p>

    <section v-if="!data?.cards?.length" class="empty-state">
      Nog geen actieve targets. Zodra je er een opslaat, verschijnt hier per afstand een overzicht met voortgang en
      voorspelling.
    </section>

    <article v-for="card in data?.cards" :key="card.target.distanceM" class="card space-y-4">
      <div class="flex items-start justify-between gap-3">
        <h2 class="font-mono text-lg font-semibold">{{ card.target.distanceM }}m</h2>
        <div class="flex gap-2">
          <button type="button" class="btn btn-secondary btn-sm" @click="startEdit(card)">Wijzigen</button>
          <button type="button" class="btn btn-danger btn-sm" @click="askDelete(card.target.distanceM)">
            Verwijderen
          </button>
        </div>
      </div>

      <div>
        <div class="stat-label">Doeltijd</div>
        <div class="stat-value-lg">{{ fmtMs(card.target.targetTimeMs) }}</div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3" style="border-top: 1px solid var(--highlight-soft)">
        <template v-for="t in tiles" :key="t.key">
          <div v-if="!(t.key === 'avg400Ms' && card.target.distanceM === 500)">
            <div class="stat-label">{{ t.label }}</div>
            <div
              class="font-mono mt-0.5"
              :class="tile(card, t.key).computed ? 'text-meta' : 'text-secondary'"
              :title="tile(card, t.key).computed ? 'Berekend uit je doeltijd, niet zelf ingesteld' : undefined"
            >
              {{ fmtMs(tile(card, t.key).ms) }}
              <span v-if="tile(card, t.key).computed" class="text-meta">(berekend)</span>
            </div>
          </div>
        </template>
      </div>

      <p v-if="card.target.notes" class="text-secondary whitespace-pre-line">{{ card.target.notes }}</p>

      <!-- Voorspelling -->
      <section class="forecast">
        <template v-if="card.forecast.status === 'reached'">
          <span class="badge badge-pr">Target gehaald</span>
          Je beste tijd staat al op
          <NuxtLink :to="`/results/races/${card.forecast.bestRaceId}`" class="font-mono underline">
            {{ fmtMs(card.forecast.bestTimeMs) }}
          </NuxtLink>.
        </template>
        <template v-else-if="card.forecast.status === 'forecast'">
          Nog <strong class="font-mono">{{ fmtMs(card.forecast.deltaMs) }}</strong> te gaan. Bij je recente lijn van
          <strong class="font-mono">{{ fmtMs(card.forecast.improvementPerRaceMs) }}</strong> winst per rit ligt dit
          target rond <strong>{{ card.forecast.racesToTarget }} ritten</strong> weg.
          <template v-if="card.forecast.etaDate">
            Ruwe ETA: <strong>{{ fmtDate(card.forecast.etaDate) }}</strong>.
          </template>
        </template>
        <template v-else-if="card.forecast.status === 'flat'">
          Je target ligt nog <strong class="font-mono">{{ fmtMs(card.forecast.deltaMs) }}</strong> weg, maar je laatste
          ritten laten nog geen stijgende lijn zien.
        </template>
        <template v-else-if="card.forecast.status === 'insufficient'">
          Er is nog te weinig recente data om een voorspelling te maken. Voeg minimaal drie geldige tijden toe op deze
          afstand.
        </template>
        <template v-else-if="card.forecast.status === 'no_data'">
          Er is nog geen geldige tijd op deze afstand om een voorspelling op te baseren.
        </template>
        <template v-else>Voeg een doeltijd toe om de voorspelling voor deze afstand te activeren.</template>
      </section>

      <!-- Voortgang -->
      <section v-if="card.progress.length" class="space-y-2">
        <h3 class="section-heading">Voortgang</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <template v-for="row in card.progress" :key="row.key">
            <div
              v-if="!(card.target.distanceM === 500 && row.key === 'avgLap')"
              class="progress-item"
              :class="{ 'progress-item-met': row.metGoal }"
            >
              <div class="stat-label">{{ row.label }}</div>
              <div class="font-mono">{{ fmtMs(row.actualMs) }}</div>
              <div class="font-mono text-sm" :class="row.metGoal ? 'delta-better' : 'delta-worse'">
                <span v-if="row.deltaMs === null" class="delta-neutral">-</span>
                <template v-else>{{ signed(row.deltaMs) }}</template>
              </div>
            </div>
          </template>
        </div>
      </section>

      <TargetSplitSimulation
        v-if="card.target.targetTimeMs"
        :distance-m="card.target.distanceM"
        :target-time-ms="card.target.targetTimeMs"
        :opening-ms="card.splits.openingMs"
        :avg400-ms="card.splits.avg400Ms"
        :last400-ms="card.splits.last400Ms"
      />
    </article>

    <Modal ref="editModal" :title="editing ? `Target wijzigen ${editing.target.distanceM}m` : 'Target wijzigen'" @close="editing = null">
      <TargetForm
        v-if="editing"
        :initial="{
          distanceM: editing.target.distanceM,
          targetTimeMs: editing.target.targetTimeMs,
          openingMs: editing.splits.openingMs,
          avg400Ms: editing.splits.avg400Ms,
          last400Ms: editing.splits.last400Ms,
          fade400Ms: editing.splits.fade400Ms,
          notes: editing.target.notes,
        }"
        submit-label="Wijzigingen opslaan"
        @saved="onEdited"
        @cancel="editModal?.close()"
      />
    </Modal>

    <ConfirmDialog
      ref="deleteDialog"
      :title="deleting ? `Target ${deleting}m verwijderen?` : 'Target verwijderen?'"
      :message="deleting ? `Weet je zeker dat je het target voor ${deleting}m wilt verwijderen?` : ''"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.forecast {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.progress-item {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.progress-item-met {
  border-color: color-mix(in srgb, var(--color-success) 45%, transparent);
  background: color-mix(in srgb, var(--color-success) 6%, transparent);
}
</style>
