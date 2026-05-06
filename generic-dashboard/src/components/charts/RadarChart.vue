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
}>(), {
  width: 300,
  height: 300,
  color: '#64d2ff',
})

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const option = computed(() => ({
  radar: {
    indicator: props.data.map(d => ({ name: d.name, max: Math.max(...props.data.map(x => x.value)) * 1.2 })),
    shape: 'polygon',
    axisName: { color: 'rgba(166,173,187,0.7)', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(166,173,187,0.15)' } },
    splitArea: { areaStyle: { color: ['transparent', 'transparent'] } },
  },
  series: [{
    type: 'radar',
    data: [{
      value: props.data.map(d => d.value),
      name: '数据',
      areaStyle: { color: props.color + '40' },
      lineStyle: { color: props.color },
      itemStyle: { color: props.color },
    }],
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