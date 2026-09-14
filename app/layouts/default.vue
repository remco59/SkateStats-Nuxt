<script setup lang="ts">
const { user, clear } = useUserSession()
const router = useRouter()
const route = useRoute()

const mobileMenuOpen = ref(false)

async function logout() {
  mobileMenuOpen.value = false
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  router.push('/login')
}

function closeMobileMenu() {
  mobileMenuOpen.value = false
}

watch(() => route.fullPath, closeMobileMenu)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeMobileMenu()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

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
    <header class="glass sticky top-0 z-20" style="border-radius: 0; border-width: 0 0 1px 0">
      <div class="page h-14 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="inline-flex items-center gap-1.5 font-heading font-semibold tracking-tight shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
            <rect x="2.5" y="7" width="19" height="10" rx="5" stroke="var(--color-accent)" stroke-width="1.6" />
            <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="var(--color-accent)" stroke-width="1.6" opacity="0.5" />
          </svg>
          <span class="gradient-text">SkateStats</span>
        </NuxtLink>

        <nav
          class="hidden md:flex items-center gap-1 font-mono text-xs uppercase tracking-wider min-w-0"
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

        <div class="hidden md:flex items-center gap-1 text-sm min-w-0">
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

        <button
          type="button"
          class="md:hidden menu-toggle"
          aria-controls="mobile-menu"
          aria-label="Menu"
          :aria-expanded="mobileMenuOpen"
          @click="mobileMenuOpen = !mobileMenuOpen"
        >
          <svg v-if="!mobileMenuOpen" width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div v-if="mobileMenuOpen" id="mobile-menu" class="md:hidden mobile-menu">
        <nav class="flex flex-col gap-1 px-4 py-3" aria-label="Mobiele navigatie">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="nav-link nav-link-block"
            active-class="nav-link-active"
          >
            {{ link.label }}
          </NuxtLink>
        </nav>
        <div class="mobile-menu-divider" />
        <div class="flex flex-col gap-1 px-4 py-3">
          <NuxtLink to="/account" class="nav-link nav-link-block !normal-case !tracking-normal !font-sans">
            {{ user?.skaterName }}
          </NuxtLink>
          <NuxtLink
            v-if="user?.isAdmin"
            to="/admin/users"
            class="nav-link nav-link-block"
            active-class="nav-link-active"
          >
            Gebruikers
          </NuxtLink>
          <NuxtLink
            v-if="user?.isAdmin"
            to="/admin/system"
            class="nav-link nav-link-block"
            active-class="nav-link-active"
          >
            Systeem
          </NuxtLink>
          <button type="button" class="btn btn-ghost btn-sm mt-2 w-full" @click="logout">
            Uitloggen
          </button>
        </div>
      </div>
    </header>

    <main id="main-content" class="flex-1 page w-full py-6 min-w-0">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.nav-link {
  position: relative;
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
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.nav-link-active::after {
  content: '';
  position: absolute;
  left: 0.65rem;
  right: 0.65rem;
  bottom: 1px;
  height: 2px;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
}

.nav-link-block.nav-link-active::after {
  display: none;
}

.nav-link-block {
  display: flex;
  align-items: center;
  font-family: var(--font-sans);
  font-size: 0.9rem;
  text-transform: none;
  letter-spacing: normal;
  padding: 0.6rem 0.75rem;
  border-left: 2px solid transparent;
}

.nav-link-block.nav-link-active {
  border-left-color: var(--color-accent);
}

.menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-sm);
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border);
  flex-shrink: 0;
}

.menu-toggle:hover {
  background: var(--highlight-soft);
}

.mobile-menu {
  border-top: 1px solid var(--color-border);
  background: var(--color-surface);
  max-height: calc(100vh - 3.5rem);
  overflow-y: auto;
}

.mobile-menu-divider {
  height: 1px;
  margin: 0 var(--space-4);
  background: var(--color-border);
}
</style>
