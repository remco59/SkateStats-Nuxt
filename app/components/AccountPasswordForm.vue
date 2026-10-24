<script setup lang="ts">
// Changing the password asks for the new one twice, like the old app.
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const message = ref('')
const error = ref('')
const saving = ref(false)

async function save() {
  message.value = ''
  error.value = ''
  saving.value = true
  try {
    await $fetch('/api/account/password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value, confirmPassword: confirmPassword.value },
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    message.value = 'Wachtwoord bijgewerkt.'
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Wachtwoord wijzigen mislukt.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="save">
    <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Wachtwoord</h2>
    <input v-model="currentPassword" type="password" placeholder="Huidig wachtwoord" aria-label="Huidig wachtwoord" autocomplete="current-password" class="field" required>
    <input v-model="newPassword" type="password" placeholder="Nieuw wachtwoord (min. 8 tekens)" aria-label="Nieuw wachtwoord" autocomplete="new-password" class="field" required>
    <input v-model="confirmPassword" type="password" placeholder="Herhaal nieuw wachtwoord" aria-label="Herhaal nieuw wachtwoord" autocomplete="new-password" class="field" required>
    <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">Wachtwoord wijzigen</button>
    <p v-if="message" class="text-sm" style="color: var(--color-success)" role="status">{{ message }}</p>
    <p v-if="error" class="text-sm" style="color: var(--color-danger)" role="alert">{{ error }}</p>
  </form>
</template>
