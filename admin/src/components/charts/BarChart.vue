<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

export interface BarItem {
  name: string
  value: number
}

const props = withDefaults(defineProps<{
  title?: string
  items: BarItem[]
  color?: string
  height?: number
  barWidth?: number
}>(), {
  height: 320,
  color: '#f0a020',
  barWidth: 20,
})

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function init() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  updateOption()
}

function updateOption() {
  if (!chart) return
  const reversed = [...props.items].reverse()
  chart.setOption({
    title: props.title
      ? { text: props.title, left: 'center', textStyle: { fontSize: 14 } }
      : undefined,
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: reversed.map((i) => i.name),
      axisLabel: { width: 120, overflow: 'truncate' },
    },
    series: [
      {
        name: '数量',
        type: 'bar',
        data: reversed.map((i) => i.value),
        barWidth: props.barWidth,
        itemStyle: { color: props.color, borderRadius: [0, 4, 4, 0] },
      },
    ],
  }, true)
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  nextTick(init)
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})

watch(() => props.items, updateOption, { deep: true })
</script>

<template>
  <div ref="chartRef" :style="{ width: '100%', height: `${height}px` }" />
</template>
