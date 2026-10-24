<script setup lang="ts">
// Global search (old app: the header search box). Always lands on the
// competitions list with ?q=, whose server-side filter matches competition
// name or venue (REBUILD_PLAN.md section 5.5).
//
// aria-label is deliberately just "Zoeken": Playwright's getByLabel() is a
// substring match, and a label like "Zoek op wedstrijd of locatie" would
// collide with the "Locatie" field on the competition forms.
const route = useRoute()
const router = useRouter()

const query = ref('')

function syncFromRoute() {
  query.value = route.path === '/results/competitions' ? String(route.query.q ?? '') : ''
}
syncFromRoute()
watch(() => [route.path, route.query.q], syncFromRoute)

function submit() {
  const q = query.value.trim()
  router.push({ path: '/results/competitions', query: q ? { q } : {} })
}
</script>

<template>
  <form class="nav-search" role="search" @submit.prevent="submit">
    <input
      v-model="query"
      type="search"
      class="field"
      aria-label="Zoeken"
      title="Zoek op wedstrijdnaam of locatie"
      placeholder="Zoeken…"
      autocomplete="off"
    >
    <button type="submit" class="nav-search-button" aria-label="Zoek">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.7" />
        <path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      </svg>
    </button>
  </form>
</template>

<style scoped>
.nav-search {
  position: relative;
  width: 100%;
}

.nav-search .field {
  padding-right: 2.25rem;
}

.nav-search-button {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-faint);
  background: transparent;
  border: none;
  cursor: pointer;
}

.nav-search-button:hover {
  color: var(--color-accent);
}
</style>
