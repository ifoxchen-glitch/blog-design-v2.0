<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="legend" />
    </div>

    <!-- Donut -->
    <div class="flex items-center gap-6">
      <div ref="donutRef" :style="{ width: size + 'px', height: size + 'px' }" />
      <div v-if="showLabels" class="flex flex-col gap-2">
        <div
          v-for="(seg, i) in withPercent"
          :key="i"
          class="flex items-center gap-2 text-xs"
        >
          <span class="inline-block h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: seg.color || palette[i % palette.length] }" />
          <span class="text-base-content/70">{{ seg.label }}</span>
          <span class="font-medium tabular-nums">{{ seg.value }}{{ unit }}</span>
          <span class="text-base-content/30">({{ seg.percent }}%)</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import * as echarts from 'echarts'

export interface Segment {
  label: string
  value: number
  color?: string
}

const props = withDefaults(defineProps<{
  title?: string
  segments: Segment[]
  size?: number
  showLabels?: boolean
  unit?: string
}>(), {
  size: 140,
  showLabels: true,
  unit: '',
})

const donutRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const palette = ['#64d2ff', '#30d158', '#bf5af2', '#ff9f0a', '#ff453a', '#ffd60a']

const total = computed(() => (props.segments || []).reduce((s, x) => s + x.value, 0))

const withPercent = computed(() =>
  (props.segments || []).map(s => ({
    ...s,
    percent: total.value ? ((s.value / total.value) * 100).toFixed(1) : '0.0',
  }))
)

const init = () => {
  if (!donutRef.value) return
  if (chart) chart.dispose()
  chart = echarts.init(donutRef.value, null, { renderer: 'canvas' })
  chart.setOption({
    tooltip: {
      trigger: 'item',
      backgroundColor: '#2a323c',
      borderColor: 'transparent',
      textStyle: { color: '#a6adbb', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    series: [{
      type: 'pie',
      radius: ['55%', '75%'],
      avoidLabelOverlap: false,
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 12, fontWeight: 'bold' },
      },
      data: (withPercent.value || []).map((s, i) => ({
        name: s.label,
        value: s.value,
        itemStyle: { color: s.color || palette[i % palette.length] },
      })),
    }],
  })
}

watch(() => [props.segments, props.size], init, { deep: true })

onMounted(init)
onUnmounted(() => chart?.dispose())
</script>
