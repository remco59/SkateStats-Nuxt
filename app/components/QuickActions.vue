<script setup lang="ts">
// Floating quick-add button (old app: the "+" FAB). Gives one-tap access to
// the three most common entry points from every page -- in particular
// "Rit toevoegen", which otherwise needs a trip through a competition page.
const route = useRoute()
const open = ref(false)

const actions = [
  { to: '/import', label: 'Importeren' },
  { to: '/results/competitions/new', label: 'Wedstrijd toevoegen' },
  { to: '/results/races/new', label: 'Rit toevoegen' },
]

function close() {
  open.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(() => route.fullPath, close)
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="fab">
    <div v-if="open" class="fab-backdrop" aria-hidden="true" @click="close" />
    <div class="fab-inner">
      <ul v-if="open" id="quick-actions" class="fab-actions">
        <li v-for="action in actions" :key="action.to">
          <NuxtLink :to="action.to" class="fab-action">{{ action.label }}</NuxtLink>
        </li>
      </ul>
      <button
        type="button"
        class="fab-toggle"
        aria-label="Snelle acties"
        aria-controls="quick-actions"
        :aria-expanded="open"
        @click="open = !open"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          class="fab-icon"
          :class="{ 'fab-icon-open': open }"
        >
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.fab-backdrop {
  position: fixed;
  inset: 0;
  z-index: 18;
  background: var(--scrim);
}

.fab-inner {
  position: fixed;
  right: var(--space-4);
  bottom: var(--space-4);
  z-index: 19;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-3);
}

.fab-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.fab-action {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-height);
  padding: 0 1.1rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border-strong);
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  box-shadow: 0 8px 24px -8px rgba(0, 0, 0, 0.5);
  transition: border-color var(--transition-fast), color var(--transition-fast);
}

.fab-action:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.fab-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  color: #ffffff;
  background: linear-gradient(to right, var(--color-orange-600), var(--color-orange-500));
  box-shadow: var(--shadow-glow-strong);
}

.fab-icon {
  transition: transform var(--transition-med);
}

.fab-icon-open {
  transform: rotate(45deg);
}
</style>
