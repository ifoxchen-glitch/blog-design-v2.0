<template>
  <div ref="chartRef" :style="{ width: width + 'px', height: height + 'px' }" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as echarts from 'echarts'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  xAxis: string[]
  yAxis: string[]
  data: [number, number, number][]
}>(), {
  width: 300,
  height: 200,
})

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const option = computed(() => ({
  grid: { top: 30, right: 30, bottom: 30, left: 50 },
  tooltip: { position: 'top' },
  xAxis: {
    type: 'category',
    data: props.xAxis,
    axisLine: { lineStyle: { color: 'rgba(166,173,187,0.15)' } },
    axisLabel: { color: 'rgba(166,173,187,0.5)', fontSize: 10 },
    splitArea: { show: true, areaStyle: { color: ['transparent', 'transparent'] } },
  },
  yAxis: {
    type: 'category',
    data: props.yAxis,
    axisLine: { lineStyle: { color: 'rgba(166,173,187,0.15)' } },
    axisLabel: { color: 'rgba(166,173,187,0.5)', fontSize: 10 },
    splitArea: { show: true, areaStyle: { color: ['transparent', 'transparent'] } },
  },
  visualMap: {
    min: 0,
    max: Math.max(...props.data.map(d => d[2])) || 100,
    calculable: true,
    orient: 'horizontal',
    left: 'center',
    bottom: 0,
    inRange: { color: ['#1a1a2e', '#16213e', '#0f3460', '#e94560'] },
    textStyle: { color: 'rgba(166,173,187,0.5)', fontSize: 10 },
  },
  series: [{
    type: 'heatmap',
    data: props.data,
    label: { show: false },
    itemStyle: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  }],
}))

onMounted(() => {
  if (chartRef.value) {
    chart = echarts.init(chartRef.value)
    chart.setOption(option.value)
  }
})

watch(option, (opt) => chart?.setOption(opt))
onUnmounted(() => chart?.dispose())
</script>