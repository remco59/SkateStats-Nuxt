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
      <div class="page h-14 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="font-heading font-semibold gradient-text tracking-tight">
          SkateStats
        </NuxtLink>
        <nav
          class="hidden md:flex items-center gap-1 font-mono text-xs uppercase tracking-wider"
          aria-label="Hoofdnavigatie"
        >
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link inline-flex items-center"
            active-class="nav-link-active"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
        <div class="flex items-center gap-1 text-sm">
          <NuxtLink to="/account" class="nav-link inline-flex items-center !normal-case !tracking-normal !font-sans">
            {{ user?.skaterName }}
          </NuxtLink>
          <NuxtLink
            v-if="user?.isAdmin"
            to="/admin/users"
            class="nav-link hidden items-center lg:inline-flex"
            active-class="nav-link-active"
          >
            Gebruikers
          </NuxtLink>
          <NuxtLink
            v-if="user?.isAdmin"
            to="/admin/system"
            class="nav-link hidden items-center lg:inline-flex"
            active-class="nav-link-active"
          >
            Systeem
          </NuxtLink>
          <button type="button" class="btn btn-ghost btn-sm ml-2" @click="logout">
            Uitloggen
          </button>
        </div>
      </div>
      <nav
        class="md:hidden flex items-center gap-1 px-4 pb-2 font-mono text-xs uppercase tracking-wider overflow-x-auto"
        aria-label="Mobiele navigatie"
      >
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="nav-link inline-flex items-center shrink-0"
          active-class="nav-link-active"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </header>

    <main id="main-content" class="flex-1 page w-full py-6">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.nav-link {
  padding: 0.4rem 0.65rem;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.nav-link:hover {
  color: var(--color-text);
  background: var(--highlight-soft);
}

.nav-link-active {
  color: var(--color-accent) !important;
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
}
</style>
