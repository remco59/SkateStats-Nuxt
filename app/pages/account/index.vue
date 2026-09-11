<script setup lang="ts">
const { data: account, refresh } = await useFetch('/api/account')
const { fetch: refreshSession, clear } = useUserSession()
const router = useRouter()

const skaterName = ref('')
watchEffect(() => {
  if (account.value) skaterName.value = account.value.skaterName
})

const profileSaving = ref(false)
const profileMessage = ref('')
async function saveProfile() {
  profileSaving.value = true
  profileMessage.value = ''
  try {
    await $fetch('/api/account/profile', { method: 'PATCH', body: { skaterName: skaterName.value } })
    await refresh()
    await refreshSession()
    profileMessage.value = 'Opgeslagen.'
  } finally {
    profileSaving.value = false
  }
}

const currentPassword = ref('')
const newPassword = ref('')
const passwordMessage = ref('')
const passwordError = ref('')
async function changePassword() {
  passwordMessage.value = ''
  passwordError.value = ''
  try {
    await $fetch('/api/account/password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value },
    })
    currentPassword.value = ''
    newPassword.value = ''
    passwordMessage.value = 'Wachtwoord gewijzigd.'
  } catch {
    passwordError.value = 'Huidig wachtwoord klopt niet, of nieuw wachtwoord is te kort (min. 8 tekens).'
  }
}

const deleteConfirm = ref(false)
const deleteError = ref('')
async function deleteAccount() {
  deleteError.value = ''
  try {
    await $fetch('/api/account/delete', { method: 'POST' })
    await clear()
    router.push('/login')
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    deleteError.value = err.data?.statusMessage || 'Verwijderen mislukt.'
  }
}
</script>

<template>
  <div class="space-y-8 max-w-xl">
    <h1 class="text-xl font-semibold">Account instellingen</h1>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Profiel</h2>
      <input
        v-model="skaterName"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: var(--color-accent); color: var(--color-accent-contrast)"
        :disabled="profileSaving"
        @click="saveProfile"
      >
        Opslaan
      </button>
      <p v-if="profileMessage" class="text-sm" style="color: var(--color-success)">
        {{ profileMessage }}
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Wachtwoord</h2>
      <input
        v-model="currentPassword"
        type="password"
        placeholder="Huidig wachtwoord"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <input
        v-model="newPassword"
        type="password"
        placeholder="Nieuw wachtwoord (min. 8 tekens)"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border)"
      >
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: var(--color-accent); color: var(--color-accent-contrast)"
        @click="changePassword"
      >
        Wachtwoord wijzigen
      </button>
      <p v-if="passwordMessage" class="text-sm" style="color: var(--color-success)">
        {{ passwordMessage }}
      </p>
      <p v-if="passwordError" class="text-sm" style="color: var(--color-danger)">
        {{ passwordError }}
      </p>
    </section>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-danger)">Account verwijderen</h2>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="deleteConfirm" type="checkbox" >
        Ik weet zeker dat ik mijn account wil verwijderen.
      </label>
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="border: 1px solid var(--color-danger); color: var(--color-danger)"
        :disabled="!deleteConfirm"
        @click="deleteAccount"
      >
        Account verwijderen
      </button>
      <p v-if="deleteError" class="text-sm" style="color: var(--color-danger)">{{ deleteError }}</p>
    </section>
  </div>
</template>
