<script setup lang="ts">
definePageMeta({ middleware: ['admin-only'] })

const updating = ref(false)
const result = ref<{ ok: boolean; pull?: { stdout: string; stderr: string }; build?: { stdout: string; stderr: string } } | null>(null)
const updateError = ref('')

async function updateApp() {
  if (!confirm('Wijzigingen ophalen en de app herstarten? Dit kan even duren.')) return
  updating.value = true
  updateError.value = ''
  result.value = null
  try {
    // Nitro's typed $fetch tries to match the URL against every known API
    // route to infer a response type; once the app has enough routes that
    // blows TS's comparison-depth limit (a plain `as any` on the URL still
    // triggers it, since the overload itself is what's being resolved).
    // Casting $fetch itself sidesteps the route-key inference entirely.
    result.value = await ($fetch as (url: string, opts: { method: 'POST' }) => Promise<typeof result.value>)(
      '/api/admin/system/update',
      { method: 'POST' },
    )
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    updateError.value = err.data?.statusMessage || 'Bijwerken mislukt.'
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-xl font-semibold">Systeem</h1>

    <section class="space-y-3 max-w-2xl">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Applicatie bijwerken</h2>
      <p class="text-sm" style="color: var(--color-text-muted)">
        Haalt de nieuwste versie op vanaf git en herbouwt en herstart de container. De app is
        tijdens het herstarten kort niet bereikbaar.
      </p>
      <button
        class="rounded-md px-3 py-1.5 text-sm disabled:opacity-50"
        style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
        :disabled="updating"
        @click="updateApp"
      >
        {{ updating ? 'Bezig met bijwerken…' : 'Bijwerken & herstarten' }}
      </button>

      <p v-if="updateError" class="text-sm" style="color: var(--color-danger)">{{ updateError }}</p>

      <div v-if="result" class="space-y-2">
        <p class="text-sm" :style="{ color: result.ok ? 'var(--color-success, #22c55e)' : 'var(--color-danger)' }">
          {{ result.ok ? 'Bijgewerkt.' : 'Bijwerken mislukt, zie details.' }}
        </p>
        <details class="text-xs" style="color: var(--color-text-muted)">
          <summary class="cursor-pointer">Details</summary>
          <pre class="whitespace-pre-wrap p-2 mt-1 rounded-md" style="background: var(--color-surface); border: 1px solid var(--color-border)">{{ JSON.stringify(result, null, 2) }}</pre>
        </details>
      </div>
    </section>
  </div>
</template>
