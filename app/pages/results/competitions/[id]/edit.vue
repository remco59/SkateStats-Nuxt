<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const id = route.params.id as string

const { data, error: loadError } = await useFetch(`/api/results/competitions/${id}`)

const name = ref('')
const venue = ref('')
const date = ref('')
const notes = ref('')
watchEffect(() => {
  if (data.value) {
    name.value = data.value.competition.name
    venue.value = data.value.competition.venue ?? ''
    date.value = data.value.competition.date
    notes.value = data.value.competition.notes ?? ''
  }
})

const error = ref('')
async function submit() {
  error.value = ''
  try {
    await $fetch(`/api/results/competitions/${id}`, {
      method: 'PATCH',
      body: { name: name.value, venue: venue.value || undefined, date: date.value, notes: notes.value || undefined },
    })
    router.push(`/results/competitions/${id}`)
  } catch {
    error.value = 'Opslaan mislukt.'
  }
}
</script>

<template>
  <div v-if="data" class="max-w-lg space-y-4">
    <h1 class="text-xl font-semibold">Bewerk wedstrijd</h1>
    <input
      v-model="name"
      aria-label="Naam"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    >
    <input
      v-model="venue"
      aria-label="Locatie"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    >
    <input
      v-model="date"
      type="date"
      aria-label="Datum"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    >
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
  <p v-else-if="loadError" style="color: var(--color-danger)">Wedstrijd niet gevonden.</p>
</template>
