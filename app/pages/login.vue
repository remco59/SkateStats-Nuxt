<script setup lang="ts">
definePageMeta({ layout: false })

const { fetch: refreshSession } = useUserSession()
const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function submit() {
  error.value = ''
  submitting.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await refreshSession()
    const next = typeof route.query.next === 'string' ? route.query.next : '/'
    router.push(next)
  } catch {
    error.value = 'Ongeldige inloggegevens.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center px-4"
    style="background: var(--color-bg)"
  >
    <form
      class="w-full max-w-sm rounded-lg p-6 space-y-4"
      style="border: 1px solid var(--color-border); background: var(--color-surface); box-shadow: var(--shadow-card)"
      @submit.prevent="submit"
    >
      <h1 class="font-heading text-2xl font-semibold gradient-text">SkateStats</h1>
      <div class="space-y-1">
        <label class="text-sm" for="username">Gebruikersnaam</label>
        <input
          id="username"
          v-model="username"
          type="text"
          required
          class="w-full rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border); background: var(--color-surface)"
        >
      </div>
      <div class="space-y-1">
        <label class="text-sm" for="password">Wachtwoord</label>
        <input
          id="password"
          v-model="password"
          type="password"
          required
          class="w-full rounded-md px-3 py-2 text-sm"
          style="border: 1px solid var(--color-border); background: var(--color-surface)"
        >
      </div>
      <p v-if="error" class="text-sm" style="color: var(--color-danger)">{{ error }}</p>
      <button
        type="submit"
        :disabled="submitting"
        class="w-full rounded-md py-2 text-sm font-medium"
        style="background: linear-gradient(to right, var(--color-accent-2), var(--color-accent)); color: #fff; box-shadow: var(--shadow-glow)"
      >
        Inloggen
      </button>
    </form>
  </div>
</template>
