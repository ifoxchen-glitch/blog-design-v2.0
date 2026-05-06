<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../../stores/auth'
import {
  apiGetDashboardStats,
  apiGetTrend,
  apiGetTopPosts,
  apiGetDistribution,
  apiGetReferrers,
  apiGetHourly,
} from '../../api/analytics'
import LineChart from '../../components/charts/LineChart.vue'
import BarChart from '../../components/charts/BarChart.vue'
import PieChart from '../../components/charts/PieChart.vue'

const auth = useAuthStore()

const loading = ref(false)
const stats = ref({ postCount: 0, tagCount: 0, categoryCount: 0, todayPv: 0, todayUv: 0 })

const trendDays = ref(7)
const trendLabels = ref<string[]>([])
const trendSeries = ref<Array<{ name: string; data: number[]; color?: string }>>([])

const topPosts = ref<Array<{ name: string; value: number }>>([])
const tagPieData = ref<Array<{ name: string; value: number }>>([])
const catPieData = ref<Array<{ name: string; value: number }>>([])

const referrers = ref<Array<{ name: string; value: number }>>([])

const hourlyLabels = ref<string[]>([])
const hourlySeries = ref<Array<{ name: string; data: number[]; color?: string }>>([])

async function loadAll() {
  loading.value = true
  try {
    const [s, trend, posts, dist, refs, hourly] = await Promise.all([
      apiGetDashboardStats(),
      apiGetTrend(trendDays.value),
      apiGetTopPosts(10),
      apiGetDistribution(),
      apiGetReferrers(10),
      apiGetHourly(),
    ])
    stats.value = s

    trendLabels.value = trend.labels
    trendSeries.value = [
      { name: 'PV', data: trend.pv, color: '#3b82f6' },
      { name: 'UV', data: trend.uv, color: '#10b981' },
    ]

    topPosts.value = posts.items.map((i) => ({ name: i.title, value: i.viewCount }))
    tagPieData.value = dist.tags.filter((t) => t.count > 0).map((t) => ({ name: t.name, value: t.count }))
    catPieData.value = dist.categories.filter((c) => c.count > 0).map((c) => ({ name: c.name, value: c.count }))

    referrers.value = refs.items.map((r) => ({ name: r.domain || '直接访问', value: r.count }))

    hourlyLabels.value = hourly.labels
    hourlySeries.value = [
      { name: 'PV', data: hourly.pv, color: '#3b82f6' },
    ]
  } catch (e) {
    console.error('Dashboard load failed:', e)
  } finally {
    loading.value = false
  }
}

function exportCsv() {
  const lines: string[] = ['日期,PV,UV']
  for (let i = 0; i < trendLabels.value.length; i++) {
    lines.push(`${trendLabels.value[i]},${trendSeries.value[0]?.data[i] ?? 0},${trendSeries.value[1]?.data[i] ?? 0}`)
  }
  lines.push('')
  lines.push('文章标题,阅读量')
  for (const item of topPosts.value) {
    lines.push(`"${item.name}",${item.value}`)
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

watch(trendDays, loadAll)
onMounted(loadAll)
watch(() => auth.user, loadAll)
</script>

<template>
  <div class="h-full overflow-y-auto p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <div>
        <h1 class="text-lg font-semibold text-base-content">欢迎回来，{{ auth.user?.username ?? '访客' }}</h1>
        <p class="text-sm text-base-content/50">Dashboard 数据概览，所有统计实时来自数据库。</p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="trendDays"
          class="select select-sm select-bordered bg-base-100"
        >
          <option :value="7">近 7 天</option>
          <option :value="14">近 14 天</option>
          <option :value="30">近 30 天</option>
        </select>
        <button class="btn btn-sm btn-primary" @click="exportCsv">
          导出报表
        </button>
      </div>
    </div>

    <!-- Stat Cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-xs text-base-content/50 uppercase tracking-wider">文章总数</div>
        <div class="mt-1 text-3xl font-extralight tabular-nums text-white">{{ stats.postCount }}</div>
      </div>
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-xs text-base-content/50 uppercase tracking-wider">标签总数</div>
        <div class="mt-1 text-3xl font-extralight tabular-nums text-white">{{ stats.tagCount }}</div>
      </div>
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-xs text-base-content/50 uppercase tracking-wider">分类总数</div>
        <div class="mt-1 text-3xl font-extralight tabular-nums text-white">{{ stats.categoryCount }}</div>
      </div>
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-xs text-base-content/50 uppercase tracking-wider">今日访问</div>
        <div class="mt-1 text-3xl font-extralight tabular-nums text-white">{{ stats.todayPv }}</div>
        <div class="text-xs text-base-content/40 mt-1">UV {{ stats.todayUv }}</div>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
      <div class="lg:col-span-2 bg-base-200/30 rounded-xl p-4">
        <div class="text-sm font-medium mb-3 text-base-content">访问趋势</div>
        <LineChart :labels="trendLabels" :series="trendSeries" :height="280" />
      </div>
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-sm font-medium mb-3 text-base-content">文章阅读量 Top 10</div>
        <BarChart :items="topPosts" :height="280" />
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-sm font-medium mb-3 text-base-content">标签文章分布</div>
        <PieChart :data="tagPieData" :height="240" />
      </div>
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-sm font-medium mb-3 text-base-content">分类文章分布</div>
        <PieChart :data="catPieData" :height="240" />
      </div>
    </div>

    <!-- Charts Row 3 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
      <div class="lg:col-span-2 bg-base-200/30 rounded-xl p-4">
        <div class="text-sm font-medium mb-3 text-base-content">访问来源 Top 10</div>
        <BarChart :items="referrers" :height="220" color="#10b981" />
      </div>
      <div class="bg-base-200/30 rounded-xl p-4">
        <div class="text-sm font-medium mb-3 text-base-content">今日时段分布</div>
        <LineChart :labels="hourlyLabels" :series="hourlySeries" :height="220" />
      </div>
    </div>
  </div>
</template>
