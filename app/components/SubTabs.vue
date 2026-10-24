<script setup lang="ts">
// Second-level navigation for the two sections that group several pages
// (REBUILD_PLAN.md section 11): Results = competitions + races,
// Progress = stats + targets. Without this, /results/races and
// /progress/targets would be reachable only by typing the URL.
const props = defineProps<{ section: 'results' | 'progress' }>()

const route = useRoute()

const sections = {
  results: {
    label: 'Resultaten',
    items: [
      { to: '/results/competitions', label: 'Wedstrijden' },
      { to: '/results/races', label: 'Ritten' },
    ],
  },
  progress: {
    label: 'Voortgang',
    items: [
      { to: '/progress/stats', label: 'Statistieken' },
      { to: '/progress/targets', label: 'Targets' },
    ],
  },
} as const

const current = computed(() => sections[props.section])

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav class="sub-tabs" :aria-label="current.label">
    <NuxtLink
      v-for="item in current.items"
      :key="item.to"
      :to="item.to"
      class="sub-tab"
      :class="{ 'sub-tab-active': isActive(item.to) }"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.sub-tabs {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-5);
  overflow-x: auto;
}

.sub-tab {
  padding: 0.5rem 0.9rem;
  margin-bottom: -1px;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  white-space: nowrap;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}

.sub-tab:hover {
  color: var(--color-text);
}

.sub-tab-active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}
</style>
