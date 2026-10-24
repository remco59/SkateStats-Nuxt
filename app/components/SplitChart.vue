<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { EChartsOption } from 'echarts'
import { fmtDeltaMs } from '#shared/utils/delta'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

// A small line chart over the splits of a race, for the compare page:
//  - kind "delta":   differences in ms (axis always includes 0, with a zero line)
//  - kind "seconds": lap times in seconds (axis fitted to the data)
// A null value is a gap (e.g. one race has fewer laps than the other).
const props = defineProps<{
  labels: string[]
  series: { name: string; values: (number | null)[]; tone: 'accent' | 'muted' }[]
  kind: 'delta' | 'seconds'
  /** Accessible description of the chart (the data is also in a table on the page). */
  label: string
  height?: number
}>()

const colors = useThemeColors()

const format = (value: number) => (props.kind === 'delta' ? fmtDeltaMs(value) : value.toFixed(2))

const option = computed<EChartsOption>(() => ({
  grid: { top: 16, right: 16, bottom: 30, left: props.kind === 'delta' ? 60 : 52 },
  xAxis: {
    type: 'category',
    data: props.labels,
    boundaryGap: props.labels.length <= 1,
    axisLine: { lineStyle: { color: colors.border } },
    axisTick: { show: false },
    axisLabel: { color: colors.textMuted },
  },
  yAxis: {
    type: 'value',
    scale: props.kind === 'seconds',
    axisLabel: { color: colors.textMuted, formatter: (v: number) => format(v) },
    splitLine: { lineStyle: { color: colors.border } },
  },
  tooltip: {
    trigger: 'axis',
    formatter: (params) => {
      const list = Array.isArray(params) ? params : [params]
      const label = (list[0] as { axisValueLabel?: string } | undefined)?.axisValueLabel ?? ''
      const lines = list
        .filter((p) => typeof p.value === 'number')
        .map((p) => `${p.marker} ${p.seriesName}: <b>${format(p.value as number)}</b>`)
      return [`Split ${label}`, ...lines].join('<br>')
    },
  },
  series: props.series.map((s, i) => {
    const color = s.tone === 'accent' ? colors.accent : colors.textMuted
    return {
      type: 'line' as const,
      name: s.name,
      data: s.values,
      connectNulls: false,
      symbol: 'circle',
      symbolSize: 7,
      lineStyle: { color, width: 2 },
      itemStyle: { color },
      markLine:
        props.kind === 'delta' && i === 0
          ? {
              symbol: 'none',
              silent: true,
              label: { show: false },
              lineStyle: { color: colors.textMuted, type: 'solid' as const, width: 1 },
              data: [{ yAxis: 0 }],
            }
          : undefined,
    }
  }),
}))
</script>

<template>
  <VChart
    class="w-full"
    :style="{ height: `${height ?? 200}px` }"
    :option="option"
    :autoresize="true"
    :aria-label="label"
  />
</template>
