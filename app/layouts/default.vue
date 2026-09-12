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
    <a href="#main-content" class="skip-link">Ga naar inhoud</a>
    <header class="glass sticky top-0 z-10" style="border-radius: 0; border-width: 0 0 1px 0">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="font-heading font-semibold gradient-text tracking-tight">
          SkateStats
        </NuxtLink>
        <nav
          class="hidden md:flex items-center gap-5 font-mono text-xs uppercase tracking-wider"
          aria-label="Hoofdnavigatie"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="transition-colors hover:text-[var(--color-accent)]"
            style="color: var(--color-text-muted)"
            active-class="!text-[var(--color-accent)]"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
        <div class="flex items-center gap-3 text-sm">
          <NuxtLink to="/account" class="hover:text-[var(--color-accent)] transition-colors">
            {{ user?.skaterName }}
          </NuxtLink>
          <NuxtLink
            v-if="user?.isAdmin"
            to="/admin/users"
            class="hover:text-[var(--color-accent)] transition-colors"
          >
            Admin
          </NuxtLink>
          <button type="button" class="btn btn-ghost !min-h-0 !py-1.5 !px-3 text-sm" @click="logout">
            Uitloggen
          </button>
        </div>
      </div>
      <nav
        class="md:hidden flex items-center gap-4 px-4 pb-2 font-mono text-xs uppercase tracking-wider overflow-x-auto"
        aria-label="Mobiele navigatie"
      >
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          style="color: var(--color-text-muted)"
          active-class="!text-[var(--color-accent)]"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </header>

    <main id="main-content" class="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
      <slot />
    </main>

    <footer
      class="font-mono text-xs text-center py-6 uppercase tracking-widest"
      style="color: var(--color-text-faint)"
    >
      SkateStats
    </footer>
  </div>
</template>
