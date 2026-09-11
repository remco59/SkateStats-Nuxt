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
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    >
    <input
      v-model="venue"
      placeholder="Locatie"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    >
    <input
      v-model="date"
      type="date"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    >
    <textarea
      v-model="notes"
      placeholder="Notities"
      class="w-full rounded-md px-3 py-2 text-sm"
      style="border: 1px solid var(--color-border)"
    />
    <button
      class="rounded-md px-3 py-1.5 text-sm"
      style="background: var(--color-accent); color: var(--color-accent-contrast)"
      @click="submit"
    >
      Aanmaken
    </button>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
  </div>
</template>
