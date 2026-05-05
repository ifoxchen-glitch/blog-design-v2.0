<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { NCard, NSpace, NProgress, NStatistic, NGrid, NGridItem, NButton, NIcon } from 'naive-ui'
import { RefreshOutline, PulseOutline } from '@vicons/ionicons5'
import PageHeader from '../../../../components/common/PageHeader.vue'
import PieChart from '../../../../components/charts/PieChart.vue'
import { apiGetMonitor, type MonitorData } from '../../../../api/ops'
import { formatSize } from '../../../../utils/format'

const data = ref<MonitorData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

async function fetchData() {
  loading.value = true
  error.value = null
  try {
    data.value = await apiGetMonitor()
  } catch (e: any) {
    error.value = e?.response?.data?.message || '获取监控数据失败'
  } finally {
    loading.value = false
  }
}

function startPolling() {
  timer = setInterval(() => {
    fetchData()
  }, 30000)
}

function stopPolling() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const parts: string[] = []
  if (d > 0) parts.push(`${d}天`)
  if (h > 0) parts.push(`${h}小时`)
  if (m > 0 || parts.length === 0) parts.push(`${m}分钟`)
  return parts.join(' ')
}

onMounted(() => {
  fetchData()
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div>
    <PageHeader title="系统监控" subtitle="服务器资源与运行状态（每 30 秒自动刷新）">
      <template #extra>
        <NButton quaternary circle :loading="loading" @click="fetchData">
          <NIcon><RefreshOutline /></NIcon>
        </NButton>
      </template>
    </PageHeader>

    <div v-if="error" style="color: #d03050; margin-bottom: 16px">{{ error }}</div>

    <NGrid :cols="3" :x-gap="16" :y-gap="16" responsive="screen">
      <NGridItem span="1">
        <NCard title="CPU 使用率">
          <NSpace align="center" justify="center" style="padding: 16px 0">
            <NProgress
              type="dashboard"
              :percentage="Math.min(100, Math.round(data?.cpu.usage ?? 0))"
              :status="(data?.cpu.usage ?? 0) > 80 ? 'error' : (data?.cpu.usage ?? 0) > 60 ? 'warning' : 'success'"
              style="width: 120px"
            />
          </NSpace>
          <div style="text-align: center; color: #888; font-size: 14px">
            {{ (data?.cpu.usage ?? 0).toFixed(2) }}%
          </div>
        </NCard>
      </NGridItem>

      <NGridItem span="1">
        <NCard title="内存使用">
          <PieChart
            :data="[
              { name: '已用', value: data?.memory.used ?? 0 },
              { name: '空闲', value: (data?.memory.total ?? 0) - (data?.memory.used ?? 0) },
            ]"
            :height="180"
          />
          <NSpace justify="center" size="small" style="margin-top: 8px">
            <span>已用: {{ formatSize(data?.memory.used ?? 0) }}</span>
            <span style="color: #ccc">|</span>
            <span>总计: {{ formatSize(data?.memory.total ?? 0) }}</span>
          </NSpace>
        </NCard>
      </NGridItem>

      <NGridItem span="1">
        <NCard title="磁盘使用">
          <PieChart
            :data="[
              { name: '已用', value: data?.disk.used ?? 0 },
              { name: '空闲', value: (data?.disk.total ?? 0) - (data?.disk.used ?? 0) },
            ]"
            :height="180"
          />
          <NSpace justify="center" size="small" style="margin-top: 8px">
            <span>已用: {{ formatSize(data?.disk.used ?? 0) }}</span>
            <span style="color: #ccc">|</span>
            <span>总计: {{ formatSize(data?.disk.total ?? 0) }}</span>
          </NSpace>
        </NCard>
      </NGridItem>

      <NGridItem span="1">
        <NCard>
          <NStatistic label="运行时间" :value="formatDuration(data?.uptime ?? 0)">
            <template #prefix>
              <NIcon :component="PulseOutline" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>

      <NGridItem span="1">
        <NCard>
          <NStatistic label="数据库大小" :value="formatSize(data?.dbSize ?? 0)">
            <template #prefix>
              <NIcon :component="PulseOutline" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>

      <NGridItem span="1">
        <NCard>
          <NStatistic label="在线人数（5 分钟）" :value="data?.activeUsers ?? 0">
            <template #prefix>
              <NIcon :component="PulseOutline" />
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>
  </div>
</template>
