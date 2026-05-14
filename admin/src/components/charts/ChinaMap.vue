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
const mapLoaded = ref(false)
const loadError = ref('')

async function loadMap() {
  if (mapLoaded.value) return
  const urls = ['/china.json', '/admin-static/china.json']
  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        loadError.value = `HTTP ${res.status}: ${url}`
        continue
      }
      const chinaGeo = await res.json()
      if (!chinaGeo || !chinaGeo.features) {
        loadError.value = `Invalid GeoJSON: ${url}`
        continue
      }
      echarts.registerMap('china', chinaGeo)
      mapLoaded.value = true
      loadError.value = ''
      console.log(`[ChinaMap] loaded from ${url}`)
      return
    } catch (e) {
      loadError.value = `Failed: ${url} — ${(e as Error).message}`
    }
  }
  console.error('[ChinaMap] all URLs failed:', loadError.value)
}

function init() {
  if (!chartRef.value || !mapLoaded.value) return
  chart = echarts.init(chartRef.value)
  updateOption()
}

function updateOption() {
  if (!chart || !mapLoaded.value) return

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
  <div v-if="!mapLoaded" class="flex flex-col items-center justify-center" :style="{ height: `${height}px` }">
    <span class="text-sm text-slate-400">{{ loadError || '地图加载中...' }}</span>
  </div>
  <div ref="chartRef" v-show="mapLoaded" :style="{ width: '100%', height: `${height}px` }" />
</template>