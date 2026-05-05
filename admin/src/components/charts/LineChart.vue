<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

export interface LineSeries {
  name: string
  data: number[]
  color?: string
}

const props = withDefaults(defineProps<{
  title?: string
  labels: string[]
  series: LineSeries[]
  height?: number
}>(), {
  height: 320,
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
  chart.setOption({
    title: props.title
      ? { text: props.title, left: 'center', textStyle: { fontSize: 14 } }
      : undefined,
    tooltip: { trigger: 'axis' },
    legend: { data: props.series.map((s) => s.name), bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: props.labels },
    yAxis: { type: 'value' },
    series: props.series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      data: s.data,
      itemStyle: { color: s.color },
    })),
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

watch(() => [props.labels, props.series], updateOption, { deep: true })
</script>

<template>
  <div ref="chartRef" :style="{ width: '100%', height: `${height}px` }" />
</template>
