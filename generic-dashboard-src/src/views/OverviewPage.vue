<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <PanelCard title="统计卡片">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-base-200/30 rounded-xl p-4">
            <div class="text-xs text-base-content/50 uppercase tracking-wider">上传</div>
            <div class="mt-1 text-3xl font-extralight tabular-nums text-white">{{ uploadSpeed }}</div>
            <div class="mt-1 h-14">
              <MiniSparkline :data="uploadHistory" color="#64d2ff" />
            </div>
          </div>
          <div class="bg-base-200/30 rounded-xl p-4">
            <div class="text-xs text-base-content/50 uppercase tracking-wider">下载</div>
            <div class="mt-1 text-3xl font-extralight tabular-nums text-white">{{ downloadSpeed }}</div>
            <div class="mt-1 h-14">
              <MiniSparkline :data="downloadHistory" color="#30d158" />
            </div>
          </div>
        </div>
      </PanelCard>

      <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <CollapseCard title="连接状态" :default-open="true">
          <div class="space-y-3">
            <InfoRow label="状态" variant="success" value="已连接" />
            <InfoRow label="延迟" :value="latency + 'ms'" />
            <InfoRow label="协议" value="VMess + WebSocket" />
          </div>
        </CollapseCard>

        <CollapseCard title="IP 信息" :default-open="true">
          <div class="space-y-3">
            <InfoRow label="出口节点" value="🇭🇰 香港 · HKBN" />
            <InfoRow label="出口 IP" value="103.205.x.x" />
            <InfoRow label="ISP" value="HKBN Enterprise" />
          </div>
        </CollapseCard>
      </div>

      <MetricGrid title="快速指标" :items="quickMetrics" />

      <DataTable
        title="最近连接"
        :columns="tableColumns"
        :data="tableData"
        :show-pagination="true"
        :total="totalConnections"
        v-model:page="currentPage"
      />

      <TagFilter
        title="代理组筛选"
        v-model:modelValue="activeProxyGroup"
        :tags="proxyGroups"
      />

      <ToggleList
        title="功能开关"
        :items="toggleItems"
        @toggle="onToggle"
      />

      <DonutChart title="流量分布" :segments="donutSegments" :size="140" unit="GB" />

      <GaugeChart
        title="今日用量"
        :value="todayPercent"
        :max="100"
        unit="%"
        :size="160"
        color="#64d2ff"
      >
        <template #actions>
          <span class="text-xs text-base-content/40">{{ todayUsed }} / {{ todayLimit }} GB</span>
        </template>
      </GaugeChart>

      <EChartCard title="流量趋势" :height="240" :option="trafficOption" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as echarts from 'echarts'

import PanelCard from '@/components/common/PanelCard.vue'
import MiniSparkline from '@/components/overview/MiniSparkline.vue'
import InfoRow from '@/components/common/InfoRow.vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import MetricGrid from '@/components/data/MetricGrid.vue'
import DataTable from '@/components/data/DataTable.vue'
import TagFilter from '@/components/data/TagFilter.vue'
import ToggleList from '@/components/data/ToggleList.vue'
import EChartCard from '@/components/charts/EChartCard.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import GaugeChart from '@/components/charts/GaugeChart.vue'

const uploadSpeed = ref('12.4')
const downloadSpeed = ref('86.7')
const latency = ref(42)
const uploadHistory = Array.from({ length: 30 }, () => Math.floor(Math.random() * (20 - 5) + 5))
const downloadHistory = Array.from({ length: 30 }, () => Math.floor(Math.random() * (120 - 40) + 40))

const quickMetrics = ref([
  { label: '上行总量', value: '2.34', unit: 'GB', change: 12.5, highlight: true },
  { label: '下行总量', value: '18.62', unit: 'GB', change: 8.3, highlight: true },
  { label: '请求数', value: '24,891', change: -2.1 },
  { label: '平均延迟', value: '42', unit: 'ms', change: -5.2 },
])

const tableColumns = [
  { key: 'host', label: '主机' },
  { key: 'type', label: '类型' },
  { key: 'download', label: '下载' },
  { key: 'upload', label: '上传' },
]
const tableData = ref<any[]>([
  { host: 'api.github.com', type: 'HTTPS', download: '2.4 MB', upload: '120 KB' },
  { host: 'cdn.apple.com', type: 'HTTPS', download: '15.2 MB', upload: '45 KB' },
  { host: 'google.com', type: 'HTTPS', download: '890 KB', upload: '230 KB' },
])
const totalConnections = ref(1247)
const currentPage = ref(1)

const activeProxyGroup = ref('auto')
const proxyGroups = ref([
  { label: '自动选择', value: 'auto', count: 42 },
  { label: '香港节点', value: 'hk', count: 18 },
  { label: '日本节点', value: 'jp', count: 12 },
])

const toggleItems = ref([
  { label: '系统代理', desc: '修改系统网络代理设置', enabled: true },
  { label: 'TUN 模式', desc: '透明代理，接管所有流量', enabled: false },
])
const onToggle = (item: any) => { item.enabled = !item.enabled }

const donutSegments = ref([
  { label: '视频流', value: 8.6, color: '#64d2ff' },
  { label: '网页浏览', value: 4.2, color: '#30d158' },
  { label: '下载', value: 3.8, color: '#bf5af2' },
  { label: '其他', value: 1.7, color: '#ff9f0a' },
])

const todayUsed = ref('18.3')
const todayLimit = ref('50')
const todayPercent = computed(() =>
  Math.round((parseFloat(todayUsed.value) / parseFloat(todayLimit.value)) * 100)
)

const labels = Array.from({ length: 30 }, (_, i) => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - (29 - i))
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
})

const trafficOption = computed(() => ({
  grid: { top: 10, right: 10, bottom: 24, left: 40 },
  tooltip: {
    trigger: 'axis',
    backgroundColor: '#2a323c',
    borderColor: 'transparent',
    textStyle: { color: '#a6adbb', fontSize: 12 },
  },
  xAxis: {
    type: 'category',
    data: labels,
    axisLine: { lineStyle: { color: 'rgba(166,173,187,0.15)' } },
    axisLabel: { color: 'rgba(166,173,187,0.5)', fontSize: 10 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: 'rgba(166,173,187,0.08)' } },
    axisLabel: { color: 'rgba(166,173,187,0.5)', fontSize: 10 },
  },
  series: [
    {
      name: '上传',
      data: uploadHistory,
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 1.5, color: '#64d2ff' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(100,210,255,0.25)' },
          { offset: 1, color: 'rgba(100,210,255,0)' },
        ]),
      },
    },
    {
      name: '下载',
      data: downloadHistory,
      type: 'line',
      smooth: true,
      showSymbol: false,
      lineStyle: { width: 1.5, color: '#30d158' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(48,209,88,0.25)' },
          { offset: 1, color: 'rgba(48,209,88,0)' },
        ]),
      },
    },
  ],
}))

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  timer = setInterval(() => {
    uploadSpeed.value = (Math.random() * 20 + 5).toFixed(1)
    downloadSpeed.value = (Math.random() * 100 + 40).toFixed(1)
    latency.value = Math.floor(Math.random() * 50 + 20)
    uploadHistory.shift(); uploadHistory.push(Math.floor(Math.random() * (20 - 5) + 5))
    downloadHistory.shift(); downloadHistory.push(Math.floor(Math.random() * (120 - 40) + 40))
  }, 2000)
})

onUnmounted(() => clearInterval(timer))
</script>
