<script setup lang="ts">
import { RACE_TAG_LABELS, type RaceTag } from '#shared/constants'

// One tint per tag, like the old app's tag pills. Colours are mixed into the
// theme's text colour so they stay readable in both the dark and light theme.
const props = defineProps<{ tag: string | null | undefined }>()

const HUES: Record<RaceTag, string> = {
  training: '#3d8bfd',
  test: '#8b5cf6',
  important: '#f97316',
  bad_ice: '#64748b',
  sick: '#e11d48',
  injured: '#f59e0b',
  fallen: '#ef4444',
}

const label = computed(() => (props.tag ? (RACE_TAG_LABELS[props.tag as RaceTag] ?? props.tag) : ''))
const hue = computed(() => HUES[props.tag as RaceTag] ?? '#64748b')
</script>

<template>
  <span v-if="tag" class="race-tag" :style="{ '--hue': hue }">{{ label }}</span>
</template>

<style scoped>
.race-tag {
  display: inline-flex;
  align-items: center;
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
  vertical-align: middle;
  color: color-mix(in srgb, var(--hue) 65%, var(--color-text));
  background: color-mix(in srgb, var(--hue) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--hue) 45%, transparent);
}
</style>
