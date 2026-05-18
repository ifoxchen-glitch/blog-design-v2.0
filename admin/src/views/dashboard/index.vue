<script setup lang="ts">
import { computed, onMounted, ref, watch, h, type Component, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import * as echarts from 'echarts'
import {
  apiGetDashboardStats,
  apiGetTrend,
  apiGetTopPosts,
  apiGetDistribution,
  apiGetReferrers,
  apiGetHourly,
  apiGetRecentPosts,
} from '../../api/analytics'
import LineChart from '../../components/charts/LineChart.vue'
import BarChart from '../../components/charts/BarChart.vue'
import PieChart from '../../components/charts/PieChart.vue'

const auth = useAuthStore()
const router = useRouter()

const loading = ref(false)
const scrollContainer = ref<HTMLElement | null>(null)
const pauseScroll = ref(false)
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
const recentPosts = ref<Array<{ id: number; title: string; createdAt: string }>>([])
const tagPieData = ref<Array<{ name: string; value: number }>>([])
const catPieData = ref<Array<{ name: string; value: number }>>([])

const referrers = ref<Array<{ name: string; value: number }>>([])

const hourlyLabels = ref<string[]>([])
const hourlySeries = ref<Array<{ name: string; data: number[]; color?: string }>>([])
const hourlyChartRef = ref<HTMLDivElement | null>(null)
let hourlyChart: echarts.ECharts | null = null

// Time-region colors for hourly bars
const TIME_COLORS: Record<string, string> = {
  late_night: '#6366f1', // 0-6 凌晨
  morning: '#60a5fa',    // 6-12 上午
  afternoon: '#f59e0b',  // 12-18 下午
  evening: '#ef4444',    // 18-24 晚上
}
function getTimeRegion(h: number): string {
  if (h < 6) return 'late_night'
  if (h < 12) return 'morning'
  if (h < 18) return 'afternoon'
  return 'evening'
}

function renderHourlyChart(labels: string[], pv: number[], uv: number[]) {
  if (!hourlyChartRef.value) return

  if (!hourlyChart) {
    hourlyChart = echarts.init(hourlyChartRef.value)
  }

  hourlyChart.setOption({
    tooltip: {
      trigger: 'axis',
      confine: true,
      formatter: (params: any[]) => {
        if (!params || params.length === 0) return ''
        const hour = params[0].name
        const pvVal = params.find((p: any) => p.seriesName === 'PV')?.value ?? 0
        const uvVal = params.find((p: any) => p.seriesName === 'UV')?.value ?? 0
        const region = getTimeRegion(parseInt(hour))
        const regionLabels: Record<string, string> = {
          late_night: '凌晨',
          morning: '上午',
          afternoon: '下午',
          evening: '晚上',
        }
        return `<div style="font-size:13px;line-height:1.8">
          <b>${hour}</b> (${regionLabels[region] || ''})<br/>
          PV: <b>${pvVal}</b> 次<br/>
          UV: <b>${uvVal}</b> 人
        </div>`
      },
    },
    legend: { data: ['PV', 'UV'], bottom: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 },
    grid: { left: '4%', right: '3%', bottom: '14%', top: '6%', containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLabel: { fontSize: 10, interval: 2 },
    },
    yAxis: { type: 'value', min: 0 },
    animation: true,
    animationDuration: 1200,
    animationEasing: 'cubicOut',
    series: [
      {
        name: 'PV',
        type: 'bar',
        data: labels.map((_, i) => ({
          value: pv[i] || 0,
          itemStyle: {
            color: TIME_COLORS[getTimeRegion(i)],
            borderRadius: [4, 4, 0, 0],
          },
        })),
        barWidth: '60%',
      },
      {
        name: 'UV',
        type: 'line',
        data: uv,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: '#30d158' },
        itemStyle: { color: '#30d158' },
      },
    ],
  }, true)
}

async function loadAll() {
  loading.value = true
  try {
    const [s, trend, posts, dist, refs, hourly, recent] = await Promise.all([
      apiGetDashboardStats(),
      apiGetTrend(trendDays.value),
      apiGetTopPosts(10),
      apiGetDistribution(),
      apiGetReferrers(10),
      apiGetHourly(),
      apiGetRecentPosts(20),
    ])
    stats.value = s

    trendLabels.value = trend.labels
    trendSeries.value = [
      { name: 'PV', data: trend.pv, color: '#60a5fa' },
      { name: 'UV', data: trend.uv, color: '#2dd4bf' },
    ]

    topPosts.value = posts.items.map((i) => ({ name: i.title, value: i.viewCount }))
    recentPosts.value = recent.items
    tagPieData.value = dist.tags.filter((t) => t.count > 0).map((t) => ({ name: t.name, value: t.count }))
    catPieData.value = dist.categories.filter((c) => c.count > 0).map((c) => ({ name: c.name, value: c.count }))

    referrers.value = refs.items.map((r) => ({ name: r.domain || '直接访问', value: r.count }))

    hourlyLabels.value = hourly.labels
    hourlySeries.value = [
      { name: 'PV', data: hourly.pv, color: '#64d2ff' },
      { name: 'UV', data: hourly.uv, color: '#30d158' },
    ]
    // 延迟确保 DOM 已渲染
    setTimeout(() => renderHourlyChart(hourly.labels, hourly.pv, hourly.uv), 100)
  } catch (e) {
    console.error('Dashboard load failed:', e)
  } finally {
    loading.value = false
    lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
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

let scrollTimer: ReturnType<typeof setInterval> | null = null

watch(pauseScroll, (paused) => {
  if (paused) {
    scrollTimer && clearInterval(scrollTimer)
  } else {
    startAutoScroll()
  }
})

function startAutoScroll() {
  scrollTimer && clearInterval(scrollTimer)
  scrollTimer = setInterval(() => {
    if (!scrollContainer.value || pauseScroll.value) return
    const el = scrollContainer.value
    el.scrollTop += 1
    if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
      el.scrollTop = 0
    }
  }, 50)
}

const lastUpdated = ref('')

function handleHourlyResize() {
  hourlyChart?.resize()
}

onMounted(() => {
  loadAll()
  startAutoScroll()
  lastUpdated.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  window.addEventListener('resize', handleHourlyResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleHourlyResize)
  hourlyChart?.dispose()
  hourlyChart = null
})

watch(trendDays, loadAll)
watch(() => auth.user, loadAll)

// auto scroll

// ---- Number animation ----
const animatedNumbers = ref<Record<string, number>>({})
function animateValue(key: string, target: number, duration = 600) {
  const start = animatedNumbers.value[key] ?? 0
  const startTime = performance.now()
  function step(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 3)
    animatedNumbers.value[key] = Math.round(start + (target - start) * eased)
    if (progress < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

watch(() => stats.value, (s) => {
  animateValue('todayPv', s.todayPv)
  animateValue('todayUv', s.todayUv)
  animateValue('totalPv', s.totalPv)
  animateValue('avgViewsPerPost', s.avgViewsPerPost)
  animateValue('postCount', s.postCount)
  animateValue('tagCount', s.tagCount)
  animateValue('categoryCount', s.categoryCount)
  animateValue('linkCount', s.linkCount)
  animateValue('newPostsThisWeek', s.newPostsThisWeek)
  animateValue('frontUserCount', s.frontUserCount)
}, { deep: true })

// ---- Sparkline SVG helper ----
function sparklinePath(data: number[], width = 120, height = 36): string {
  if (!data.length) return ''
  const max = Math.max(...data, 1)
  const min = Math.min(...data)
  const range = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((v, i) => {
    const x = i * stepX
    const y = height - ((v - min) / range) * height
    return `${x},${y}`
  })
  return `M ${points.join(' L ')}`
}

function sparklineAreaPath(data: number[], width = 120, height = 36): string {
  if (!data.length) return ''
  const line = sparklinePath(data, width, height)
  const lastX = (data.length - 1) * (width / (data.length - 1))
  return `${line} L ${lastX},${height} L 0,${height} Z`
}

// ---- Icons (inline SVG, Heroicons style) ----
const iconSize = 'h-5 w-5'
const IconEye = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z' }),
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' }),
])
const IconUsers = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z' }),
])
const IconBolt = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'm3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z' }),
])
const IconChartBar = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' }),
])
const IconDocumentText = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z' }),
])
const IconTag = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z' }),
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M6 6h.008v.008H6V6Z' }),
])
const IconFolder = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z' }),
])
const IconLink = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244' }),
])
const IconSparkles = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z' }),
])
const IconUserGroup = () => h('svg', { class: iconSize, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z' }),
])
const IconDownload = () => h('svg', { class: 'h-4 w-4', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' }, [
  h('path', { 'stroke-linecap': 'round', 'stroke-linejoin': 'round', d: 'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3' }),
])

interface HeroItem {
  label: string
  key: string
  icon: () => Component
  color: string
  bg: string
  sparklineKey?: 'pv' | 'uv'
}

const heroItems: HeroItem[] = [
  { label: '今日 PV', key: 'todayPv', icon: IconEye, color: 'text-sky-400', bg: 'bg-sky-400/10', sparklineKey: 'pv' },
  { label: '今日 UV', key: 'todayUv', icon: IconUsers, color: 'text-teal-400', bg: 'bg-teal-400/10', sparklineKey: 'uv' },
  { label: '总 PV', key: 'totalPv', icon: IconBolt, color: 'text-pink-400', bg: 'bg-pink-400/10' },
  { label: '均阅/篇', key: 'avgViewsPerPost', icon: IconChartBar, color: 'text-amber-400', bg: 'bg-amber-400/10' },
]

interface SecondaryItem {
  label: string
  key: string
  icon: () => Component
  color: string
  bg: string
}

const secondaryItems: SecondaryItem[] = [
  { label: '文章', key: 'postCount', icon: IconDocumentText, color: 'text-primary', bg: 'bg-primary/10' },
  { label: '标签', key: 'tagCount', icon: IconTag, color: 'text-accent', bg: 'bg-accent/10' },
  { label: '分类', key: 'categoryCount', icon: IconFolder, color: 'text-primary', bg: 'bg-primary/10' },
  { label: '外链', key: 'linkCount', icon: IconLink, color: 'text-accent', bg: 'bg-accent/10' },
  { label: '本周新增', key: 'newPostsThisWeek', icon: IconSparkles, color: 'text-primary', bg: 'bg-primary/10' },
  { label: '前端用户', key: 'frontUserCount', icon: IconUserGroup, color: 'text-accent', bg: 'bg-accent/10' },
]

// ---- Change percent vs previous day ----
function changePercent(seriesIndex: number): number | null {
  const data = trendSeries.value[seriesIndex]?.data
  if (!data || data.length < 2) return null
  const today = data[data.length - 1]
  const yesterday = data[data.length - 2]
  if (yesterday === 0) return today > 0 ? 100 : 0
  return Math.round(((today - yesterday) / yesterday) * 100)
}

const heroChanges = computed(() => ({
  pv: changePercent(0),
  uv: changePercent(1),
}))

function goToPost(postId: number) {
  router.push(`/cms/posts/edit?id=${postId}`)
}

const dayOptions = [
  { label: '7天', value: 7 },
  { label: '14天', value: 14 },
  { label: '30天', value: 30 },
]
</script>

<template>
  <div class="h-full overflow-y-auto">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 class="text-xl font-semibold text-base-content">
          欢迎回来，{{ auth.user?.username ?? '访客' }}
        </h1>
        <p class="text-sm text-base-content/50 mt-0.5">
          Dashboard 数据概览，所有统计实时来自数据库。
          <span v-if="lastUpdated" class="text-base-content/30 ml-2">更新于 {{ lastUpdated }}</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center bg-base-200 rounded-lg p-1 border border-[var(--color-base-border)]">
          <button
            v-for="opt in dayOptions"
            :key="opt.value"
            class="px-3 py-1 text-xs font-medium rounded-md transition-all"
            :class="trendDays === opt.value
              ? 'bg-primary text-primary-content shadow-sm'
              : 'text-base-content/60 hover:text-base-content'"
            @click="trendDays = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
        <button class="btn btn-sm btn-primary inline-flex items-center gap-1.5" @click="exportCsv">
          <IconDownload />
          导出报表
        </button>
      </div>
    </div>

    <!-- Hero KPIs -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
      <div
        v-for="item in heroItems"
        :key="item.key"
        class="base-container p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-l-2 border-transparent hover:border-primary"
      >
        <div class="flex items-center justify-between">
          <div class="rounded-lg p-2" :class="[item.bg, item.color]">
            <component :is="item.icon" />
          </div>
          <div v-if="item.sparklineKey && trendSeries.length" class="opacity-60">
            <svg :width="96" :height="28" viewBox="0 0 96 28">
              <defs>
                <linearGradient :id="`grad-${item.key}`" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" :stop-color="trendSeries.find(s => s.name.toLowerCase() === item.sparklineKey)?.color" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="transparent" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path
                :d="sparklineAreaPath(trendSeries.find(s => s.name.toLowerCase() === item.sparklineKey)?.data ?? [], 96, 28)"
                :fill="`url(#grad-${item.key})`"
              />
              <path
                :d="sparklinePath(trendSeries.find(s => s.name.toLowerCase() === item.sparklineKey)?.data ?? [], 96, 28)"
                fill="none"
                :stroke="trendSeries.find(s => s.name.toLowerCase() === item.sparklineKey)?.color"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
        </div>
        <div class="mt-3">
          <div class="text-xs font-medium text-base-content/50 uppercase tracking-wider">
            {{ item.label }}
          </div>
          <div class="mt-1 text-3xl font-light tabular-nums text-white">
            {{ animatedNumbers[item.key] ?? 0 }}
          </div>
          <div v-if="item.sparklineKey" class="flex items-center gap-1 mt-1">
            <span v-if="heroChanges[item.sparklineKey] !== null" class="text-xs font-medium" :class="heroChanges[item.sparklineKey]! >= 0 ? 'text-success' : 'text-error'">
              {{ heroChanges[item.sparklineKey]! >= 0 ? '↑' : '↓' }} {{ Math.abs(heroChanges[item.sparklineKey]!) }}%
            </span>
            <span v-else class="text-base-content/30 text-xs">--%</span>
            <span class="text-base-content/40 text-xs">vs 昨日</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Secondary Metrics -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      <div
        v-for="(item, idx) in secondaryItems"
        :key="item.key"
        class="bg-base-200/40 hover:bg-base-200/60 hover:shadow-md transition-all rounded-xl p-4 flex items-center gap-3"
        :style="{ animationDelay: `${idx * 50}ms` }"
      >
        <div class="rounded-lg p-2 shrink-0" :class="[item.bg, item.color]">
          <component :is="item.icon" />
        </div>
        <div class="min-w-0">
          <div class="text-[11px] text-base-content/50 uppercase tracking-wide">{{ item.label }}</div>
          <div class="text-lg font-medium tabular-nums text-base-content">
            {{ animatedNumbers[item.key] ?? 0 }}
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Row 1 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <div class="base-container p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-base-content">访问趋势</h3>
          <p class="text-xs text-base-content/40 mt-0.5">PV / UV 对比</p>
        </div>
        <div v-if="loading" class="flex items-center justify-center" :style="{ height: '320px' }">
          <div class="text-base-content/40 text-sm">数据加载中...</div>
        </div>
        <div v-else-if="!trendLabels.length" class="flex items-center justify-center" :style="{ height: '320px' }">
          <div class="text-base-content/40 text-sm">暂无数据</div>
        </div>
        <LineChart v-else :labels="trendLabels" :series="trendSeries" :height="320" :fill="true" />
      </div>
      <div class="lg:col-span-1 base-container p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-base-content">新增文章</h3>
          <p class="text-xs text-base-content/40 mt-0.5">最近 20 篇文章</p>
        </div>
        <div
          ref="scrollContainer"
          class="overflow-y-auto"
          :style="{ height: '260px' }"
          @mouseenter="pauseScroll = true"
          @mouseleave="pauseScroll = false"
        >
          <div
            v-for="(post, idx) in recentPosts"
            :key="post.id"
            class="flex items-center gap-3 py-2.5 px-1 border-b border-[var(--color-base-border)] last:border-0 cursor-pointer hover:bg-primary/5 rounded transition-colors"
            @click="goToPost(post.id)"
          >
            <span
              class="text-xs font-mono w-5 text-center shrink-0"
              :class="idx < 3 ? 'text-primary font-bold' : 'text-base-content/30'"
            >{{ idx + 1 }}</span>
            <span class="text-xs text-base-content truncate flex-1 min-w-0">{{ post.title }}</span>
            <span class="text-[10px] text-base-content/30 shrink-0">{{ post.createdAt?.slice(0, 10) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
      <div class="base-container p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-base-content">标签文章分布</h3>
          <p class="text-xs text-base-content/40 mt-0.5">各标签下的文章数量</p>
        </div>
        <PieChart :data="tagPieData" :height="260" />
      </div>
      <div class="base-container p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-base-content">分类文章分布</h3>
          <p class="text-xs text-base-content/40 mt-0.5">各分类下的文章数量</p>
        </div>
        <PieChart :data="catPieData" :height="260" />
      </div>
    </div>

    <!-- Charts Row 3 -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-5">
      <div class="base-container p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-base-content">访问来源 Top 10</h3>
          <p class="text-xs text-base-content/40 mt-0.5">Referrer 域名统计</p>
        </div>
        <BarChart :items="referrers" :height="260" color="#30d158" />
      </div>
      <div class="base-container p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-base-content">今日时段分布</h3>
          <p class="text-xs text-base-content/40 mt-0.5">24 小时 PV / UV 分布</p>
        </div>
        <div ref="hourlyChartRef" :style="{ width: '100%', height: '260px' }" />
      </div>
      <div class="lg:col-span-2 base-container p-5">
        <div class="mb-4">
          <h3 class="text-sm font-semibold text-base-content">文章阅读量 Top 10</h3>
          <p class="text-xs text-base-content/40 mt-0.5">按阅读量排序</p>
        </div>
        <BarChart :items="topPosts" :height="260" color="#f472b6" />
      </div>
    </div>

    <!-- System Footer -->
    <div class="border-t border-[var(--color-base-border)] py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-base-content/40">
      <div class="flex items-center gap-2 flex-wrap">
        <span>系统</span>
        <span class="w-1 h-1 rounded-full bg-base-content/30" />
        <span>{{ stats.userCount }} 管理员</span>
        <span class="w-1 h-1 rounded-full bg-base-content/30" />
        <span>{{ stats.roleCount }} 角色</span>
        <span class="w-1 h-1 rounded-full bg-base-content/30" />
        <span>{{ stats.permissionCount }} 权限</span>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span>知识库</span>
        <span class="w-1 h-1 rounded-full bg-base-content/30" />
        <span>{{ stats.kbDocCount }} 文档</span>
        <span class="w-1 h-1 rounded-full bg-base-content/30" />
        <span>{{ stats.kbCanvasCount }} 画布</span>
      </div>
    </div>
  </div>
</template>
