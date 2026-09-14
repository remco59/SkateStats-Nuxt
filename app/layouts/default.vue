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

watch(mobileMenuOpen, (open) => {
  if (typeof document === 'undefined') return
  document.documentElement.style.overflow = open ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (typeof document !== 'undefined') document.documentElement.style.overflow = ''
})

const navLinks = [
  {
    to: '/',
    label: 'Dashboard',
    icon: 'M3 12l2-2m0 0l7-7 7 7m-9-9v9m0 0h9a2 2 0 002-2v-7m-11 9v-9',
  },
  {
    to: '/results/competitions',
    label: 'Results',
    icon: 'M9 17V9m4 8V5m4 12v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    to: '/progress/stats',
    label: 'Progress',
    icon: 'M3 3v18h18M7 14l4-4 3 3 5-6',
  },
  {
    to: '/import',
    label: 'Import',
    icon: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  },
]
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row">
    <a href="#main-content" class="skip-link">Ga naar inhoud</a>

    <!-- Desktop sidebar (lg and up) -->
    <aside class="hidden lg:flex sidebar" aria-label="Zijbalk navigatie">
      <div class="sidebar-inner">
        <NuxtLink to="/" class="sidebar-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
            <rect x="2.5" y="7" width="19" height="10" rx="5" stroke="var(--color-accent)" stroke-width="1.6" />
            <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="var(--color-accent)" stroke-width="1.6" opacity="0.5" />
          </svg>
          <span class="gradient-text font-heading font-semibold tracking-tight">SkateStats</span>
        </NuxtLink>

        <nav class="sidebar-nav" aria-label="Hoofdnavigatie">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="sidebar-link"
            active-class="sidebar-link-active"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <path :d="link.icon" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ link.label }}</span>
          </NuxtLink>
        </nav>

        <div class="sidebar-account">
          <NuxtLink to="/account" class="sidebar-link sidebar-link-account" active-class="sidebar-link-active">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" stroke-width="1.7" />
              <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
            <span>{{ user?.skaterName }}</span>
          </NuxtLink>
          <NuxtLink
            v-if="user?.isAdmin"
            to="/admin/users"
            class="sidebar-link"
            active-class="sidebar-link-active"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <circle cx="8.5" cy="8" r="3" stroke="currentColor" stroke-width="1.7" />
              <path d="M2.5 19c.9-3 3-4.6 6-4.6s5.1 1.6 6 4.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
              <circle cx="17.5" cy="7.5" r="2" stroke="currentColor" stroke-width="1.7" />
              <path d="M16 13.2c2.2.4 3.6 1.8 4.2 3.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
            <span>Gebruikers</span>
          </NuxtLink>
          <NuxtLink
            v-if="user?.isAdmin"
            to="/admin/system"
            class="sidebar-link"
            active-class="sidebar-link-active"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <circle cx="12" cy="12" r="2.75" stroke="currentColor" stroke-width="1.7" />
              <path
                d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4M17.8 17.8l-1.4-1.4M7.6 7.6L6.2 6.2"
                stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
              />
            </svg>
            <span>Systeem</span>
          </NuxtLink>
          <button type="button" class="sidebar-link sidebar-logout" @click="logout">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3M16 16l4-4-4-4M20 12H9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Uitloggen</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- Compact top navigation (below lg) -->
    <header class="lg:hidden glass sticky top-0 z-20" style="border-radius: 0; border-width: 0 0 1px 0">
      <div class="page h-14 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="inline-flex items-center gap-1.5 font-heading font-semibold tracking-tight shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
            <rect x="2.5" y="7" width="19" height="10" rx="5" stroke="var(--color-accent)" stroke-width="1.6" />
            <line x1="2.5" y1="12" x2="21.5" y2="12" stroke="var(--color-accent)" stroke-width="1.6" opacity="0.5" />
          </svg>
          <span class="gradient-text">SkateStats</span>
        </NuxtLink>

        <button
          type="button"
          class="menu-toggle"
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

      <div v-if="mobileMenuOpen" id="mobile-menu" class="mobile-menu">
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

    <!-- Mobile menu backdrop -->
    <div
      v-if="mobileMenuOpen"
      class="lg:hidden mobile-backdrop"
      aria-hidden="true"
      @click="closeMobileMenu"
    />

    <div class="flex-1 min-w-0">
      <main id="main-content" class="page w-full py-6 min-w-0">
        <slot />
      </main>
    </div>
  </div>
</template>

<style scoped>
/* ==========================================================================
   Desktop sidebar
   ========================================================================== */
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  width: 252px;
  flex-shrink: 0;
  border-right: 1px solid var(--color-border);
  background: var(--color-surface);
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding: var(--space-5) var(--space-4);
  overflow-y: auto;
}

.sidebar-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.5rem;
  margin-bottom: var(--space-6);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.sidebar-account {
  margin-top: auto;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.sidebar-link {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.55rem 0.6rem;
  border-radius: var(--radius-sm);
  border-left: 2px solid transparent;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.875rem;
  background: transparent;
  border-top: none;
  border-bottom: none;
  border-right: none;
  cursor: pointer;
  text-align: left;
  transition: color var(--transition-fast), background var(--transition-fast), border-color var(--transition-fast);
}

.sidebar-link:hover {
  color: var(--color-text);
  background: var(--highlight-soft);
}

.sidebar-link-active {
  color: var(--color-accent) !important;
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
  border-left-color: var(--color-accent);
}

.sidebar-link-account span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-logout {
  color: var(--color-text-muted);
}

.sidebar-logout:hover {
  color: var(--color-danger);
  background: rgba(239, 68, 68, 0.1);
}

/* ==========================================================================
   Mobile top nav + drawer
   ========================================================================== */
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
  position: relative;
  z-index: 30;
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

.mobile-backdrop {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: var(--scrim);
}
</style>
