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
  },
  yAxis: { type: 'value' },
  series: [{
    data: props.data.map(d => d.value),
    type: 'line',
    smooth: props.smooth,
    lineStyle: { color: props.color },
    itemStyle: { color: props.color },
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