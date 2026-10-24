<script setup lang="ts">
// Username and skater name, with the old app's errors ("al in gebruik",
// "al gekoppeld aan ander account").
const props = defineProps<{ username: string; skaterName: string }>()
const emit = defineEmits<{ saved: [] }>()

const { fetch: refreshSession } = useUserSession()

const username = ref(props.username)
const skaterName = ref(props.skaterName)
watch(() => [props.username, props.skaterName], ([u, s]) => {
  username.value = u!
  skaterName.value = s!
})

const saving = ref(false)
const message = ref('')
const error = ref('')

async function save() {
  saving.value = true
  message.value = ''
  error.value = ''
  try {
    await $fetch('/api/account/identity', { method: 'PATCH', body: { username: username.value, skaterName: skaterName.value } })
    await refreshSession()
    emit('saved')
    message.value = 'Profiel bijgewerkt.'
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Opslaan mislukt.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="save">
    <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Profiel</h2>
    <label class="block text-sm space-y-1">
      <span style="color: var(--color-text-muted)">Gebruikersnaam</span>
      <input v-model="username" class="field" autocomplete="username" required>
    </label>
    <label class="block text-sm space-y-1">
      <span style="color: var(--color-text-muted)">Schaatsersnaam</span>
      <input v-model="skaterName" class="field" required>
    </label>
    <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">Opslaan</button>
    <p v-if="message" class="text-sm" style="color: var(--color-success)" role="status">{{ message }}</p>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)" role="alert">{{ error }}</p>
  </form>
</template>
