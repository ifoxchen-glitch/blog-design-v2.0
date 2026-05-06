<template>
  <div ref="sparkRef" class="h-full w-full" />
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'

const props = defineProps<{
  data: number[]
  color?: string
}>()

const sparkRef = ref<HTMLElement>()
let chart: any = null

const draw = async () => {
  if (!sparkRef.value) return
  // Lazy-load echarts for sparklines
  const echarts = await import('echarts')
  if (!chart) {
    chart = echarts.init(sparkRef.value, null, { renderer: 'canvas' })
  }
  chart.setOption({
    grid: { top: 0, right: 0, bottom: 0, left: 0 },
    xAxis: { type: 'category', show: false, data: props.data.map((_, i) => i) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        data: props.data,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 1.5, color: props.color || '#64d2ff' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: `${props.color || '#64d2ff'}40` },
              { offset: 1, color: `${props.color || '#64d2ff'}00` },
            ],
          },
        },
      },
    ],
  })
}

watch(() => props.data, draw, { deep: true })
onMounted(draw)
onUnmounted(() => { chart?.dispose() })
</script>
