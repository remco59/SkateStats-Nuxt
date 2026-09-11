<script setup lang="ts">
const props = defineProps<{
  points: { date: string; totalTimeMs: number; raceId: number }[]
}>()

const width = 320
const height = 60
const padding = 6

const path = computed(() => {
  if (props.points.length < 2) return ''
  const times = props.points.map((p) => p.totalTimeMs)
  const min = Math.min(...times)
  const max = Math.max(...times)
  const range = max - min || 1
  const stepX = (width - padding * 2) / (props.points.length - 1)

  return props.points
    .map((p, i) => {
      const x = padding + i * stepX
      // Faster (lower) times plot higher on the chart.
      const y = padding + ((p.totalTimeMs - min) / range) * (height - padding * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg
    v-if="points.length >= 2"
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="overflow-visible"
  >
    <path :d="path" fill="none" stroke="var(--color-accent)" stroke-width="2" />
  </svg>
  <p v-else class="text-xs" style="color: var(--color-text-muted)">Nog niet genoeg data.</p>
</template>
