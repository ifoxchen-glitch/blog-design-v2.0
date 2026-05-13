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
  fill?: boolean
}>(), {
  height: 320,
  fill: false,
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
    tooltip: { trigger: 'axis', confine: true },
    legend: { data: props.series.map((s) => s.name), bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
    xAxis: { type: 'category', data: props.labels },
    yAxis: { type: 'value' },
    animation: true,
    animationDuration: 1200,
    animationEasing: 'cubicOut',
    series: props.series.map((s) => {
      const base: any = {
        name: s.name,
        type: 'line',
        smooth: true,
        data: s.data,
        itemStyle: { color: s.color },
        lineStyle: { width: 2.5 },
        symbol: 'none',
      }
      if (props.fill && s.color) {
        base.areaStyle = {
          opacity: 0.12,
          color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: s.color },
            { offset: 1, color: 'rgba(0,0,0,0)' },
          ]),
        }
      }
      return base
    }),
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
