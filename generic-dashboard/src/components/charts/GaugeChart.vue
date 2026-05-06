<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <div ref="gaugeRef" :style="{ height: size + 'px' }" class="flex justify-center" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = withDefaults(defineProps<{
  title?: string
  value: number
  min?: number
  max?: number
  unit?: string
  size?: number
  color?: string
}>(), {
  min: 0,
  max: 100,
  size: 160,
  color: '#64d2ff',
})

const gaugeRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const init = () => {
  if (!gaugeRef.value) return
  if (chart) chart.dispose()
  chart = echarts.init(gaugeRef.value, null, { renderer: 'canvas' })
  chart.setOption({
    series: [{
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: props.min,
      max: props.max,
      radius: '90%',
      center: ['50%', '55%'],
      progress: {
        show: true,
        width: 12,
        itemStyle: { color: props.color },
      },
      axisLine: {
        lineStyle: { width: 12, color: [[1, 'rgba(166,173,187,0.1)']] },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: false },
      detail: {
        valueAnimation: true,
        fontSize: 24,
        fontFamily: 'system-ui',
        fontWeight: 200,
        color: '#a6adbb',
        offsetCenter: [0, '10%'],
        formatter: `{value}${props.unit || ''}`,
      },
      data: [{ value: props.value }],
    }],
  })
}

watch(() => props.value, (v) => {
  if (chart) chart.setOption({ series: [{ data: [{ value: v }] }] })
})

onMounted(init)
onUnmounted(() => chart?.dispose())
</script>
