<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NSpace,
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
  <NSpin :show="loading">
    <div class="dashboard">
      <!-- 顶部标题栏 -->
      <div class="dash-header">
        <div class="dash-title">
          <h1>欢迎回来，{{ auth.user?.username ?? '访客' }}</h1>
          <p>Dashboard 数据概览，所有统计实时来自数据库。</p>
        </div>
        <NSpace class="dash-actions">
          <NSelect
            v-model:value="trendDays"
            :options="[
              { label: '近 7 天', value: 7 },
              { label: '近 14 天', value: 14 },
              { label: '近 30 天', value: 30 },
            ]"
            size="small"
            style="width: 110px"
          />
          <NButton size="small" strong secondary @click="exportCsv">导出报表</NButton>
        </NSpace>
      </div>

      <!-- 统计卡片 -->
      <NGrid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
        <NGridItem span="2 m:1">
          <NCard class="stat-card" :bordered="false">
            <div class="stat-label">文章总数</div>
            <div class="stat-value" style="color: #3b82f6;">{{ stats.postCount }}</div>
          </NCard>
        </NGridItem>
        <NGridItem span="2 m:1">
          <NCard class="stat-card" :bordered="false">
            <div class="stat-label">标签总数</div>
            <div class="stat-value" style="color: #8b5cf6;">{{ stats.tagCount }}</div>
          </NCard>
        </NGridItem>
        <NGridItem span="2 m:1">
          <NCard class="stat-card" :bordered="false">
            <div class="stat-label">分类总数</div>
            <div class="stat-value" style="color: #f59e0b;">{{ stats.categoryCount }}</div>
          </NCard>
        </NGridItem>
        <NGridItem span="2 m:1">
          <NCard class="stat-card" :bordered="false">
            <div class="stat-label">今日访问</div>
            <div class="stat-value" style="color: #10b981;">{{ stats.todayPv }}</div>
            <div class="stat-sub">UV {{ stats.todayUv }}</div>
          </NCard>
        </NGridItem>
      </NGrid>

      <!-- 图表区域 -->
      <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen" style="margin-top: 16px;">
        <NGridItem span="3 m:2">
          <NCard class="chart-card" :bordered="false" title="访问趋势">
            <LineChart
              :labels="trendLabels"
              :series="trendSeries"
              :height="300"
            />
          </NCard>
        </NGridItem>
        <NGridItem span="3 m:1">
          <NCard class="chart-card" :bordered="false" title="文章阅读量 Top 10">
            <BarChart
              :items="topPosts"
              :height="300"
            />
          </NCard>
        </NGridItem>
      </NGrid>

      <NGrid :cols="2" :x-gap="16" :y-gap="16" responsive="screen" style="margin-top: 16px;">
        <NGridItem span="2 m:1">
          <NCard class="chart-card" :bordered="false" title="标签文章分布">
            <PieChart
              :data="tagPieData"
              :height="260"
            />
          </NCard>
        </NGridItem>
        <NGridItem span="2 m:1">
          <NCard class="chart-card" :bordered="false" title="分类文章分布">
            <PieChart
              :data="catPieData"
              :height="260"
            />
          </NCard>
        </NGridItem>
      </NGrid>

      <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen" style="margin-top: 16px;">
        <NGridItem span="3 m:2">
          <NCard class="chart-card" :bordered="false" title="访问来源 Top 10">
            <BarChart
              :items="referrers"
              :height="240"
              color="#10b981"
            />
          </NCard>
        </NGridItem>
        <NGridItem span="3 m:1">
          <NCard class="chart-card" :bordered="false" title="今日时段分布">
            <LineChart
              :labels="hourlyLabels"
              :series="hourlySeries"
              :height="240"
            />
          </NCard>
        </NGridItem>
      </NGrid>
    </div>
  </NSpin>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dash-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 8px;
}

.dash-title h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.3px;
}

.dash-title p {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 13px;
}

.dash-actions {
  align-items: center;
}

.stat-card {
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  background: #fff;
  transition: transform 0.15s, box-shadow 0.15s;
}

.stat-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-card :deep(.n-card__content) {
  padding: 20px;
}

.stat-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: 32px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -1px;
}

.stat-sub {
  font-size: 12px;
  color: #94a3b8;
  margin-top: 6px;
  font-weight: 500;
}

.chart-card {
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  background: #fff;
}

.chart-card :deep(.n-card-header) {
  padding: 16px 20px 0;
}

.chart-card :deep(.n-card-header__main) {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.chart-card :deep(.n-card__content) {
  padding: 12px 20px 20px;
}
</style>
