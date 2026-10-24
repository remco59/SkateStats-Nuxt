<script setup lang="ts">
// Deleting your account means typing your username in a confirmation dialog
// (a checkbox was too easy to tick by accident).
const props = defineProps<{ username: string }>()

const { clear } = useUserSession()
const router = useRouter()

const dialog = ref<InstanceType<typeof import('./ConfirmDialog.vue').default>>()
const busy = ref(false)
const error = ref('')

async function remove() {
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/account/delete', { method: 'POST', body: { confirmUsername: props.username } })
    await clear()
    await router.push('/login')
  } catch (e: unknown) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err.data?.statusMessage || 'Verwijderen mislukt.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="space-y-3">
    <h2 class="text-sm font-medium" style="color: var(--color-danger)">Account verwijderen</h2>
    <p class="text-xs" style="color: var(--color-text-muted)">
      Verwijdert je account met alle wedstrijden, ritten en targets. Dit kan niet ongedaan worden gemaakt.
    </p>
    <button type="button" class="btn btn-danger btn-sm" @click="dialog?.open()">Account verwijderen</button>
    <ConfirmDialog
      ref="dialog"
      title="Account verwijderen?"
      message="Al je data wordt definitief verwijderd."
      confirm-label="Account verwijderen"
      :require-text="username"
      :busy="busy"
      @confirm="remove"
    >
      <p v-if="error" class="text-sm mb-3" style="color: var(--color-danger)" role="alert">{{ error }}</p>
    </ConfirmDialog>
  </section>
</template>
