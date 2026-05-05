<script setup lang="ts">
import { onMounted, ref, watch, nextTick } from 'vue'
import {
  NCard,
  NSpace,
  NStatistic,
  NGrid,
  NGridItem,
  NSpin,
} from 'naive-ui'
import * as echarts from 'echarts'
import { useAuthStore } from '../../stores/auth'
import {
  apiGetDashboardStats,
  apiGetTrend,
  apiGetTopPosts,
  apiGetDistribution,
} from '../../api/analytics'

const auth = useAuthStore()

const loading = ref(false)
const stats = ref({ postCount: 0, tagCount: 0, categoryCount: 0, todayPv: 0, todayUv: 0 })

// Chart refs
const trendRef = ref<HTMLDivElement | null>(null)
const topPostsRef = ref<HTMLDivElement | null>(null)
const tagPieRef = ref<HTMLDivElement | null>(null)
const catPieRef = ref<HTMLDivElement | null>(null)

let trendChart: echarts.ECharts | null = null
let topPostsChart: echarts.ECharts | null = null
let tagPieChart: echarts.ECharts | null = null
let catPieChart: echarts.ECharts | null = null

async function loadAll() {
  loading.value = true
  try {
    const [s, trend, topPosts, dist] = await Promise.all([
      apiGetDashboardStats(),
      apiGetTrend(7),
      apiGetTopPosts(10),
      apiGetDistribution(),
    ])
    stats.value = s

    await nextTick()

    // Trend line chart
    if (trendRef.value) {
      trendChart = echarts.init(trendRef.value)
      trendChart.setOption({
        title: { text: '近 7 天访问趋势', left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis' },
        legend: { data: ['PV', 'UV'], bottom: 0 },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: { type: 'category', data: trend.labels },
        yAxis: { type: 'value' },
        series: [
          { name: 'PV', type: 'line', smooth: true, data: trend.pv, itemStyle: { color: '#2080f0' } },
          { name: 'UV', type: 'line', smooth: true, data: trend.uv, itemStyle: { color: '#18a058' } },
        ],
      })
    }

    // Top posts bar chart
    if (topPostsRef.value) {
      topPostsChart = echarts.init(topPostsRef.value)
      topPostsChart.setOption({
        title: { text: '文章阅读量 Top 10', left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: {
          type: 'category',
          data: topPosts.items.map((i) => i.title).reverse(),
          axisLabel: { width: 120, overflow: 'truncate' },
        },
        series: [
          {
            name: '阅读量',
            type: 'bar',
            data: topPosts.items.map((i) => i.viewCount).reverse(),
            itemStyle: { color: '#f0a020', borderRadius: [0, 4, 4, 0] },
          },
        ],
      })
    }

    // Tag pie chart
    if (tagPieRef.value) {
      tagPieChart = echarts.init(tagPieRef.value)
      tagPieChart.setOption({
        title: { text: '标签文章分布', left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
            data: dist.tags.filter((t) => t.count > 0).map((t) => ({ name: t.name, value: t.count })),
          },
        ],
      })
    }

    // Category pie chart
    if (catPieRef.value) {
      catPieChart = echarts.init(catPieRef.value)
      catPieChart.setOption({
        title: { text: '分类文章分布', left: 'center', textStyle: { fontSize: 14 } },
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
            data: dist.categories.filter((c) => c.count > 0).map((c) => ({ name: c.name, value: c.count })),
          },
        ],
      })
    }
  } catch (e) {
    console.error('Dashboard load failed:', e)
  } finally {
    loading.value = false
  }
}

function handleResize() {
  trendChart?.resize()
  topPostsChart?.resize()
  tagPieChart?.resize()
  catPieChart?.resize()
}

onMounted(() => {
  loadAll()
  window.addEventListener('resize', handleResize)
})

watch(() => auth.user, loadAll)
</script>

<template>
  <NSpin :show="loading">
    <NSpace vertical size="large">
      <NCard :title="`欢迎回来，${auth.user?.username ?? '访客'}`">
        <p>这是 Dashboard 数据概览。所有统计数据实时来自数据库。</p>
      </NCard>

      <NGrid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="1 s:2 m:1">
          <NCard>
            <NStatistic label="文章总数" :value="stats.postCount" />
          </NCard>
        </NGridItem>
        <NGridItem span="1 s:2 m:1">
          <NCard>
            <NStatistic label="标签总数" :value="stats.tagCount" />
          </NCard>
        </NGridItem>
        <NGridItem span="1 s:2 m:1">
          <NCard>
            <NStatistic label="分类总数" :value="stats.categoryCount" />
          </NCard>
        </NGridItem>
        <NGridItem span="1 s:2 m:1">
          <NCard>
            <NStatistic label="今日访问" :value="stats.todayPv" />
            <div style="font-size: 12px; color: #888; margin-top: 4px">UV: {{ stats.todayUv }}</div>
          </NCard>
        </NGridItem>
      </NGrid>

      <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="3 s:3 m:2">
          <NCard>
            <div ref="trendRef" style="width: 100%; height: 320px" />
          </NCard>
        </NGridItem>
        <NGridItem span="3 s:3 m:1">
          <NCard>
            <div ref="topPostsRef" style="width: 100%; height: 320px" />
          </NCard>
        </NGridItem>
      </NGrid>

      <NGrid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="2 s:2 m:1">
          <NCard>
            <div ref="tagPieRef" style="width: 100%; height: 280px" />
          </NCard>
        </NGridItem>
        <NGridItem span="2 s:2 m:1">
          <NCard>
            <div ref="catPieRef" style="width: 100%; height: 280px" />
          </NCard>
        </NGridItem>
      </NGrid>
    </NSpace>
  </NSpin>
</template>
