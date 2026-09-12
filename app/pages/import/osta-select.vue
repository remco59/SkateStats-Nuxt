<script setup lang="ts">
definePageMeta({ path: '/import/osta/select' })

const route = useRoute()
const router = useRouter()
const searchName = String(route.query.searchName ?? '')
const season = String(route.query.season ?? '')
const error = ref('')

const { data, error: loadError } = await useFetch('/api/import/osta/search', {
  method: 'POST',
  body: { searchName, season },
})

watchEffect(() => {
  if (data.value?.status === 'ok' && data.value.batchId) {
    router.replace(`/import/preview?batchId=${data.value.batchId}`)
  }
})

async function selectCandidate(pid: string) {
  error.value = ''
  try {
    const res = await $fetch('/api/import/osta/select', { method: 'POST', body: { searchName, season, pid } })
    router.push(`/import/preview?batchId=${res.batchId}`)
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Importeren mislukt.'
  }
}
</script>

<template>
  <div class="max-w-xl space-y-4">
    <h1 class="text-xl font-semibold">OSTA profielkeuze</h1>
    <p class="text-sm" style="color: var(--color-text-muted)">
      Meerdere profielen gevonden voor "{{ searchName }}". Kies het juiste profiel.
    </p>

    <ul v-if="data?.candidates" class="space-y-2">
      <li
        v-for="c in data.candidates"
        :key="c.pid"
        class="rounded-lg p-3 flex items-center justify-between"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
        <div>
          <div class="font-medium">{{ c.name }}</div>
          <div class="text-xs" style="color: var(--color-text-muted)">
            {{ c.category }} &middot; {{ c.club }} &middot; {{ c.seasons }}
          </div>
        </div>
        <button
          class="rounded-md px-3 py-1.5 text-sm"
          style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
          @click="selectCandidate(c.pid)"
        >
          Kies
        </button>
      </li>
    </ul>
    <p v-if="loadError" class="text-sm" style="color: var(--color-danger)">Zoeken mislukt.</p>
    <p v-else-if="data?.candidates && !data.candidates.length" style="color: var(--color-text-muted)">
      Geen profielen gevonden.
    </p>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
  </div>
</template>
