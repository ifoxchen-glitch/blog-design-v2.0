<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="extra" />
    </div>
    <div ref="chartRef" :style="{ height: height + 'px' }" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

export interface SankeyNode {
  name: string
  itemStyle?: { color?: string }
}

export interface SankeyLink {
  source: string
  target: string
  value: number
}

const props = withDefaults(defineProps<{
  title?: string
  nodes: SankeyNode[]
  links: SankeyLink[]
  height?: number
}>(), {
  height: 400,
})

const chartRef = ref<HTMLElement>()
let chart: echarts.ECharts | null = null

const init = () => {
  if (!chartRef.value) return
  if (chart) chart.dispose()
  chart = echarts.init(chartRef.value, null, { renderer: 'canvas' })
  chart.setOption({
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
      backgroundColor: '#2a323c',
      borderColor: 'transparent',
      textStyle: { color: '#a6adbb', fontSize: 12 },
    },
    series: [{
      type: 'sankey',
      layout: 'none',
      emphasis: { focus: 'adjacency' },
      nodeAlign: 'left',
      data: props.nodes,
      links: props.links,
      lineStyle: { color: 'source', curveness: 0.5, opacity: 0.3 },
      label: {
        color: '#a6adbb',
        fontSize: 12,
        formatter: '{b}',
      },
      itemStyle: { borderWidth: 0 },
      left: '2%',
      right: '2%',
      top: '4%',
      bottom: '4%',
    }],
  })
}

watch(() => [props.nodes, props.links], init, { deep: true })
onMounted(init)
onUnmounted(() => chart?.dispose())
</script>
