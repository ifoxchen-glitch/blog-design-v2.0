<template>
  <div ref="chartRef" :style="{ width: width + 'px', height: height + 'px' }" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import * as echarts from 'echarts'

const props = withDefaults(defineProps<{
  width?: number
  height?: number
  data: { name: string; value: number }[]
  color?: string
  smooth?: boolean
}>(), {
  width: 300,
  height: 200,
  color: '#64d2ff',
  smooth: true,
})

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const option = computed(() => ({
  grid: { top: 10, right: 10, bottom: 20, left: 30 },
  tooltip: { trigger: 'axis' },
  xAxis: {
    type: 'category',
    data: props.data.map(d => d.name),
    axisLine: { lineStyle: { color: 'rgba(166,173,187,0.15)' } },
    axisLabel: { color: 'rgba(166,173,187,0.5)', fontSize: 10 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(166,173,187,0.08)' } },
    axisLabel: { color: 'rgba(166,173,187,0.5)', fontSize: 10 },
  },
  series: [{
    data: props.data.map(d => d.value),
    type: 'line',
    smooth: props.smooth,
    symbol: 'circle',
    symbolSize: 4,
    lineStyle: { color: props.color, width: 2 },
    itemStyle: { color: props.color },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: props.color + '40' },
        { offset: 1, color: props.color + '05' },
      ]),
    },
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