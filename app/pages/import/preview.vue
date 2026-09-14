<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const batchId = String(route.query.batchId ?? '')

const { data: preview, error: loadError } = await useFetch(`/api/import/preview/${batchId}`)

const updateChoices = reactive<Record<string, string>>({})
const submitting = ref(false)
const resultMessage = ref('')
const errorMessage = ref('')

const actionLabel: Record<string, string> = {
  new: 'Nieuw',
  identical: 'Al aanwezig (overslaan)',
  update_candidate: 'Mogelijke correctie',
  blacklisted: 'Genegeerd',
}

async function commit() {
  submitting.value = true
  errorMessage.value = ''
  try {
    const result = await $fetch(`/api/import/preview/${batchId}/commit`, {
      method: 'POST',
      body: { updateChoices },
    })
    resultMessage.value = `${result.importedCompetitions} wedstrijden, ${result.importedRaces} nieuwe ritten en ${result.updatedRaces} correcties verwerkt.`
    setTimeout(() => router.push('/results/competitions'), 1500)
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
    router.push('/import')
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
    router.push('/import')
  } catch {
    errorMessage.value = 'Negeren mislukt.'
  }
}
</script>

<template>
  <div class="space-y-8 max-w-3xl">
    <h1 class="page-title">Import preview</h1>

    <p v-if="loadError" style="color: var(--color-danger)">
      Deze import-batch is niet gevonden of verlopen. <NuxtLink to="/import" class="underline">Opnieuw proberen</NuxtLink>.
    </p>

    <template v-if="preview">
      <section
        v-for="item in preview.items"
        :key="item.competitionSignature"
        class="card space-y-3"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="card-title">{{ item.competition.name }}</div>
            <div class="text-meta mt-0.5">
              {{ item.competition.venue || '-' }} &middot;
              <span class="font-mono">{{ fmtDate(item.competition.date) }}</span> &middot;
              {{ item.action === 'attach_to_existing' ? 'Bestaande wedstrijd' : 'Nieuwe wedstrijd' }}
            </div>
          </div>
          <button
            v-if="item.action !== 'blacklisted'"
            type="button"
            class="btn-link text-xs"
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
                <th>Afstand</th>
                <th class="num">Tijd</th>
                <th>Status</th>
                <th>Actie</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="raceItem in item.races" :key="raceItem.updateChoiceKey">
                <td class="font-mono">{{ raceItem.race.distanceM }}m</td>
                <td class="num font-mono">{{ fmtMs(raceItem.race.totalTimeMs) }}</td>
                <td class="text-secondary">{{ actionLabel[raceItem.action] }}</td>
                <td>
                  <select
                    v-if="raceItem.action === 'update_candidate'"
                    v-model="updateChoices[raceItem.updateChoiceKey]"
                    aria-label="Actie voor deze rit"
                    class="field"
                    style="min-height: 2rem; padding: 0 0.5rem; font-size: 0.8rem"
                  >
                    <option value="skip">Overslaan (standaard)</option>
                    <option value="replace">Vervang bestaande tijd</option>
                    <option value="keep_both">Beide behouden</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div class="flex gap-3">
        <button type="button" class="btn btn-primary" :disabled="submitting" @click="commit">
          {{ submitting ? 'Bezig...' : 'Importeren' }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="submitting" @click="discard">
          Annuleren
        </button>
      </div>
      <p v-if="resultMessage" class="text-sm" style="color: var(--color-success)">{{ resultMessage }}</p>
      <p v-if="errorMessage" class="text-sm" style="color: var(--color-danger)">{{ errorMessage }}</p>
    </template>
  </div>
</template>
