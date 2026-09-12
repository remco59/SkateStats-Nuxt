<script setup lang="ts">
const props = defineProps<{
  values: (number | null)[]
}>()

const width = 480
const height = 140
const padding = 10

const path = computed(() => {
  const points = props.values.map((v, i) => ({ v, i })).filter((p) => p.v !== null) as { v: number; i: number }[]
  if (points.length < 2) return { line: '', zeroY: height / 2 }

  const vals = points.map((p) => p.v)
  const min = Math.min(...vals, 0)
  const max = Math.max(...vals, 0)
  const range = max - min || 1
  const stepX = (width - padding * 2) / (props.values.length - 1)

  const y = (v: number) => padding + (1 - (v - min) / range) * (height - padding * 2)

  const line = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${(padding + p.i * stepX).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(' ')

  return { line, zeroY: y(0) }
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    :width="width"
    :height="height"
    class="w-full h-auto"
    role="img"
    aria-label="Verschil per onderdeel ten opzichte van de vergelijkingsrit"
  >
    <line :y1="path.zeroY" :y2="path.zeroY" x1="0" :x2="width" stroke="var(--color-border)" stroke-dasharray="4 4" />
    <path :d="path.line" fill="none" stroke="var(--color-accent)" stroke-width="2" />
  </svg>
</template>
