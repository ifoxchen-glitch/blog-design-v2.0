<script setup lang="ts">
import { onMounted, ref, watch, h, type Component } from 'vue'
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
const stats = ref({
  postCount: 0,
  tagCount: 0,
  categoryCount: 0,
  todayPv: 0,
  todayUv: 0,
  userCount: 0,
  roleCount: 0,
  permissionCount: 0,
  linkCount: 0,
  totalPv: 0,
  avgViewsPerPost: 0,
  newPostsThisWeek: 0,
  kbDocCount: 0,
  kbCanvasCount: 0,
  frontUserCount: 0,
})

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

// ---- Icon components (inline SVGs, Heroicons style) ----
const iconSize = 'h-6 w-6'
const IconDocumentText = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' })
])
const IconTag = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z' }),
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M6 6h.008v.008H6V6Z' })
])
const IconFolder = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z' })
])
const IconEye = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z' }),
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' })
])
const IconUsers = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' })
])
const IconShield = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z' })
])
const IconKey = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z' })
])
const IconLink = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244' })
])
const IconChartBar = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' })
])
const IconBolt = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z' })
])
const IconSparkles = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z' })
])
const IconBookOpen = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25' })
])
const IconSquares = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3.75 3.75h4.5v4.5h-4.5v-4.5Zm6 0h4.5v4.5h-4.5v-4.5Zm6 0h4.5v4.5h-4.5v-4.5Zm-12 6h4.5v4.5h-4.5v-4.5Zm6 0h4.5v4.5h-4.5v-4.5Zm6 0h4.5v4.5h-4.5v-4.5Zm-12 6h4.5v4.5h-4.5v-4.5Zm6 0h4.5v4.5h-4.5v-4.5Zm6 0h4.5v4.5h-4.5v-4.5Z' })
])
const IconUserGroup = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z' })
])

interface StatItem {
  label: string
  value: number | string
  sub?: string
  icon: () => Component
  iconBg: string
  iconColor: string
}

const contentStats = ref<StatItem[]>([])
const trafficStats = ref<StatItem[]>([])
const systemStats = ref<StatItem[]>([])
const kbStats = ref<StatItem[]>([])

watch(() => stats.value, (s) => {
  contentStats.value = [
    { label: '文章总数', value: s.postCount, icon: IconDocumentText, iconBg: 'bg-blue-500/10', iconColor: 'text-blue-500' },
    { label: '标签总数', value: s.tagCount, icon: IconTag, iconBg: 'bg-amber-500/10', iconColor: 'text-amber-500' },
    { label: '分类总数', value: s.categoryCount, icon: IconFolder, iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
    { label: '外链总数', value: s.linkCount, icon: IconLink, iconBg: 'bg-rose-500/10', iconColor: 'text-rose-500' },
    { label: '本周新增', value: s.newPostsThisWeek, icon: IconSparkles, iconBg: 'bg-violet-500/10', iconColor: 'text-violet-500' },
    { label: '均阅/篇', value: s.avgViewsPerPost, icon: IconChartBar, iconBg: 'bg-cyan-500/10', iconColor: 'text-cyan-500' },
  ]
  trafficStats.value = [
    { label: '今日 PV', value: s.todayPv, sub: `UV ${s.todayUv}`, icon: IconEye, iconBg: 'bg-sky-500/10', iconColor: 'text-sky-500' },
    { label: '总 PV', value: s.totalPv, icon: IconBolt, iconBg: 'bg-orange-500/10', iconColor: 'text-orange-500' },
    { label: '前端用户', value: s.frontUserCount, icon: IconUserGroup, iconBg: 'bg-pink-500/10', iconColor: 'text-pink-500' },
  ]
  systemStats.value = [
    { label: '管理员', value: s.userCount, icon: IconUsers, iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-500' },
    { label: '角色', value: s.roleCount, icon: IconShield, iconBg: 'bg-teal-500/10', iconColor: 'text-teal-500' },
    { label: '权限', value: s.permissionCount, icon: IconKey, iconBg: 'bg-lime-500/10', iconColor: 'text-lime-500' },
  ]
  kbStats.value = [
    { label: 'KB 文档', value: s.kbDocCount, icon: IconBookOpen, iconBg: 'bg-fuchsia-500/10', iconColor: 'text-fuchsia-500' },
    { label: 'KB 画布', value: s.kbCanvasCount, icon: IconSquares, iconBg: 'bg-yellow-500/10', iconColor: 'text-yellow-500' },
  ]
}, { immediate: true, deep: true })
</script>

<template>
  <div class="h-full overflow-y-auto">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-lg font-semibold text-base-content">
          欢迎回来，{{ auth.user?.username ?? '访客' }}
        </h1>
        <p class="text-sm text-base-content/50">Dashboard 数据概览，所有统计实时来自数据库。</p>
      </div>
      <div class="flex items-center gap-2">
        <select v-model="trendDays" class="select select-sm select-bordered bg-base-100">
          <option :value="7">近 7 天</option>
          <option :value="14">近 14 天</option>
          <option :value="30">近 30 天</option>
        </select>
        <button class="btn btn-sm btn-primary" @click="exportCsv">导出报表</button>
      </div>
    </div>

    <!-- Section: Content Stats -->
    <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40">内容数据</div>
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      <div v-for="item in contentStats" :key="item.label"
        class="bg-base-200/40 hover:bg-base-200/60 transition-colors rounded-xl p-4 flex items-start gap-3">
        <div class="rounded-lg p-2 shrink-0" :class="[item.iconBg, item.iconColor]">
          <component :is="item.icon" />
        </div>
        <div class="min-w-0">
          <div class="text-xs text-base-content/50 truncate">{{ item.label }}</div>
          <div class="mt-0.5 text-2xl font-extralight tabular-nums text-white">{{ item.value }}</div>
          <div v-if="item.sub" class="text-[10px] text-base-content/40 mt-0.5">{{ item.sub }}</div>
        </div>
      </div>
    </div>

    <!-- Section: Traffic Stats -->
    <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40">流量数据</div>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
      <div v-for="item in trafficStats" :key="item.label"
        class="bg-base-200/40 hover:bg-base-200/60 transition-colors rounded-xl p-4 flex items-start gap-3">
        <div class="rounded-lg p-2 shrink-0" :class="[item.iconBg, item.iconColor]">
          <component :is="item.icon" />
        </div>
        <div class="min-w-0">
          <div class="text-xs text-base-content/50 truncate">{{ item.label }}</div>
          <div class="mt-0.5 text-2xl font-extralight tabular-nums text-white">{{ item.value }}</div>
          <div v-if="item.sub" class="text-[10px] text-base-content/40 mt-0.5">{{ item.sub }}</div>
        </div>
      </div>
    </div>

    <!-- Section: System + KB Stats -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
      <div>
        <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40">系统数据</div>
        <div class="grid grid-cols-3 gap-3">
          <div v-for="item in systemStats" :key="item.label"
            class="bg-base-200/40 hover:bg-base-200/60 transition-colors rounded-xl p-4 flex items-start gap-3">
            <div class="rounded-lg p-2 shrink-0" :class="[item.iconBg, item.iconColor]">
              <component :is="item.icon" />
            </div>
            <div class="min-w-0">
              <div class="text-xs text-base-content/50 truncate">{{ item.label }}</div>
              <div class="mt-0.5 text-2xl font-extralight tabular-nums text-white">{{ item.value }}</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="mb-2 text-xs font-semibold uppercase tracking-wider text-base-content/40">知识库</div>
        <div class="grid grid-cols-2 gap-3">
          <div v-for="item in kbStats" :key="item.label"
            class="bg-base-200/40 hover:bg-base-200/60 transition-colors rounded-xl p-4 flex items-start gap-3">
            <div class="rounded-lg p-2 shrink-0" :class="[item.iconBg, item.iconColor]">
              <component :is="item.icon" />
            </div>
            <div class="min-w-0">
              <div class="text-xs text-base-content/50 truncate">{{ item.label }}</div>
              <div class="mt-0.5 text-2xl font-extralight tabular-nums text-white">{{ item.value }}</div>
            </div>
          </div>
        </div>
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
