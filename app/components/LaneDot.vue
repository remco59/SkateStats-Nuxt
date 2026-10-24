<script setup lang="ts">
// The start lane as the old app drew it: a white dot for the inner lane
// ("binnen"), a red one for the outer lane ("buiten"), an empty ring for
// anything else that was entered (e.g. the PDF's "gl").
const props = defineProps<{ lane: string | null | undefined; showText?: boolean }>()

const kind = computed(() => {
  const value = (props.lane ?? '').toLowerCase()
  if (value.includes('binnen')) return 'inner'
  if (value.includes('buiten')) return 'outer'
  return 'unknown'
})

const description = computed(() =>
  kind.value === 'inner' ? 'Binnenbaan' : kind.value === 'outer' ? 'Buitenbaan' : (props.lane ?? ''),
)
</script>

<template>
  <span v-if="lane && lane.trim()" class="lane">
    <span class="lane-dot" :class="`lane-dot-${kind}`" role="img" :aria-label="description" :title="description" />
    <span v-if="showText">{{ lane }}</span>
  </span>
  <span v-else class="delta-neutral">-</span>
</template>

<style scoped>
.lane {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  vertical-align: middle;
}

.lane-dot {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  border: 1px solid var(--color-border-strong);
  background: transparent;
}

.lane-dot-inner {
  background: #ffffff;
  border-color: var(--color-border-strong);
}

.lane-dot-outer {
  background: #e13a3a;
  border-color: #e13a3a;
}
</style>
