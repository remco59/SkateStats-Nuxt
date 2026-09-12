<script setup lang="ts">
const router = useRouter()
const name = ref('')
const venue = ref('')
const date = ref('')
const notes = ref('')
const error = ref('')

async function submit() {
  error.value = ''
  try {
    const created = await $fetch('/api/results/competitions', {
      method: 'POST',
      body: { name: name.value, venue: venue.value || undefined, date: date.value, notes: notes.value || undefined },
    })
    router.push(`/results/competitions/${created.id}`)
  } catch {
    error.value = 'Aanmaken mislukt. Controleer de invoer.'
  }
}
</script>

<template>
  <div class="max-w-lg space-y-4">
    <h1 class="text-xl font-semibold">Nieuwe wedstrijd</h1>
    <input
      v-model="name"
      placeholder="Naam"
      aria-label="Naam"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    >
    <input
      v-model="venue"
      placeholder="Locatie"
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
      placeholder="Notities"
      aria-label="Notities"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
    />
    <button
      class="rounded-md px-3 py-1.5 text-sm"
      style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
      @click="submit"
    >
      Aanmaken
    </button>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
  </div>
</template>
