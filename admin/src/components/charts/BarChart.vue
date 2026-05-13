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
  barWidth: 24,
})

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function init() {
  if (!chartRef.value) return
  chart = echarts.init(chartRef.value)
  updateOption()
}

function getBarColor(color: string): any {
  return new (echarts as any).graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: color },
    { offset: 1, color: adjustColor(color, 40) },
  ])
}

function adjustColor(hex: string, amount: number): string {
  // Lighten the color by blending with white
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const factor = amount / 255
  const nr = Math.round(r + (255 - r) * factor)
  const ng = Math.round(g + (255 - g) * factor)
  const nb = Math.round(b + (255 - b) * factor)
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`
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
        data: reversed.map((item, i) => ({
          value: item.value,
          itemStyle: {
            color: getBarColor(props.color),
            borderRadius: [0, 6, 6, 0],
          },
        })),
        barWidth: props.barWidth,
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
