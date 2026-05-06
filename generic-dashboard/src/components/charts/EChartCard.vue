<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <div ref="chartRef" :style="{ height: height + 'px' }" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = withDefaults(defineProps<{
  title?: string
  height?: number
  option: echarts.EChartsOption
}>(), {
  height: 280,
})

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const init = () => {
  if (!chartRef.value) return
  if (chart) chart.dispose()
  chart = echarts.init(chartRef.value, null, { renderer: 'canvas' })
  chart.setOption(props.option as any)
}

watch(() => props.option, () => {
  if (chart) {
    chart.setOption(props.option as any, true)
  }
}, { deep: true })

onMounted(() => {
  init()
  window.addEventListener('resize', () => chart?.resize())
})

onUnmounted(() => {
  chart?.dispose()
  window.removeEventListener('resize', () => chart?.resize())
})

defineExpose({ refresh: init })
</script>
