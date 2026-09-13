<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { EChartsOption } from 'echarts'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const props = defineProps<{
  points: { date: string; totalTimeMs: number; raceId: number }[]
}>()

const height = 60

const accentColor = ref('#f7931a')

onMounted(() => {
  const resolved = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim()
  if (resolved) accentColor.value = resolved
})

const option = computed<EChartsOption>(() => ({
  grid: { top: 6, right: 6, bottom: 6, left: 6 },
  xAxis: { type: 'category', show: false, data: props.points.map((p) => p.date) },
  yAxis: { type: 'value', show: false, inverse: true },
  tooltip: {
    trigger: 'axis',
    formatter: (params) => {
      const p = Array.isArray(params) ? params[0] : params
      return fmtMs((p?.value ?? 0) as number)
    },
  },
  series: [
    {
      type: 'line',
      data: props.points.map((p) => p.totalTimeMs),
      showSymbol: false,
      smooth: false,
      lineStyle: { color: accentColor.value, width: 2 },
      itemStyle: { color: accentColor.value },
    },
  ],
}))
</script>

<template>
  <VChart
    v-if="points.length >= 2"
    class="w-full"
    :style="{ height: `${height}px` }"
    :option="option"
    :autoresize="true"
    :aria-label="`Ontwikkeling over ${points.length} wedstrijden, van ${fmtMs(points[0]!.totalTimeMs)} naar ${fmtMs(points[points.length - 1]!.totalTimeMs)}`"
  />
  <p v-else class="text-xs" style="color: var(--color-text-muted)">Nog niet genoeg data.</p>
</template>
