<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NSpace,
  NStatistic,
  NGrid,
  NGridItem,
  NSpin,
  NSelect,
} from 'naive-ui'
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
      { name: 'PV', data: trend.pv, color: '#2080f0' },
      { name: 'UV', data: trend.uv, color: '#18a058' },
    ]

    topPosts.value = posts.items.map((i) => ({ name: i.title, value: i.viewCount }))
    tagPieData.value = dist.tags.filter((t) => t.count > 0).map((t) => ({ name: t.name, value: t.count }))
    catPieData.value = dist.categories.filter((c) => c.count > 0).map((c) => ({ name: c.name, value: c.count }))

    referrers.value = refs.items.map((r) => ({ name: r.domain || '直接访问', value: r.count }))

    hourlyLabels.value = hourly.labels
    hourlySeries.value = [
      { name: 'PV', data: hourly.pv, color: '#2080f0' },
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
  <NSpin :show="loading">
    <NSpace vertical size="large">
      <NCard>
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px">
          <div>
            <h3 style="margin: 0; font-size: 18px">欢迎回来，{{ auth.user?.username ?? '访客' }}</h3>
            <p style="margin: 4px 0 0; color: #666">Dashboard 数据概览，所有统计实时来自数据库。</p>
          </div>
          <NSpace>
            <NSelect
              v-model:value="trendDays"
              :options="[
                { label: '近 7 天', value: 7 },
                { label: '近 14 天', value: 14 },
                { label: '近 30 天', value: 30 },
              ]"
              style="width: 120px"
            />
            <NButton @click="exportCsv">导出报表</NButton>
          </NSpace>
        </div>
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
            <LineChart
              title="访问趋势"
              :labels="trendLabels"
              :series="trendSeries"
              :height="320"
            />
          </NCard>
        </NGridItem>
        <NGridItem span="3 s:3 m:1">
          <NCard>
            <BarChart
              title="文章阅读量 Top 10"
              :items="topPosts"
              :height="320"
            />
          </NCard>
        </NGridItem>
      </NGrid>

      <NGrid :cols="2" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="2 s:2 m:1">
          <NCard>
            <PieChart
              title="标签文章分布"
              :data="tagPieData"
              :height="280"
            />
          </NCard>
        </NGridItem>
        <NGridItem span="2 s:2 m:1">
          <NCard>
            <PieChart
              title="分类文章分布"
              :data="catPieData"
              :height="280"
            />
          </NCard>
        </NGridItem>
      </NGrid>

      <!-- Referrer + Hourly -->
      <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="3 s:3 m:2">
          <NCard>
            <BarChart
              title="访问来源 Top 10"
              :items="referrers"
              :height="260"
              color="#18a058"
            />
          </NCard>
        </NGridItem>
        <NGridItem span="3 s:3 m:1">
          <NCard>
            <LineChart
              title="今日时段分布"
              :labels="hourlyLabels"
              :series="hourlySeries"
              :height="260"
            />
          </NCard>
        </NGridItem>
      </NGrid>
    </NSpace>
  </NSpin>
</template>
