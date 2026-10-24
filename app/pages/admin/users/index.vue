<script setup lang="ts">
definePageMeta({ middleware: ['admin-only'] })

const { data: adminUsers, refresh } = await useFetch('/api/admin/users')
const { user: me, clear } = useUserSession()
const router = useRouter()

type AdminUser = NonNullable<typeof adminUsers.value>[number]

const errorOf = (e: unknown, fallback: string) => (e as { data?: { statusMessage?: string } }).data?.statusMessage || fallback

const flash = ref('')

// ---- Search ---------------------------------------------------------------
const search = ref('')
const visibleUsers = computed(() => {
  const q = search.value.trim().toLowerCase()
  const sorted = [...(adminUsers.value ?? [])].sort((a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase()))
  return q ? sorted.filter((u) => `${u.skaterName} ${u.username}`.toLowerCase().includes(q)) : sorted
})

// ---- New user -------------------------------------------------------------
const newUsername = ref('')
const newSkaterName = ref('')
const newPassword = ref('')
const newConfirm = ref('')
const newIsAdmin = ref(false)
const createError = ref('')

async function createUser() {
  createError.value = ''
  flash.value = ''
  try {
    await $fetch('/api/admin/users', {
      method: 'POST',
      body: {
        username: newUsername.value,
        skaterName: newSkaterName.value,
        password: newPassword.value,
        confirmPassword: newConfirm.value,
        isAdmin: newIsAdmin.value,
      },
    })
    newUsername.value = ''
    newSkaterName.value = ''
    newPassword.value = ''
    newConfirm.value = ''
    newIsAdmin.value = false
    flash.value = 'Gebruiker aangemaakt.'
    await refresh()
  } catch (e) {
    createError.value = errorOf(e, 'Aanmaken mislukt.')
  }
}

// ---- Admin rights ---------------------------------------------------------
const rowErrors = reactive<Record<number, string>>({})

async function toggleAdmin(userId: number, box: HTMLInputElement) {
  const isAdmin = box.checked
  rowErrors[userId] = ''
  flash.value = ''
  try {
    await $fetch(`/api/admin/users/${userId}/admin`, { method: 'POST', body: { isAdmin } })
    flash.value = 'Rol bijgewerkt.'
    await refresh()
  } catch (e) {
    rowErrors[userId] = errorOf(e, 'Mislukt.')
    box.checked = !isAdmin // refused: put the checkbox back
  }
}

// ---- Reset password ---------------------------------------------------------
const passwordModal = ref<InstanceType<typeof import('~/components/Modal.vue').default>>()
const passwordTarget = ref<AdminUser | null>(null)
const resetPassword = ref('')
const resetConfirm = ref('')
const resetError = ref('')

function openPasswordReset(u: AdminUser) {
  passwordTarget.value = u
  resetPassword.value = ''
  resetConfirm.value = ''
  resetError.value = ''
  passwordModal.value?.open()
}

async function submitPasswordReset() {
  if (!passwordTarget.value) return
  resetError.value = ''
  try {
    await $fetch(`/api/admin/users/${passwordTarget.value.id}/password`, {
      method: 'POST',
      body: { newPassword: resetPassword.value, confirmPassword: resetConfirm.value },
    })
    flash.value = `Wachtwoord van ${passwordTarget.value.username} bijgewerkt.`
    passwordModal.value?.close()
  } catch (e) {
    resetError.value = errorOf(e, 'Wachtwoord opslaan mislukt.')
  }
}

// ---- Delete (typed username) --------------------------------------------------
const deleteDialog = ref<InstanceType<typeof import('~/components/ConfirmDialog.vue').default>>()
const deleteTarget = ref<AdminUser | null>(null)
const deleteError = ref('')
const deleting = ref(false)

function openDelete(u: AdminUser) {
  deleteTarget.value = u
  deleteError.value = ''
  deleteDialog.value?.open()
}

async function confirmDelete() {
  const target = deleteTarget.value
  if (!target) return
  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/admin/users/${target.id}`, { method: 'DELETE', body: { confirmUsername: target.username } })
    deleteDialog.value?.close()
    if (target.id === me.value?.id) {
      await clear()
      await router.push('/login')
      return
    }
    flash.value = 'Account verwijderd.'
    await refresh()
  } catch (e) {
    deleteError.value = errorOf(e, 'Verwijderen mislukt.')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="page-title">Gebruikers</h1>
      <p class="text-secondary text-sm">Beheer accounts en reset wachtwoorden.</p>
    </div>

    <p v-if="flash" class="notice notice-accent" role="status">{{ flash }}</p>

    <form class="space-y-3 max-w-md" @submit.prevent="createUser">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Nieuwe gebruiker</h2>
      <input v-model="newUsername" placeholder="Gebruikersnaam" aria-label="Gebruikersnaam" class="field" autocomplete="off" required>
      <input v-model="newSkaterName" placeholder="Naam schaatser" aria-label="Naam schaatser" class="field" autocomplete="off" required>
      <input v-model="newPassword" type="password" placeholder="Tijdelijk wachtwoord (min. 8 tekens)" aria-label="Wachtwoord" class="field" autocomplete="new-password" required>
      <input v-model="newConfirm" type="password" placeholder="Herhaal wachtwoord" aria-label="Herhaal wachtwoord" class="field" autocomplete="new-password" required>
      <label class="flex items-center gap-2 text-sm">
        <input v-model="newIsAdmin" type="checkbox"> Adminrechten geven
      </label>
      <button type="submit" class="btn btn-primary btn-sm">Gebruiker toevoegen</button>
      <p v-if="createError" class="text-sm" style="color: var(--color-danger)" role="alert">{{ createError }}</p>
    </form>

    <section class="space-y-3">
      <h2 class="text-sm font-medium" style="color: var(--color-text-muted)">Bestaande gebruikers</h2>
      <input v-model="search" type="search" placeholder="Zoek op schaatsernaam of gebruikersnaam" aria-label="Zoeken" class="field max-w-md">
      <div class="overflow-x-auto">
        <table class="table">
          <thead>
            <tr>
              <th>Gebruiker</th>
              <th>Naam</th>
              <th>Beheerder</th>
              <th><span class="sr-only">Acties</span></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in visibleUsers" :key="u.id">
              <td>{{ u.username }}</td>
              <td>{{ u.skaterName }}</td>
              <td>
                <input
                  type="checkbox"
                  :checked="u.isAdmin"
                  :aria-label="`${u.username} is beheerder`"
                  @change="toggleAdmin(u.id, $event.target as HTMLInputElement)"
                >
              </td>
              <td class="space-x-3 whitespace-nowrap">
                <button type="button" class="btn-link" @click="openPasswordReset(u)">Reset wachtwoord</button>
                <button type="button" class="btn-link" style="color: var(--color-danger)" @click="openDelete(u)">
                  Verwijderen
                </button>
                <p v-if="rowErrors[u.id]" class="text-xs" style="color: var(--color-danger)">{{ rowErrors[u.id] }}</p>
              </td>
            </tr>
            <tr v-if="!visibleUsers.length">
              <td colspan="4" class="text-secondary">{{ adminUsers?.length ? 'Geen gebruikers gevonden.' : 'Geen gebruikers.' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <Modal ref="passwordModal" :title="`Wachtwoord resetten: ${passwordTarget?.username ?? ''}`">
      <form class="space-y-3" @submit.prevent="submitPasswordReset">
        <input v-model="resetPassword" type="password" placeholder="Nieuw wachtwoord (min. 8 tekens)" aria-label="Nieuw wachtwoord" class="field" autocomplete="new-password" required>
        <input v-model="resetConfirm" type="password" placeholder="Herhaal wachtwoord" aria-label="Herhaal nieuw wachtwoord" class="field" autocomplete="new-password" required>
        <p v-if="resetError" class="text-sm" style="color: var(--color-danger)" role="alert">{{ resetError }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secondary btn-sm" @click="passwordModal?.close()">Annuleren</button>
          <button type="submit" class="btn btn-primary btn-sm">Wachtwoord opslaan</button>
        </div>
      </form>
    </Modal>

    <ConfirmDialog
      ref="deleteDialog"
      :title="`${deleteTarget?.skaterName ?? ''} verwijderen?`"
      message="Het account en alle bijbehorende wedstrijden, ritten en targets worden definitief verwijderd."
      confirm-label="Account verwijderen"
      :require-text="deleteTarget?.username"
      :busy="deleting"
      @confirm="confirmDelete"
    >
      <p v-if="deleteError" class="text-sm mb-3" style="color: var(--color-danger)" role="alert">{{ deleteError }}</p>
    </ConfirmDialog>
  </div>
</template>
