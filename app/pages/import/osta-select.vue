<script setup lang="ts">
definePageMeta({ path: '/import/osta/select' })

const route = useRoute()
const router = useRouter()
const searchName = String(route.query.searchName ?? '')
const season = String(route.query.season ?? '')
const error = ref('')
const submitting = ref(false)
const selected = ref<string[]>([])

const { data, error: loadError } = await useFetch('/api/import/osta/search', {
  method: 'POST',
  body: { searchName, season },
})

watchEffect(() => {
  if (data.value?.status === 'ok' && data.value.batchId) {
    router.replace(`/import/preview?batchId=${data.value.batchId}`)
  }
})

const candidates = computed(() => data.value?.candidates ?? [])
const allSelected = computed(() => candidates.value.length > 0 && selected.value.length === candidates.value.length)

function toggleAll() {
  selected.value = allSelected.value ? [] : candidates.value.map((c) => c.pid)
}

// The profiles are merged into one preview; one OSTA person can be listed
// several times (e.g. per category), so more than one can be right.
async function importSelected() {
  error.value = ''
  if (!selected.value.length) {
    error.value = 'Selecteer minimaal een OSTA-profiel.'
    return
  }
  submitting.value = true
  try {
    const res = await $fetch('/api/import/osta/select', {
      method: 'POST',
      body: { searchName, season, pids: selected.value },
    })
    router.push(`/import/preview?batchId=${res.batchId}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Importeren mislukt.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-4">
    <h1 class="page-title">OSTA profielkeuze</h1>
    <p class="text-sm" style="color: var(--color-text-muted)">
      Er zijn meerdere OSTA-profielen gevonden voor <strong>{{ searchName }}</strong>. Kies welke profielen je wilt
      meenemen in de import.
    </p>

    <section v-if="candidates.length" class="card space-y-3">
      <div class="flex items-center justify-between gap-2">
        <h2 class="card-title">Beschikbare profielen ({{ candidates.length }})</h2>
        <button type="button" class="btn btn-secondary btn-sm" @click="toggleAll">
          {{ allSelected ? 'Deselecteer alles' : 'Selecteer alles' }}
        </button>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th class="w-8"><span class="sr-only">Selecteer</span></th>
              <th>Naam</th>
              <th>Categorie</th>
              <th>Seizoenen</th>
              <th>Vereniging</th>
              <th>PID</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in candidates" :key="c.pid">
              <td><input v-model="selected" type="checkbox" :value="c.pid" :aria-label="`Selecteer ${c.name}`"></td>
              <td>{{ c.name }}</td>
              <td>{{ c.category || '-' }}</td>
              <td>{{ c.seasons || '-' }}</td>
              <td>{{ c.club || '-' }}</td>
              <td class="font-mono text-xs">{{ c.pid }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="flex gap-2">
        <button type="button" class="btn btn-primary" :disabled="submitting" @click="importSelected">
          {{ submitting ? 'Bezig...' : 'Ga naar import check' }}
        </button>
        <NuxtLink to="/import" class="btn btn-secondary">Annuleren</NuxtLink>
      </div>
    </section>

    <p v-if="loadError" class="text-sm" style="color: var(--color-danger)">Zoeken mislukt.</p>
    <p v-else-if="data?.candidates && !data.candidates.length" style="color: var(--color-text-muted)">
      Geen profielen gevonden.
    </p>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)" role="alert">{{ error }}</p>
  </div>
</template>
