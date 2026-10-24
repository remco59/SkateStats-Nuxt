<script setup lang="ts">
import type { Sparkline, SparklineCircle } from '#shared/utils/sparkline'

/**
 * Per-distance trend, drawn like the old app's sparkline: x follows the date,
 * month (or year) ticks along the baseline, a tooltip with time, race and date
 * plus an "Open rit" link -- after a short hover delay with a mouse, on tap
 * with touch. A click on a point with a mouse goes straight to the race.
 */
const props = defineProps<{
  sparkline: Sparkline | null
  distanceM: number
  latest: { raceId: number; totalTimeMs: number; date: string }
}>()

const HOVER_DELAY_MS = 250

const wrap = ref<HTMLElement | null>(null)
const active = ref<SparklineCircle | null>(null)
const tooltipStyle = ref<Record<string, string>>({})
const tooltipEl = ref<HTMLElement | null>(null)
let hoverTimer: ReturnType<typeof setTimeout> | null = null

const isCoarse = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

const linePoints = computed(() => props.sparkline?.circles.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') ?? '')

function clearTimer() {
  if (hoverTimer) clearTimeout(hoverTimer)
  hoverTimer = null
}

async function show(circle: SparklineCircle) {
  clearTimer()
  active.value = circle
  await nextTick()
  const w = wrap.value
  const spark = props.sparkline
  if (!w || !spark) return
  const rect = w.getBoundingClientRect()
  const scale = rect.width / spark.width
  const tipW = tooltipEl.value?.offsetWidth ?? 180
  const tipH = tooltipEl.value?.offsetHeight ?? 100
  const left = Math.min(Math.max(circle.x * scale - tipW / 2, 4), Math.max(rect.width - tipW - 4, 4))
  // Above the point when there is room; otherwise below it, so the tooltip
  // never covers the point being hovered (it would swallow the click).
  const above = circle.y * scale - tipH - 12
  const top = above >= 4 ? above : circle.y * scale + 12
  tooltipStyle.value = { left: `${left}px`, top: `${top}px` }
}

function hide() {
  clearTimer()
  active.value = null
}

function onEnter(circle: SparklineCircle) {
  if (isCoarse()) return
  // Once a tooltip is open, moving to the next point switches at once.
  if (active.value) return void show(circle)
  clearTimer()
  hoverTimer = setTimeout(() => show(circle), HOVER_DELAY_MS)
}

function onClick(circle: SparklineCircle) {
  if (isCoarse()) return void show(circle)
  void navigateTo(`/results/races/${circle.raceId}`)
}

function onDocumentClick(event: MouseEvent) {
  if (active.value && !wrap.value?.contains(event.target as Node)) hide()
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  clearTimer()
})

const label = computed(() => {
  const s = props.sparkline
  if (!s) return ''
  const first = s.circles[0]!
  const last = s.circles[s.circles.length - 1]!
  return `Ontwikkeling ${props.distanceM}m over ${s.circles.length} ritten, van ${fmtMs(first.totalTimeMs)} naar ${fmtMs(last.totalTimeMs)}`
})
</script>

<template>
  <div v-if="sparkline" ref="wrap" class="sparkline-wrap" @mouseleave="isCoarse() ? undefined : hide()">
    <svg
      class="sparkline"
      :viewBox="`0 0 ${sparkline.width} ${sparkline.height}`"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      :aria-label="label"
    >
      <line
        :x1="sparkline.leftPadding"
        :x2="sparkline.width - sparkline.rightPadding"
        :y1="sparkline.baselineY"
        :y2="sparkline.baselineY"
        class="sparkline-axis"
      />
      <g v-for="tick in sparkline.ticks" :key="tick.x">
        <line :x1="tick.x" :x2="tick.x" :y1="sparkline.baselineY" :y2="sparkline.baselineY + 5" class="sparkline-axis" />
        <text :x="tick.x" :y="sparkline.baselineY + 16" class="sparkline-label">{{ tick.label }}</text>
      </g>
      <polyline :points="linePoints" class="sparkline-line" />
      <circle
        v-for="c in sparkline.circles"
        :key="c.raceId"
        :cx="c.x"
        :cy="c.y"
        r="4.5"
        class="sparkline-dot"
        :class="{ 'is-active': active?.raceId === c.raceId }"
        tabindex="0"
        :aria-label="`${fmtMs(c.totalTimeMs)} op ${fmtDate(c.date)}, ${c.name}`"
        @mouseenter="onEnter(c)"
        @click.stop="onClick(c)"
        @focus="show(c)"
        @keydown.enter.prevent="navigateTo(`/results/races/${c.raceId}`)"
      />
    </svg>
    <div v-if="active" ref="tooltipEl" class="sparkline-tooltip" :style="tooltipStyle" role="status">
      <div class="font-mono text-meta">{{ distanceM }}m</div>
      <div class="sparkline-tooltip-time">{{ fmtMs(active.totalTimeMs) }}</div>
      <div class="sparkline-tooltip-name">{{ active.name }}</div>
      <div class="text-meta">{{ fmtDate(active.date) }}</div>
      <NuxtLink :to="`/results/races/${active.raceId}`" class="sparkline-tooltip-link">Open rit</NuxtLink>
    </div>
  </div>
  <p v-else class="sparkline-empty">
    Nog geen grafiek beschikbaar. Enige tijd:
    <strong class="font-mono">{{ fmtMs(latest.totalTimeMs) }}</strong> op {{ fmtDate(latest.date) }}.
  </p>
</template>

<style scoped>
.sparkline-wrap {
  position: relative;
}

.sparkline {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.sparkline-axis {
  stroke: var(--color-border);
  stroke-width: 1;
}

.sparkline-label {
  fill: var(--color-text-faint);
  font-size: 10px;
  text-anchor: middle;
}

.sparkline-line {
  fill: none;
  stroke: var(--color-accent);
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.sparkline-dot {
  fill: var(--color-surface);
  stroke: var(--color-accent);
  stroke-width: 1.75;
  cursor: pointer;
  outline: none;
}

.sparkline-dot:hover,
.sparkline-dot:focus-visible,
.sparkline-dot.is-active {
  fill: var(--color-accent);
}

.sparkline-tooltip {
  position: absolute;
  z-index: 5;
  min-width: 9rem;
  max-width: 14rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  font-size: 0.75rem;
}

.sparkline-tooltip-time {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 600;
}

.sparkline-tooltip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sparkline-tooltip-link {
  display: inline-block;
  margin-top: 0.25rem;
  color: var(--color-accent);
  text-decoration: underline;
}

.sparkline-empty {
  padding: var(--space-3) 0;
  color: var(--color-text-muted);
  font-size: 0.85rem;
}
</style>
