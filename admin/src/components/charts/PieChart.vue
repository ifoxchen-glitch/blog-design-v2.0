<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

export interface PieItem {
  name: string
  value: number
}

const props = withDefaults(defineProps<{
  title?: string
  data: PieItem[]
  height?: number
  donut?: boolean
}>(), {
  height: 280,
  donut: true,
})

const palette = ['#60a5fa', '#2dd4bf', '#f472b6', '#30d158', '#ff9f0a', '#64d2ff', '#a78bfa', '#fb7185', '#34d399', '#fbbf24']

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
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: props.donut ? ['40%', '70%'] : '60%',
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#1d232a', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
        data: props.data
          .filter((d) => d.value > 0)
          .map((d, i) => ({ ...d, itemStyle: { color: palette[i % palette.length] } })),
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

watch(() => props.data, updateOption, { deep: true })
</script>

<template>
  <div ref="chartRef" :style="{ width: '100%', height: `${height}px` }" />
</template>
