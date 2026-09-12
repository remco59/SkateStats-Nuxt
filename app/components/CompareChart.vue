<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { EChartsOption } from 'echarts'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, MarkLineComponent])

const props = defineProps<{
  values: (number | null)[]
}>()

const height = 140

const option = computed<EChartsOption>(() => ({
  grid: { top: 10, right: 10, bottom: 10, left: 10 },
  xAxis: { type: 'category', show: false, data: props.values.map((_, i) => i) },
  yAxis: { type: 'value', show: false },
  tooltip: {
    trigger: 'axis',
    formatter: (params) => {
      const p = Array.isArray(params) ? params[0] : params
      const v = (p?.value ?? null) as number | null
      return v == null ? '' : v.toFixed(0)
    },
  },
  series: [
    {
      type: 'line',
      data: props.values,
      connectNulls: true,
      showSymbol: false,
      lineStyle: { color: 'var(--color-accent)', width: 2 },
      itemStyle: { color: 'var(--color-accent)' },
      markLine: {
        symbol: 'none',
        silent: true,
        label: { show: false },
        lineStyle: { color: 'var(--color-border)', type: 'dashed' },
        data: [{ yAxis: 0 }],
      },
    },
  ],
}))
</script>

<template>
  <VChart
    class="w-full"
    :style="{ height: `${height}px` }"
    :option="option"
    :autoresize="true"
    aria-label="Verschil per onderdeel ten opzichte van de vergelijkingsrit"
  />
</template>
