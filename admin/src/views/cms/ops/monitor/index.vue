<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { NProgress, NStatistic, NButton, NIcon, NSpin } from 'naive-ui'
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

    <div v-if="error" class="text-error mb-4">{{ error }}</div>

    <NSpin :show="loading && !data"">
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- CPU -->
        <div class="bg-base-100 rounded-xl border border-base-content/5 p-5">
          <div class="text-sm font-medium text-base-content mb-4">CPU 使用率</div>
          <div class="flex items-center justify-center py-2">
            <NProgress
              type="dashboard"
              :percentage="Math.min(100, Math.round(data?.cpu.usage ?? 0))"
              :status="(data?.cpu.usage ?? 0) > 80 ? 'error' : (data?.cpu.usage ?? 0) > 60 ? 'warning' : 'success'"
              style="width: 120px"
            />
          </div>
          <div class="text-center text-base-content/50 text-sm">
            {{ (data?.cpu.usage ?? 0).toFixed(2) }}%
          </div>
        </div>

        <!-- Memory -->
        <div class="bg-base-100 rounded-xl border border-base-content/5 p-5">
          <div class="text-sm font-medium text-base-content mb-4">内存使用</div>
          <PieChart
            :data="[
              { name: '已用', value: data?.memory.used ?? 0 },
              { name: '空闲', value: (data?.memory.total ?? 0) - (data?.memory.used ?? 0) },
            ]"
            :height="180"
          />
          <div class="flex items-center justify-center gap-2 mt-3 text-sm text-base-content/50">
            <span>已用: {{ formatSize(data?.memory.used ?? 0) }}</span>
            <span class="text-base-content/20">|</span>
            <span>总计: {{ formatSize(data?.memory.total ?? 0) }}</span>
          </div>
        </div>

        <!-- Disk -->
        <div class="bg-base-100 rounded-xl border border-base-content/5 p-5">
          <div class="text-sm font-medium text-base-content mb-4">磁盘使用</div>
          <PieChart
            :data="[
              { name: '已用', value: data?.disk.used ?? 0 },
              { name: '空闲', value: (data?.disk.total ?? 0) - (data?.disk.used ?? 0) },
            ]"
            :height="180"
          />
          <div class="flex items-center justify-center gap-2 mt-3 text-sm text-base-content/50">
            <span>已用: {{ formatSize(data?.disk.used ?? 0) }}</span>
            <span class="text-base-content/20">|</span>
            <span>总计: {{ formatSize(data?.disk.total ?? 0) }}</span>
          </div>
        </div>

        <!-- Stats -->
        <div class="bg-base-100 rounded-xl border border-base-content/5 p-5">
          <NStatistic label="运行时间" :value="formatDuration(data?.uptime ?? 0)">
            <template #prefix>
              <NIcon :component="PulseOutline" />
            </template>
          </NStatistic>
        </div>

        <div class="bg-base-100 rounded-xl border border-base-content/5 p-5">
          <NStatistic label="数据库大小" :value="formatSize(data?.dbSize ?? 0)">
            <template #prefix>
              <NIcon :component="PulseOutline" />
            </template>
          </NStatistic>
        </div>

        <div class="bg-base-100 rounded-xl border border-base-content/5 p-5">
          <NStatistic label="在线人数（5 分钟）" :value="data?.activeUsers ?? 0">
            <template #prefix>
              <NIcon :component="PulseOutline" />
            </template>
          </NStatistic>
        </div>
      </div>
    </NSpin>
  </div>
</template>
