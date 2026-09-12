<script setup lang="ts">
definePageMeta({ middleware: ['admin-only'] })

const { data: adminUsers, refresh } = await useFetch('/api/admin/users')

const newUsername = ref('')
const newSkaterName = ref('')
const newPassword = ref('')
const newIsAdmin = ref(false)
const createError = ref('')

async function createUser() {
  createError.value = ''
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: {
        username: newUsername.value,
        skaterName: newSkaterName.value,
        password: newPassword.value,
        isAdmin: newIsAdmin.value,
      },
    })
    newUsername.value = ''
    newSkaterName.value = ''
    newPassword.value = ''
    newIsAdmin.value = false
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    createError.value = err.data?.statusMessage || 'Aanmaken mislukt.'
  }
}

const rowErrors = reactive<Record<number, string>>({})

async function toggleAdmin(userId: number, isAdmin: boolean) {
  rowErrors[userId] = ''
  try {
    await $fetch(`/api/admin/users/${userId}/admin`, { method: 'POST', body: { isAdmin } })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    rowErrors[userId] = err.data?.statusMessage || 'Mislukt.'
  }
}

async function deleteUser(userId: number) {
  rowErrors[userId] = ''
  try {
    await $fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    rowErrors[userId] = err.data?.statusMessage || 'Mislukt.'
  }
}

async function resetPassword(userId: number) {
  const newPw = prompt('Nieuw wachtwoord (min. 8 tekens):')
  if (!newPw) return
  rowErrors[userId] = ''
  try {
    await $fetch(`/api/admin/users/${userId}/password`, { method: 'POST', body: { newPassword: newPw } })
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    rowErrors[userId] = err.data?.statusMessage || 'Mislukt.'
  }
}
</script>

<template>
  <div class="space-y-8">
    <h1 class="text-xl font-semibold">Gebruikers</h1>

    <section class="space-y-3 max-w-md">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Nieuwe gebruiker</h2>
      <input
        v-model="newUsername"
        placeholder="Gebruikersnaam"
        aria-label="Gebruikersnaam"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
      <input
        v-model="newSkaterName"
        placeholder="Naam schaatser"
        aria-label="Naam schaatser"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
      <input
        v-model="newPassword"
        type="password"
        placeholder="Wachtwoord"
        aria-label="Wachtwoord"
        class="w-full rounded-md px-3 py-2 text-sm"
        style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      >
      <label class="flex items-center gap-2 text-sm">
        <input v-model="newIsAdmin" type="checkbox" > Beheerder
      </label>
      <button
        class="rounded-md px-3 py-1.5 text-sm"
        style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
        @click="createUser"
      >
        Aanmaken
      </button>
      <p v-if="createError" class="text-sm" style="color: var(--color-danger)">{{ createError }}</p>
    </section>

    <section class="space-y-2">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">
        Bestaande gebruikers
      </h2>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left" style="color: var(--color-text-muted)">
              <th class="py-1 pr-4">Gebruiker</th>
              <th class="py-1 pr-4">Naam</th>
              <th class="py-1 pr-4">Beheerder</th>
              <th class="py-1 pr-4"/>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="u in adminUsers"
              :key="u.id"
              style="border-top: 1px solid var(--color-border)"
            >
              <td class="py-2 pr-4">{{ u.username }}</td>
              <td class="py-2 pr-4">{{ u.skaterName }}</td>
              <td class="py-2 pr-4">
                <input
                  type="checkbox"
                  :checked="u.isAdmin"
                  :aria-label="`${u.username} is beheerder`"
                  @change="toggleAdmin(u.id, ($event.target as HTMLInputElement).checked)"
                >
              </td>
              <td class="py-2 pr-4 space-x-2">
                <button class="underline" @click="resetPassword(u.id)">Reset wachtwoord</button>
                <button class="underline" style="color: var(--color-danger)" @click="deleteUser(u.id)">
                  Verwijderen
                </button>
                <p v-if="rowErrors[u.id]" class="text-xs" style="color: var(--color-danger)">
                  {{ rowErrors[u.id] }}
                </p>
              </td>
            </tr>
            <tr v-if="!adminUsers?.length">
              <td colspan="4" class="py-4" style="color: var(--color-text-muted)">Geen gebruikers.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
