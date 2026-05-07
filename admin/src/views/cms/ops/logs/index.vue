<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NInput,
  NSelect,
  NSpin,
  NEmpty,
  NDrawer,
  NDrawerContent,
  NCode,
  NPagination,
  useMessage,
} from 'naive-ui'
import {
  RefreshOutline,
  SearchOutline,
  TimeOutline,
  PersonOutline,
  ServerOutline,
  NavigateOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../../components/common/PageHeader.vue'
import { apiGetAuditLogs, type AuditLogItem } from '../../../../api/ops'
import { formatDateTime, formatRelativeTime } from '../../../../utils/format'

const message = useMessage()

// ---- Query state ----
interface LogQuery {
  action: string
  resourceType: string
  username: string
  startDate: string
  endDate: string
}

const query = ref<LogQuery>({
  action: '',
  resourceType: '',
  username: '',
  startDate: '',
  endDate: '',
})

const actionOptions = [
  { label: '全部操作', value: '' },
  { label: 'POST 创建', value: 'post' },
  { label: 'PUT 更新', value: 'put' },
  { label: 'DELETE 删除', value: 'delete' },
  { label: 'PATCH 部分更新', value: 'patch' },
]

// ---- Data ----
const loading = ref(false)
const logs = ref<AuditLogItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

async function loadLogs() {
  loading.value = true
  try {
    const res = await apiGetAuditLogs({
      page: page.value,
      pageSize: pageSize.value,
      action: query.value.action || undefined,
      resourceType: query.value.resourceType || undefined,
      username: query.value.username || undefined,
      startDate: query.value.startDate || undefined,
      endDate: query.value.endDate || undefined,
    })
    logs.value = res.items
    total.value = res.total
  } catch (e: any) {
    message.error(e?.response?.data?.message || '加载日志失败')
  } finally {
    loading.value = false
  }
}

// Debounced refresh on filter change
let debounceTimer: ReturnType<typeof setTimeout> | null = null
watch(
  () => query.value,
  () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      page.value = 1
      loadLogs()
    }, 300)
  },
  { deep: true },
)

watch([page, pageSize], loadLogs, { immediate: true })

// ---- Stats ----
const stats = computed(() => {
  const items = logs.value
  return {
    total: total.value,
    post: items.filter((i) => i.action === 'post').length,
    put: items.filter((i) => i.action === 'put').length,
    del: items.filter((i) => i.action === 'delete').length,
    error: items.filter((i) => (i.detail?.status ?? 200) >= 400).length,
  }
})

// ---- Detail drawer ----
const detailVisible = ref(false)
const detailRow = ref<AuditLogItem | null>(null)

function openDetail(row: AuditLogItem) {
  detailRow.value = row
  detailVisible.value = true
}

// ---- Action tag style ----
function actionTagStyle(action: string) {
  const map: Record<string, { color: string; bg: string }> = {
    post:   { color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
    put:    { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
    delete: { color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
    patch:  { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  }
  return map[action] ?? { color: '#a6adbb', bg: 'rgba(166,173,187,0.10)' }
}

function statusTagStyle(status: number) {
  if (status >= 200 && status < 300) return { color: '#34d399', bg: 'rgba(52,211,153,0.12)' }
  if (status >= 400) return { color: '#f87171', bg: 'rgba(248,113,113,0.12)' }
  return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' }
}

// ---- Row content builder ----
function formatLogContent(row: AuditLogItem): string {
  const parts: string[] = []
  parts.push(`${row.action.toUpperCase()} ${row.resourceType}`)
  if (row.resourceId) parts.push(`#${row.resourceId}`)
  return parts.join(' ')
}
</script>

<template>
  <div>
    <PageHeader title="审计日志" subtitle="系统操作记录与请求追踪">
      <NButton quaternary circle :loading="loading" @click="loadLogs">
        <template #icon>
          <RefreshOutline />
        </template>
      </NButton>
    </PageHeader>

    <!-- Stat cards -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      <div class="bg-base-100 rounded-xl px-4 py-3 border border-base-content/5">
        <div class="text-xs text-base-content/40 uppercase tracking-wider">总记录</div>
        <div class="mt-1 text-xl font-semibold text-white">{{ stats.total }}</div>
      </div>
      <div class="bg-base-100 rounded-xl px-4 py-3 border border-base-content/5">
        <div class="text-xs text-base-content/40 uppercase tracking-wider">创建</div>
        <div class="mt-1 text-xl font-semibold" style="color: #34d399">{{ stats.post }}</div>
      </div>
      <div class="bg-base-100 rounded-xl px-4 py-3 border border-base-content/5">
        <div class="text-xs text-base-content/40 uppercase tracking-wider">更新</div>
        <div class="mt-1 text-xl font-semibold" style="color: #fbbf24">{{ stats.put }}</div>
      </div>
      <div class="bg-base-100 rounded-xl px-4 py-3 border border-base-content/5">
        <div class="text-xs text-base-content/40 uppercase tracking-wider">删除</div>
        <div class="mt-1 text-xl font-semibold" style="color: #f87171">{{ stats.del }}</div>
      </div>
      <div class="bg-base-100 rounded-xl px-4 py-3 border border-base-content/5">
        <div class="text-xs text-base-content/40 uppercase tracking-wider">异常</div>
        <div class="mt-1 text-xl font-semibold" style="color: #f87171">{{ stats.error }}</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <NInput
        v-model:value="query.username"
        placeholder="搜索用户名"
        clearable
        style="width: 180px"
      >
        <template #prefix>
          <SearchOutline class="w-4 h-4 text-base-content/30" />
        </template>
      </NInput>
      <NSelect
        v-model:value="query.action"
        :options="actionOptions"
        placeholder="操作类型"
        clearable
        style="width: 150px"
      />
      <NInput
        v-model:value="query.resourceType"
        placeholder="资源类型"
        clearable
        style="width: 140px"
      />
      <NInput
        v-model:value="query.startDate"
        placeholder="开始日期"
        clearable
        style="width: 150px"
      />
      <NInput
        v-model:value="query.endDate"
        placeholder="结束日期"
        clearable
        style="width: 150px"
      />
    </div>

    <!-- Log list -->
    <NSpin :show="loading">
      <div v-if="logs.length === 0" class="py-16">
        <NEmpty description="暂无日志记录" />
      </div>

      <div v-else class="flex flex-col gap-2">
        <div
          v-for="row in logs"
          :key="row.id"
          class="group bg-base-100 rounded-xl px-4 py-3 border border-base-content/5 hover:border-base-content/10 transition-all cursor-pointer"
          @click="openDetail(row)"
        >
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <!-- Left: time + action badge -->
            <div class="flex items-center gap-3 flex-shrink-0">
              <div class="flex flex-col items-center justify-center w-14">
                <span class="text-xs text-base-content/40 font-mono">
                  {{ row.createdAt ? row.createdAt.slice(11, 19) : '--:--:--' }}
                </span>
                <span class="text-[10px] text-base-content/25 font-mono">
                  {{ row.createdAt ? row.createdAt.slice(5, 10) : '--' }}
                </span>
              </div>

              <div
                class="px-2 py-0.5 rounded-md text-xs font-bold tracking-wider"
                :style="{
                  color: actionTagStyle(row.action).color,
                  background: actionTagStyle(row.action).bg,
                }"
              >
                {{ row.action.toUpperCase() }}
              </div>

              <div
                v-if="row.detail?.status"
                class="px-2 py-0.5 rounded-md text-xs font-bold"
                :style="{
                  color: statusTagStyle(row.detail.status).color,
                  background: statusTagStyle(row.detail.status).bg,
                }"
              >
                {{ row.detail.status }}
              </div>
            </div>

            <!-- Middle: content -->
            <div class="flex-1 min-w-0">
              <div class="text-sm text-base-content truncate">
                {{ formatLogContent(row) }}
              </div>
              <div class="flex items-center gap-3 mt-1 text-xs text-base-content/40">
                <span class="flex items-center gap-1">
                  <PersonOutline class="w-3 h-3" />
                  {{ row.username ?? 'system' }}
                </span>
                <span class="flex items-center gap-1">
                  <ServerOutline class="w-3 h-3" />
                  {{ row.resourceType }}{{ row.resourceId ? ` #${row.resourceId}` : '' }}
                </span>
                <span v-if="row.ip" class="flex items-center gap-1">
                  <NavigateOutline class="w-3 h-3" />
                  {{ row.ip }}
                </span>
                <span v-if="row.detail?.durationMs" class="flex items-center gap-1">
                  <TimeOutline class="w-3 h-3" />
                  {{ row.detail.durationMs }}ms
                </span>
              </div>
            </div>

            <!-- Right: relative time -->
            <div class="hidden sm:block flex-shrink-0 text-xs text-base-content/25">
              {{ formatRelativeTime(row.createdAt) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="total > 0" class="mt-5 flex justify-end">
        <NPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :item-count="total"
          :page-sizes="[10, 20, 50, 100]"
          show-size-picker
        />
      </div>
    </NSpin>

    <!-- Detail drawer -->
    <NDrawer
      v-model:show="detailVisible"
      :width="480"
      placement="right"
    >
      <NDrawerContent v-if="detailRow" :title="`请求详情 #${detailRow.id}`" closable>
        <div class="flex flex-col gap-5">
          <!-- Meta grid -->
          <div class="grid grid-cols-2 gap-3">
            <div class="bg-base-200/50 rounded-lg px-3 py-2">
              <div class="text-xs text-base-content/40">操作</div>
              <div class="text-sm font-medium text-base-content mt-0.5">{{ detailRow.action.toUpperCase() }}</div>
            </div>
            <div class="bg-base-200/50 rounded-lg px-3 py-2">
              <div class="text-xs text-base-content/40">状态码</div>
              <div class="text-sm font-medium text-base-content mt-0.5">{{ detailRow.detail?.status ?? '—' }}</div>
            </div>
            <div class="bg-base-200/50 rounded-lg px-3 py-2">
              <div class="text-xs text-base-content/40">用户</div>
              <div class="text-sm font-medium text-base-content mt-0.5">{{ detailRow.username ?? '—' }}</div>
            </div>
            <div class="bg-base-200/50 rounded-lg px-3 py-2">
              <div class="text-xs text-base-content/40">耗时</div>
              <div class="text-sm font-medium text-base-content mt-0.5">{{ detailRow.detail?.durationMs ?? 0 }}ms</div>
            </div>
            <div class="bg-base-200/50 rounded-lg px-3 py-2 col-span-2">
              <div class="text-xs text-base-content/40">时间</div>
              <div class="text-sm font-medium text-base-content mt-0.5">{{ formatDateTime(detailRow.createdAt) }}</div>
            </div>
            <div v-if="detailRow.ip" class="bg-base-200/50 rounded-lg px-3 py-2 col-span-2">
              <div class="text-xs text-base-content/40">IP 地址</div>
              <div class="text-sm font-medium text-base-content mt-0.5">{{ detailRow.ip }}</div>
            </div>
          </div>

          <!-- Query -->
          <div v-if="detailRow.detail?.query && Object.keys(detailRow.detail.query).length > 0">
            <div class="text-xs text-base-content/40 mb-1">Query 参数</div>
            <NCode
              :code="JSON.stringify(detailRow.detail.query, null, 2)"
              language="json"
              show-line-numbers
            />
          </div>

          <!-- Body -->
          <div v-if="detailRow.detail?.body">
            <div class="text-xs text-base-content/40 mb-1">请求 Body</div>
            <NCode
              :code="JSON.stringify(detailRow.detail.body, null, 2)"
              language="json"
              show-line-numbers
            />
          </div>

          <!-- User Agent -->
          <div v-if="detailRow.userAgent">
            <div class="text-xs text-base-content/40 mb-1">User Agent</div>
            <div class="bg-base-200/50 rounded-lg px-3 py-2 text-xs text-base-content/70 break-all">
              {{ detailRow.userAgent }}
            </div>
          </div>

          <!-- Message (plain-text detail from handler auditLog) -->
          <div v-if="detailRow.detail?.message">
            <div class="text-xs text-base-content/40 mb-1">描述</div>
            <div class="bg-base-200/50 rounded-lg px-3 py-2 text-sm text-base-content/80 break-all">
              {{ detailRow.detail.message }}
            </div>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>
