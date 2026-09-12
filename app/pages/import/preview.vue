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
    <h1 class="text-xl font-semibold">Import preview</h1>

    <p v-if="loadError" style="color: var(--color-danger)">
      Deze import-batch is niet gevonden of verlopen. <NuxtLink to="/import" class="underline">Opnieuw proberen</NuxtLink>.
    </p>

    <template v-if="preview">
      <section
        v-for="item in preview.items"
        :key="item.competitionSignature"
        class="rounded-lg p-4 space-y-3"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
        <div class="flex items-center justify-between">
          <div>
            <div class="font-medium">{{ item.competition.name }}</div>
            <div class="text-xs" style="color: var(--color-text-muted)">
              {{ item.competition.venue || '-' }} &middot;
              <span class="font-mono">{{ fmtDate(item.competition.date) }}</span> &middot;
              {{ item.action === 'attach_to_existing' ? 'Bestaande wedstrijd' : 'Nieuwe wedstrijd' }}
            </div>
          </div>
          <button
            v-if="item.action !== 'blacklisted'"
            class="text-xs underline"
            style="color: var(--color-danger)"
            @click="ignoreCompetition(item.competitionSignature)"
          >
            Negeren
          </button>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left" style="color: var(--color-text-muted)">
                <th class="py-1 pr-4">Afstand</th>
                <th class="py-1 pr-4">Tijd</th>
                <th class="py-1 pr-4">Status</th>
                <th class="py-1 pr-4">Actie</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="raceItem in item.races" :key="raceItem.identitySignature" style="border-top: 1px solid var(--color-border)">
                <td class="py-1 pr-4 font-mono">{{ raceItem.race.distanceM }}m</td>
                <td class="py-1 pr-4 font-mono">{{ fmtMs(raceItem.race.totalTimeMs) }}</td>
                <td class="py-1 pr-4">{{ actionLabel[raceItem.action] }}</td>
                <td class="py-1 pr-4">
                  <select
                    v-if="raceItem.action === 'update_candidate'"
                    v-model="updateChoices[raceItem.identitySignature]"
                    aria-label="Actie voor deze rit"
                    class="rounded-md px-2 py-1 text-xs"
                    style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
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
        <button
          class="rounded-md px-4 py-2 text-sm"
          style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
          :disabled="submitting"
          @click="commit"
        >
          Importeren
        </button>
        <button
          class="rounded-md px-4 py-2 text-sm"
          style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
          @click="discard"
        >
          Annuleren
        </button>
      </div>
      <p v-if="resultMessage" class="text-sm" style="color: var(--color-success)">{{ resultMessage }}</p>
      <p v-if="errorMessage" class="text-sm" style="color: var(--color-danger)">{{ errorMessage }}</p>
    </template>
  </div>
</template>
