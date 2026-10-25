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

// `match` is the path prefix that marks a link active. The Results and
// Progress links point at their first tab, so NuxtLink's own active-class
// would not highlight them on /results/races or /progress/targets.
const navLinks = [
  {
    to: '/',
    match: '/',
    label: 'Overzicht',
    icon: 'M3 12l2-2m0 0l7-7 7 7m-9-9v9m0 0h9a2 2 0 002-2v-7m-11 9v-9',
  },
  {
    to: '/results/competitions',
    match: '/results',
    label: 'Resultaten',
    icon: 'M9 17V9m4 8V5m4 12v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z',
  },
  {
    to: '/progress/stats',
    match: '/progress',
    label: 'Voortgang',
    icon: 'M3 3v18h18M7 14l4-4 3 3 5-6',
  },
  {
    to: '/import',
    match: '/import',
    label: 'Importeren',
    icon: 'M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2',
  },
]

function isActive(link: { match: string }) {
  if (link.match === '/') return route.path === '/'
  return route.path === link.match || route.path.startsWith(`${link.match}/`)
}

const year = new Date().getFullYear()
</script>

<template>
  <div class="min-h-screen flex flex-col lg:flex-row">
    <a href="#main-content" class="skip-link">Ga naar inhoud</a>

    <!-- Desktop sidebar (lg and up) -->
    <aside class="hidden lg:flex sidebar" aria-label="Zijbalk navigatie">
      <div class="sidebar-inner">
        <NuxtLink to="/" class="sidebar-brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
            <rect x="2.5" y="6" width="19" height="12" rx="6" stroke="var(--color-accent)" stroke-width="1.8" />
            <rect x="6.5" y="9.5" width="11" height="5" rx="2.5" stroke="var(--color-accent)" stroke-width="1.8" />
          </svg>
          <span class="brand-word">SkateStats</span>
        </NuxtLink>

        <NavSearch class="sidebar-search" />

        <nav class="sidebar-nav" aria-label="Hoofdnavigatie">
          <NuxtLink
            v-for="link in navLinks"
            :key="link.to"
            :to="link.to"
            class="sidebar-link"
            :class="{ 'sidebar-link-active': isActive(link) }"
            :aria-current="isActive(link) ? 'page' : undefined"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <path :d="link.icon" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>{{ link.label }}</span>
          </NuxtLink>
        </nav>

        <div class="sidebar-account">
          <NuxtLink to="/account" class="sidebar-link sidebar-link-account" active-class="sidebar-link-active">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <circle cx="12" cy="12" r="2.75" stroke="currentColor" stroke-width="1.7" />
              <path
                d="M12 3.5v2M12 18.5v2M20.5 12h-2M5.5 12h-2M17.8 6.2l-1.4 1.4M7.6 16.4l-1.4 1.4M17.8 17.8l-1.4-1.4M7.6 7.6L6.2 6.2"
                stroke="currentColor" stroke-width="1.7" stroke-linecap="round"
              />
            </svg>
            <span>Systeem</span>
          </NuxtLink>
          <button type="button" class="sidebar-link sidebar-logout" @click="logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
              <path d="M9 4H6a2 2 0 00-2 2v12a2 2 0 002 2h3M16 16l4-4-4-4M20 12H9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span>Uitloggen</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- Compact top bar (below lg): brand and the account menu. The four
         destinations live in the tab bar at the bottom, in thumb reach. -->
    <header class="lg:hidden topbar glass sticky top-0 z-20">
      <div class="page h-14 flex items-center justify-between gap-4">
        <NuxtLink to="/" class="sidebar-brand shrink-0">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" class="shrink-0">
            <rect x="2.5" y="6" width="19" height="12" rx="6" stroke="var(--color-accent)" stroke-width="1.8" />
            <rect x="6.5" y="9.5" width="11" height="5" rx="2.5" stroke="var(--color-accent)" stroke-width="1.8" />
          </svg>
          <span class="brand-word">SkateStats</span>
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
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
          <svg v-else width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <path d="M5 5l12 12M17 5L5 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <div v-if="mobileMenuOpen" id="mobile-menu" class="mobile-menu">
        <div class="px-4 pt-3">
          <NavSearch />
        </div>
        <div class="flex flex-col gap-1 px-4 py-3">
          <NuxtLink to="/account" class="nav-link nav-link-block" active-class="nav-link-active">
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
          <button type="button" class="btn btn-ghost mt-2 w-full" @click="logout">
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

    <div class="flex-1 min-w-0 flex flex-col">
      <main id="main-content" class="page w-full py-6 min-w-0 flex-1">
        <slot />
      </main>
      <footer class="app-footer">
        SkateStats &bull; Copyright {{ year }} &bull; Gemaakt met
        <span class="app-footer-heart" role="img" aria-label="liefde">&hearts;</span>
        door Remco Land
      </footer>
    </div>

    <!-- Bottom tab bar (below lg) -->
    <nav class="lg:hidden tabbar" aria-label="Hoofdnavigatie">
      <NuxtLink
        v-for="link in navLinks"
        :key="link.to"
        :to="link.to"
        class="tabbar-link"
        :class="{ 'tabbar-link-active': isActive(link) }"
        :aria-current="isActive(link) ? 'page' : undefined"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path :d="link.icon" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ link.label }}</span>
      </NuxtLink>
    </nav>

    <QuickActions />
  </div>
</template>

<style scoped>
/* ==========================================================================
   Brand
   ========================================================================== */
.sidebar-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
}

.brand-word {
  font-family: var(--font-display);
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text);
}

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

.sidebar .sidebar-brand {
  padding: 0 0.5rem;
  margin-bottom: var(--space-5);
}

.sidebar-search {
  margin-bottom: var(--space-4);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.app-footer {
  padding: var(--space-5) var(--space-4) calc(var(--space-5) + var(--tabbar-h) + 3.5rem);
  text-align: center;
  font-size: 0.8125rem;
  color: var(--color-text-faint);
}

.app-footer-heart {
  color: var(--color-accent);
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
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  width: 100%;
  min-height: 2.5rem;
  padding: 0.5rem 0.7rem;
  border-radius: var(--radius-md);
  border: none;
  color: var(--color-text-muted);
  font-family: var(--font-sans);
  font-size: 0.9375rem;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: color var(--transition-fast), background var(--transition-fast);
}

.sidebar-link:hover {
  color: var(--color-text);
  background: var(--highlight-soft);
}

.sidebar-link.sidebar-link-active {
  color: var(--color-accent);
  font-weight: 600;
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
}

/* A short lane tick marks the current page. */
.sidebar-link.sidebar-link-active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 3px;
  height: 1.1rem;
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  transform: translateY(-50%);
}

.sidebar-link-account span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-logout:hover {
  color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, transparent);
}

/* ==========================================================================
   Mobile top bar, drawer and bottom tab bar
   ========================================================================== */
.topbar {
  z-index: 21;
  border-radius: 0;
  border-width: 0 0 1px 0;
}

.nav-link {
  position: relative;
  padding: 0.4rem 0.65rem;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.nav-link:hover {
  color: var(--color-text);
  background: var(--highlight-soft);
}

.nav-link.nav-link-active {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
}

.nav-link-block {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  font-family: var(--font-sans);
  font-size: 1rem;
  padding: 0.6rem 0.75rem;
}

.menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: var(--radius-md);
  color: var(--color-text);
  background: transparent;
  border: 1px solid var(--color-border-strong);
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
  max-height: calc(100vh - 3.5rem - var(--tabbar-h));
  overflow-y: auto;
}

.mobile-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  background: var(--scrim);
}

.tabbar {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 17;
  display: none;
  grid-template-columns: repeat(4, 1fr);
  height: calc(var(--tabbar-h) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-strong);
}

@media (max-width: 1023.98px) {
  .tabbar {
    display: grid;
  }
}

.tabbar-link {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  color: var(--color-text-muted);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1;
}

.tabbar-link:hover {
  color: var(--color-text);
}

.tabbar-link.tabbar-link-active {
  color: var(--color-accent);
  font-weight: 700;
}

/* The lane line of the current tab sits on the bar's top edge. */
.tabbar-link.tabbar-link-active::before {
  content: '';
  position: absolute;
  top: -1px;
  left: 22%;
  right: 22%;
  height: 3px;
  border-radius: 0 0 var(--radius-pill) var(--radius-pill);
  background: var(--color-accent);
}
</style>
