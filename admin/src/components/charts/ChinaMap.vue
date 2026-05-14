<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import * as echarts from 'echarts'

export interface MapItem {
  name: string   // 省份/城市名称
  value: number  // 卡片数量
}

const props = withDefaults(defineProps<{
  data: MapItem[]
  height?: number
}>(), {
  height: 360,
})

const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let mapLoaded = false

async function loadMap() {
  if (mapLoaded) return
  try {
    // 使用 DataV 提供的中国地图 GeoJSON
    const res = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    const chinaGeo = await res.json()
    echarts.registerMap('china', chinaGeo)
    mapLoaded = true
  } catch (e) {
    console.error('[ChinaMap] failed to load GeoJSON:', e)
  }
}

function init() {
  if (!chartRef.value || !mapLoaded) return
  chart = echarts.init(chartRef.value)
  updateOption()
}

function updateOption() {
  if (!chart || !mapLoaded) return

  const max = Math.max(...props.data.map(d => d.value), 1)

  chart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => `${p.name}: ${p.value} 张卡`,
    },
    visualMap: {
      type: 'continuous',
      min: 0,
      max,
      text: ['高', '低'],
      realtime: false,
      calculable: true,
      inRange: {
        color: ['#bfdbfe', '#3b82f6', '#1d4ed8'],
      },
      textStyle: { color: '#64748b', fontSize: 11 },
      right: 16,
      top: 'center',
    },
    series: [
      {
        type: 'map',
        map: 'china',
        roam: true,
        zoom: 1.2,
        scaleLimit: { min: 0.8, max: 4 },
        emphasis: {
          itemStyle: { areaColor: '#fbbf24' },
          label: { show: true, color: '#1e293b', fontWeight: 'bold' },
        },
        itemStyle: {
          areaColor: '#e2e8f0',
          borderColor: '#94a3b8',
          borderWidth: 0.5,
        },
        label: {
          show: false,
        },
        data: props.data.map(d => ({
          name: d.name.replace(/省|市|自治区|壮族|回族|维吾尔|特别行政区|自治区$/, ''),
          value: d.value,
        })),
      },
    ],
  }, true)
}

function handleResize() {
  chart?.resize()
}

onMounted(async () => {
  await loadMap()
  await nextTick()
  init()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})

watch(() => props.data, () => {
  nextTick(updateOption)
}, { deep: true })
</script>

<template>
  <div v-if="!mapLoaded" class="flex items-center justify-center" :style="{ height: `${height}px` }">
    <span class="text-sm text-slate-400">地图加载中...</span>
  </div>
  <div ref="chartRef" v-show="mapLoaded" :style="{ width: '100%', height: `${height}px` }" />
</template>