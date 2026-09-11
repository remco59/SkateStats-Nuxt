<script setup lang="ts">
const { user, clear } = useUserSession()
const router = useRouter()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  router.push('/login')
}

const navLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/results/competitions', label: 'Results' },
  { to: '/progress/stats', label: 'Progress' },
  { to: '/import', label: 'Import' },
]
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header
      class="border-b sticky top-0 z-10"
      style="background: var(--color-bg); border-color: var(--color-border)"
    >
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="font-semibold" style="color: var(--color-accent)">
          SkateStats
        </NuxtLink>
        <nav class="hidden md:flex items-center gap-5 text-sm">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="hover:opacity-80"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
        <div class="flex items-center gap-3 text-sm">
          <NuxtLink to="/account" class="hover:opacity-80">{{ user?.skaterName }}</NuxtLink>
          <NuxtLink v-if="user?.isAdmin" to="/admin/users" class="hover:opacity-80">
            Admin
          </NuxtLink>
          <button
            type="button"
            class="px-3 py-1.5 rounded-md text-sm"
            style="border: 1px solid var(--color-border)"
            @click="logout"
          >
            Uitloggen
          </button>
        </div>
      </div>
      <nav class="md:hidden flex items-center gap-4 px-4 pb-2 text-sm overflow-x-auto">
        <NuxtLink v-for="link in navLinks" :key="link.to" :to="link.to">{{ link.label }}</NuxtLink>
      </nav>
    </header>

    <main class="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
      <slot />
    </main>

    <footer
      class="text-xs text-center py-6"
      style="color: var(--color-text-muted)"
    >
      SkateStats
    </footer>
  </div>
</template>
