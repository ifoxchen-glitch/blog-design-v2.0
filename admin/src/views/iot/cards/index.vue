<script setup lang="ts">
import { computed, h, ref, onMounted, watch } from 'vue'
import axios from 'axios'
import {
  NButton,
  NInput,
  NSelect,
  NPopconfirm,
  NPagination,
  NSpin,
  NEmpty,
  NDataTable,
  NTag,
  NDrawer,
  NDrawerContent,
  NDescriptions,
  NDescriptionsItem,
  NModal,
  NAlert,
  NSwitch,
  NProgress,
  NCard,
  NRadioGroup,
  NRadioButton,
  useMessage,
} from 'naive-ui'
import {
  SearchOutline,
  RefreshOutline,
  CloudUploadOutline,
  ListOutline,
  GridOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import PieChart from '../../../components/charts/PieChart.vue'
import BarChart from '../../../components/charts/BarChart.vue'
import {
  apiGetCards,
  apiGetCard,
  apiGetCardHistory,
  apiSyncCards,
  apiBatchCards,
  apiGetBalance,
  apiGetStats,
  apiDeleteCard,
  apiEnableCard,
  apiDisableCard,
  type CardItem,
  type StatsData,
  type HistoryItem,
} from '../../../api/iot'
import { usePermissionStore } from '../../../stores/permission'
import { useTable } from '../../../composables/useTable'

const message = useMessage()
const permissionStore = usePermissionStore()

interface CardQuery {
  keyword: string
  status: string
  operator: string
  region: string
  combo: string
  sortKey: string
  sortOrder: 'asc' | 'desc'
}

const initialQuery: CardQuery = {
  keyword: '',
  status: '',
  operator: '',
  region: '',
  combo: '',
  sortKey: '',
  sortOrder: 'desc',
}

// View mode toggle: 'list' | 'card'
const viewMode = ref<'list' | 'card'>('list')

const table = useTable<CardItem, CardQuery>({
  fetch: async (params) => {
    const res = await apiGetCards({
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.keyword || undefined,
      status: params.status || undefined,
      operator: params.operator || undefined,
      region: params.region || undefined,
      combo: params.combo || undefined,
      sortKey: params.sortKey || undefined,
      sortOrder: params.sortOrder || undefined,
    })
    return { list: res.items, total: res.total }
  },
  initialQuery,
  pageSize: 20,
})

// Status options
const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '在线', value: '1' },
  { label: '离线', value: '2' },
  { label: '停机', value: '3' },
  { label: '机卡分离', value: '4' },
]

// Operator options
const OPERATOR_OPTIONS = [
  { label: '全部运营商', value: '' },
  { label: '联通', value: '1' },
  { label: '移动', value: '2' },
  { label: '电信', value: '3' },
]

// Region / Combo filter options (populated from stats)
const regionOptions = ref<{ label: string; value: string }[]>([{ label: '全部区域', value: '' }])
const comboOptions = ref<{ label: string; value: string }[]>([{ label: '全部套餐', value: '' }])

// Sort options
const SORT_OPTIONS = [
  { label: '默认排序', value: '' },
  { label: '卡号 ↑', value: 'card_no:asc' },
  { label: '卡号 ↓', value: 'card_no:desc' },
  { label: '已用流量 ↑', value: 'combo_used:asc' },
  { label: '已用流量 ↓', value: 'combo_used:desc' },
  { label: '剩余流量 ↑', value: 'combo_residue:asc' },
  { label: '剩余流量 ↓', value: 'combo_residue:desc' },
  { label: '到期时间 ↑', value: 'end_time:asc' },
  { label: '到期时间 ↓', value: 'end_time:desc' },
]

function applySort(value: string) {
  if (!value) {
    table.query.sortKey = ''
    table.query.sortOrder = 'desc'
  } else {
    const [key, order] = value.split(':')
    table.query.sortKey = key
    table.query.sortOrder = order as 'asc' | 'desc'
  }
  table.refresh()
}

// Balance
const balance = ref<string | null>(null)
const balanceLoading = ref(false)
async function loadBalance() {
  balanceLoading.value = true
  try {
    const res = await apiGetBalance()
    balance.value = res.amount
  } catch {
    balance.value = null
  } finally {
    balanceLoading.value = false
  }
}
loadBalance()

// Stats / Dashboard
const stats = ref<StatsData | null>(null)
const statsLoading = ref(false)
async function loadStats() {
  statsLoading.value = true
  try {
    const res = await apiGetStats()
    stats.value = res
    regionOptions.value = [
      { label: '全部区域', value: '' },
      ...res.regionDist.map((r) => ({ label: r.region, value: r.region })),
    ]
    comboOptions.value = [
      { label: '全部套餐', value: '' },
      ...res.comboDist.map((c) => ({ label: c.combo, value: c.combo })),
    ]
  } catch {
    stats.value = null
  } finally {
    statsLoading.value = false
  }
}
onMounted(() => {
  loadStats()
})

// Sync
const syncLoading = ref(false)
async function handleSync() {
  syncLoading.value = true
  try {
    const res = await apiSyncCards()
    message.success(`同步成功，共 ${res.cardCount} 张卡`)
    table.refresh()
    loadBalance()
    loadStats()
  } catch (e: unknown) {
    message.error(extractError(e, '同步失败'))
  } finally {
    syncLoading.value = false
  }
}

// Batch query dialog
const batchVisible = ref(false)
const batchText = ref('')
const batchLoading = ref(false)
const batchError = ref<string | null>(null)
const batchResults = ref<CardItem[]>([])

async function handleBatchQuery() {
  const lines = batchText.value
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (lines.length === 0) {
    batchError.value = '请输入卡号'
    return
  }
  if (lines.length > 1000) {
    batchError.value = '最多支持 1000 张卡'
    return
  }
  batchError.value = null
  batchLoading.value = true
  try {
    const res = await apiBatchCards(lines)
    batchResults.value = res.items
    if (res.items.length === 0) {
      batchError.value = '未找到任何卡片'
    }
    table.refresh()
    loadStats()
  } catch (e: unknown) {
    batchError.value = extractError(e, '批量查询失败')
  } finally {
    batchLoading.value = false
  }
}

// Detail drawer
const detailVisible = ref(false)
const detailLoading = ref(false)
const selectedCard = ref<CardItem | null>(null)

// History chart in drawer
const historyPrecision = ref<'hour' | 'day' | 'week'>('hour')
const historyData = ref<HistoryItem[]>([])
const historyLoading = ref(false)

async function loadHistory(cardNo: string) {
  historyLoading.value = true
  try {
    const res = await apiGetCardHistory(cardNo, historyPrecision.value)
    historyData.value = res.items
  } catch {
    historyData.value = []
  } finally {
    historyLoading.value = false
  }
}

watch(historyPrecision, () => {
  if (selectedCard.value) {
    loadHistory(selectedCard.value.cardNo)
  }
})

async function handleView(row: CardItem) {
  detailLoading.value = true
  detailVisible.value = true
  selectedCard.value = null
  historyData.value = []
  try {
    const res = await apiGetCard(row.cardNo)
    selectedCard.value = res
    loadHistory(row.cardNo)
  } catch {
    selectedCard.value = row
  } finally {
    detailLoading.value = false
  }
}

// Enable / Disable toggle
const toggleLoadingMap = ref<Record<string, boolean>>({})

async function handleToggle(row: CardItem, nextEnabled: boolean) {
  toggleLoadingMap.value[row.cardNo] = true
  try {
    if (nextEnabled) {
      await apiEnableCard(row.cardNo)
      message.success('卡已启用')
    } else {
      await apiDisableCard(row.cardNo)
      message.success('卡已禁用')
    }
    table.refresh()
    loadStats()
  } catch (e: unknown) {
    message.error(extractError(e, nextEnabled ? '启用失败' : '禁用失败'))
  } finally {
    toggleLoadingMap.value[row.cardNo] = false
  }
}

// Delete
async function handleDelete(row: CardItem) {
  try {
    await apiDeleteCard(row.cardNo)
    message.success('卡片已删除')
    table.refresh()
    loadStats()
  } catch (e: unknown) {
    message.error(extractError(e, '删除失败'))
  }
}

// Normalize gprsState to string for consistent key lookup
function normalizeGprs(state: string | number | null | undefined) {
  if (state == null) return '0'
  return String(state)
}

// Status label text (for text display in card view)
function gprsStateLabel(state: string | number | null | undefined) {
  const s = normalizeGprs(state)
  const map: Record<string, string> = { '0': '未知', '1': '在线', '2': '离线', '3': '停机', '4': '机卡分离' }
  return map[s] || '未知'
}

// Status tag VNode (for NDataTable render and NTag in templates)
function gprsStateTag(state: string | number | null | undefined) {
  const s = normalizeGprs(state)
  const map: Record<string, { label: string; type: string }> = {
    '0': { label: '未知', type: 'warning' },
    '1': { label: '在线', type: 'success' },
    '2': { label: '离线', type: 'default' },
    '3': { label: '停机', type: 'error' },
    '4': { label: '机卡分离', type: 'error' },
  }
  const t = map[s] || { label: '未知', type: 'warning' }
  return h(NTag, { size: 'small', type: t.type as any }, () => t.label)
}

function operatorLabel(op: string) {
  const map: Record<string, string> = { '1': '联通', '2': '移动', '3': '电信' }
  return map[op] || op || '-'
}

function usagePercent(used: number | null | undefined, total: number | null | undefined) {
  if (!used || !total || total <= 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

// Table columns (list view — show all key fields)
const tableColumns = computed(() => [
  {
    title: '卡号',
    key: 'cardNo',
    width: 160,
    ellipsis: { tooltip: true },
    sorter: true,
  },
  {
    title: 'ICCID',
    key: 'iccid',
    width: 180,
    ellipsis: { tooltip: true },
  },
  {
    title: 'MSISDN',
    key: 'msisdn',
    width: 130,
    ellipsis: { tooltip: true },
  },
  {
    title: 'IMEI',
    key: 'imei',
    width: 150,
    ellipsis: { tooltip: true },
  },
  {
    title: '运营商',
    key: 'operator',
    width: 70,
    render(row: CardItem) {
      return operatorLabel(row.operator)
    },
  },
  {
    title: '卡状态',
    key: 'gprsState',
    width: 100,
    render(row: CardItem) {
      return h('span', {}, [
        h('span', { class: 'text-red-400 mr-1' }, `[${row.gprsState}]`),
        gprsStateTag(row.gprsState),
      ])
    },
  },
  {
    title: '开关机状态',
    key: 'onOffStatus',
    width: 100,
    render(row: CardItem) {
      const s = String(row.onOffStatus ?? '')
      const map: Record<string, string> = { '1': '在线', '0': '离线' }
      return h(NTag, { size: 'small', type: s === '1' ? 'success' : 'default' as any }, () => `[${s}] ${map[s] || '-'}`)
    },
  },
  {
    title: '套餐',
    key: 'comboName',
    width: 160,
    ellipsis: { tooltip: true },
  },
  {
    title: '用量',
    key: 'comboUsed',
    width: 100,
    sorter: true,
    render(row: CardItem) {
      const used = row.comboUsed
      if (used == null) return '-'
      return used >= 1024 ? (used / 1024).toFixed(1) + 'G' : used.toFixed(0) + 'M'
    },
  },
  {
    title: '剩余',
    key: 'comboResidue',
    width: 90,
    sorter: true,
    render(row: CardItem) {
      const v = row.comboResidue
      if (v === null || v === undefined) return '-'
      if (v >= 1024) return (v / 1024).toFixed(1) + 'G'
      return v.toFixed(0) + 'M'
    },
  },
  {
    title: '到期时间',
    key: 'endTime',
    width: 110,
    sorter: true,
  },
  {
    title: '位置',
    key: 'realPosition',
    width: 100,
    ellipsis: { tooltip: true },
  },
  {
    title: '开关',
    key: 'toggle',
    width: 70,
    fixed: 'right',
    render(row: CardItem) {
      const canToggle = permissionStore.hasPermission('iot:card:enable') || permissionStore.hasPermission('iot:card:disable')
      if (!canToggle) return '-'
      const isOn = row.status === '1'
      return h(NSwitch, {
        size: 'small',
        value: isOn,
        loading: toggleLoadingMap.value[row.cardNo],
        'onUpdate:value': (v: boolean) => handleToggle(row, v),
      })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    fixed: 'right',
    render(row: CardItem) {
      return h('div', { class: 'flex items-center gap-1' }, [
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => handleView(row) }, () => '查看'),
        h(NPopconfirm,
          { 'onPositive-click': () => handleDelete(row) },
          {
            trigger: () => permissionStore.hasPermission('iot:card:delete')
              ? h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, () => '删除')
              : null,
            default: () => `确认删除卡片 ${row.cardNo}?`,
          },
        ),
      ])
    },
  },
] as any)

function extractError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message) return data.message
  }
  if (e instanceof Error) return e.message
  return fallback
}
</script>

<template>
  <div>
    <PageHeader title="物联网卡管理" :subtitle="balance ? `账户余额: ¥${balance}` : undefined">
      <NButton v-permission="'iot:card:list'" type="primary" :loading="syncLoading" @click="handleSync">
        <CloudUploadOutline class="w-4 h-4 mr-1" />
        同步
      </NButton>
      <NButton v-permission="'iot:card:list'" @click="batchVisible = true">
        批量查询
      </NButton>
    </PageHeader>

    <!-- Search & Filter -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-[200px] max-w-[320px]">
        <NInput
          v-model:value="table.query.keyword"
          placeholder="搜索卡号 / MSISDN / ICCID"
          clearable
          @update:value="table.refresh()"
        >
          <template #prefix>
            <SearchOutline class="w-4 h-4 text-base-content/30" />
          </template>
        </NInput>
      </div>
      <NSelect
        v-model:value="table.query.status"
        :options="STATUS_OPTIONS"
        placeholder="状态"
        clearable
        style="width: 120px"
        @update:value="table.refresh()"
      />
      <NSelect
        v-model:value="table.query.operator"
        :options="OPERATOR_OPTIONS"
        placeholder="运营商"
        clearable
        style="width: 120px"
        @update:value="table.refresh()"
      />
      <NSelect
        v-model:value="table.query.region"
        :options="regionOptions"
        placeholder="区域"
        clearable
        style="width: 140px"
        @update:value="table.refresh()"
      />
      <NSelect
        v-model:value="table.query.combo"
        :options="comboOptions"
        placeholder="套餐"
        clearable
        style="width: 160px"
        @update:value="table.refresh()"
      />
      <NSelect
        :value="table.query.sortKey ? `${table.query.sortKey}:${table.query.sortOrder}` : ''"
        :options="SORT_OPTIONS"
        placeholder="排序"
        clearable
        style="width: 140px"
        @update:value="applySort"
      />
      <NButton quaternary circle :loading="table.loading.value" @click="table.refresh()">
        <RefreshOutline class="w-4 h-4" />
      </NButton>
      <div class="flex items-center ml-auto">
        <NButton
          quaternary
          :type="viewMode === 'list' ? 'primary' : 'default'"
          @click="viewMode = 'list'"
        >
          <ListOutline class="w-4 h-4 mr-1" />
          列表
        </NButton>
        <NButton
          quaternary
          :type="viewMode === 'card' ? 'primary' : 'default'"
          @click="viewMode = 'card'"
        >
          <GridOutline class="w-4 h-4 mr-1" />
          卡片
        </NButton>
      </div>
    </div>

    <!-- List View -->
    <NSpin v-if="viewMode === 'list'" :show="table.loading.value">
      <div v-if="table.data.value.length === 0 && !table.loading.value" class="py-16">
        <NEmpty description="暂无物联网卡">
          <template #extra>
            <p class="text-sm text-base-content/40 mt-2">点击右上角"同步"从IoT平台同步卡片数据</p>
          </template>
        </NEmpty>
      </div>

      <NDataTable
        v-else
        :columns="tableColumns"
        :data="table.data.value"
        :loading="table.loading.value"
        :bordered="false"
        :single-line="false"
        striped
        size="small"
        class="rounded-xl overflow-hidden"
        :scroll-x="1400"
        @update:sorter="(s: any) => s ? applySort(`${s.columnKey}:${s.order}`) : applySort('')"
      />
    </NSpin>

    <!-- Card View -->
    <NSpin v-else :show="table.loading.value">
      <div v-if="table.data.value.length === 0 && !table.loading.value" class="py-16">
        <NEmpty description="暂无物联网卡">
          <template #extra>
            <p class="text-sm text-base-content/40 mt-2">点击右上角"同步"从IoT平台同步卡片数据</p>
          </template>
        </NEmpty>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="card in table.data.value"
          :key="card.cardNo"
          class="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
        >
          <div class="flex items-center justify-between mb-3">
            <div class="font-medium text-sm truncate" :title="card.cardNo">{{ card.cardNo }}</div>
            <div class="flex items-center gap-2">
              <NTag
                size="small"
                :type="(card.gprsState === '1' ? 'success' : card.gprsState === '2' ? 'default' : card.gprsState === '0' ? 'warning' : 'error') as any"
              >
                {{ { '0': '未知', '1': '在线', '2': '离线', '3': '停机', '4': '机卡分离' }[card.gprsState] || '未知' }}
              </NTag>
              <NSwitch
                v-if="permissionStore.hasPermission('iot:card:enable') || permissionStore.hasPermission('iot:card:disable')"
                :value="card.status === '1'"
                :loading="toggleLoadingMap[card.cardNo]"
                size="small"
                @update:value="(v: boolean) => handleToggle(card, v)"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
            <div><span class="text-slate-400">ICCID: </span>{{ card.iccid || '-' }}</div>
            <div><span class="text-slate-400">MSISDN: </span>{{ card.msisdn || '-' }}</div>
            <div><span class="text-slate-400">IMEI: </span>{{ (card as any).imei || '-' }}</div>
            <div><span class="text-slate-400">运营商: </span>{{ operatorLabel(card.operator) }}</div>
            <div><span class="text-slate-400">卡状态: </span>{{ gprsStateLabel(card.gprsState) }}</div>
            <div><span class="text-slate-400">开关机状态: </span>{{ card.onOffStatus === '1' ? '在线' : card.onOffStatus === '0' ? '离线' : '-' }}</div>
            <div><span class="text-slate-400">激活: </span>{{ { '1': '测试期', '2': '库存期', '3': '已激活' }[card.activatedState] || '-' }}</div>
            <div class="col-span-2"><span class="text-slate-400">套餐: </span>{{ card.comboName || '-' }}</div>
            <div><span class="text-slate-400">位置: </span>{{ card.realPosition || '-' }}</div>
            <div><span class="text-slate-400">到期: </span>{{ card.endTime || '-' }}</div>
          </div>

          <!-- Usage progress bar -->
          <div class="mb-3">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-slate-500">
                已用 {{ card.comboUsed != null ? (card.comboUsed >= 1024 ? (card.comboUsed/1024).toFixed(1) + 'G' : card.comboUsed.toFixed(0) + 'M') : '-' }}
              </span>
              <span class="text-slate-400">
                {{ usagePercent(card.comboUsed, card.comboTotal) }}%
              </span>
            </div>
            <NProgress
              :percentage="usagePercent(card.comboUsed, card.comboTotal)"
              :height="8"
              :border-radius="4"
              :color="usagePercent(card.comboUsed, card.comboTotal) > 90 ? '#ef4444' : usagePercent(card.comboUsed, card.comboTotal) > 70 ? '#f59e0b' : '#3b82f6'"
              :show-indicator="false"
            />
          </div>

          <div class="flex justify-between items-center">
            <NButton size="tiny" quaternary @click="handleView(card)">查看详情</NButton>
            <NPopconfirm
              v-if="permissionStore.hasPermission('iot:card:delete')"
              :on-positive-click="() => handleDelete(card)"
            >
              <template #trigger>
                <NButton size="tiny" quaternary type="error">删除</NButton>
              </template>
              确认删除卡片 {{ card.cardNo }}?
            </NPopconfirm>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- Pagination -->
    <div v-if="table.total.value > 0" class="mt-6 flex justify-end">
      <NPagination
        :page="table.page.value"
        :page-size="table.pageSize.value"
        :item-count="table.total.value"
        :page-sizes="[20, 50, 100]"
        show-size-picker
        @update:page="table.handlePageChange"
        @update:page-size="table.handlePageSizeChange"
      />
    </div>

    <!-- Dashboard Section -->
    <div v-if="stats" class="mt-10 pt-8 border-t border-slate-200 dark:border-slate-700">
      <h3 class="text-lg font-semibold mb-5 text-slate-800 dark:text-slate-200">数据仪表盘</h3>

      <!-- Stat Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <NCard size="small" class="text-center">
          <div class="text-2xl font-bold text-slate-800 dark:text-slate-100">{{ stats.total }}</div>
          <div class="text-xs text-slate-500 mt-1">总卡片数</div>
        </NCard>
        <NCard size="small" class="text-center">
          <div class="text-2xl font-bold text-emerald-500">{{ stats.online }}</div>
          <div class="text-xs text-slate-500 mt-1">在线</div>
        </NCard>
        <NCard size="small" class="text-center">
          <div class="text-2xl font-bold text-slate-400">{{ stats.offline }}</div>
          <div class="text-xs text-slate-500 mt-1">离线</div>
        </NCard>
        <NCard size="small" class="text-center">
          <div class="text-2xl font-bold text-rose-500">{{ stats.stopped }}</div>
          <div class="text-xs text-slate-500 mt-1">停机</div>
        </NCard>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <NCard size="small" class="text-center">
          <div class="text-2xl font-bold text-blue-500">
            {{ stats.totalUsed >= 1024 ? (stats.totalUsed / 1024).toFixed(1) + ' GB' : stats.totalUsed.toFixed(0) + ' MB' }}
          </div>
          <div class="text-xs text-slate-500 mt-1">总已用流量</div>
        </NCard>
        <NCard size="small" class="text-center">
          <div class="text-2xl font-bold text-teal-500">
            {{ stats.totalResidue >= 1024 ? (stats.totalResidue / 1024).toFixed(1) + ' GB' : stats.totalResidue.toFixed(0) + ' MB' }}
          </div>
          <div class="text-xs text-slate-500 mt-1">总剩余流量</div>
        </NCard>
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NCard title="运营商分布" size="small">
          <PieChart
            :data="stats.operatorDist.map(d => ({ name: { '1': '联通', '2': '移动', '3': '电信' }[d.operator] || d.operator, value: d.count }))"
            :height="240"
          />
        </NCard>
        <NCard title="区域分布 TOP10" size="small">
          <BarChart
            :items="stats.regionDist.map(d => ({ name: d.region, value: d.count }))"
            :height="240"
            :bar-width="16"
          />
        </NCard>
        <NCard title="套餐分布 TOP10" size="small">
          <BarChart
            :items="stats.comboDist.map(d => ({ name: d.combo, value: d.count }))"
            :height="240"
            :bar-width="16"
          />
        </NCard>
        <NCard title="24小时用量趋势" size="small">
          <div v-if="stats.trend.length === 0" class="text-center text-sm text-slate-400 py-10">暂无数据</div>
          <div v-else class="flex items-end justify-between gap-1 h-[200px] pt-4 px-2">
            <div
              v-for="t in stats.trend"
              :key="t.hour"
              class="flex-1 flex flex-col items-center gap-1"
            >
              <div
                class="w-full bg-blue-500/80 rounded-t-sm min-h-[4px]"
                :style="{ height: `${Math.max(4, (t.totalUsed / Math.max(...stats.trend.map(x => x.totalUsed))) * 160)}px` }"
              />
              <div class="text-[10px] text-slate-500">{{ t.hour }}时</div>
            </div>
          </div>
        </NCard>
        <NCard title="卡状态分布" size="small">
          <PieChart
            :data="stats.gprsStateDist.map(d => ({ name: { '0': '未知', '1': '在线', '2': '离线', '3': '停机', '4': '机卡分离' }[d.state] || d.state, value: d.count }))"
            :height="240"
          />
        </NCard>
      </div>
    </div>

    <!-- Detail Drawer -->
    <NDrawer v-model:show="detailVisible" :width="520" placement="right">
      <NDrawerContent title="卡片详情" closable>
        <NSpin :show="detailLoading">
          <template v-if="selectedCard">
            <!-- All fields -->
            <NDescriptions :column="1" label-placement="left" size="large" class="mb-6">
              <NDescriptionsItem label="卡号">{{ selectedCard.cardNo }}</NDescriptionsItem>
              <NDescriptionsItem label="MSISDN">{{ selectedCard.msisdn || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="IMEI">{{ (selectedCard as any).imei || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="ICCID">{{ selectedCard.iccid || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="IMSI">{{ selectedCard.imsi || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="运营商">{{ operatorLabel(selectedCard.operator) }}</NDescriptionsItem>
              <NDescriptionsItem label="卡形态">{{ selectedCard.cardType || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="套餐">{{ selectedCard.comboName || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="已用">{{ selectedCard.comboUsed != null ? selectedCard.comboUsed + ' MB' : '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="剩余">{{ selectedCard.comboResidue != null ? selectedCard.comboResidue + ' MB' : '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="总量">{{ selectedCard.comboTotal != null ? selectedCard.comboTotal + ' MB' : '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="状态">{{ gprsStateLabel(selectedCard.gprsState) }}</NDescriptionsItem>
              <NDescriptionsItem label="联网状态">{{ selectedCard.onOffStatus === '1' ? '在线' : selectedCard.onOffStatus === '0' ? '不在线' : '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="激活状态">{{ selectedCard.activatedState === '1' ? '测试期' : selectedCard.activatedState === '2' ? '库存期' : selectedCard.activatedState === '3' ? '已激活' : '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="实时位置">{{ selectedCard.realPosition || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="激活时间">{{ selectedCard.activationTime || '-' }}</NDescriptionsItem>
              <NDescriptionsItem label="到期时间">{{ selectedCard.endTime || '-' }}</NDescriptionsItem>
            </NDescriptions>

            <!-- Usage history chart -->
            <div class="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div class="flex items-center justify-between mb-4">
                <h4 class="font-medium text-sm">流量使用历史</h4>
                <NRadioGroup v-model:value="historyPrecision" size="small">
                  <NRadioButton value="hour">时</NRadioButton>
                  <NRadioButton value="day">日</NRadioButton>
                  <NRadioButton value="week">周</NRadioButton>
                </NRadioGroup>
              </div>

              <NSpin :show="historyLoading">
                <div v-if="historyData.length === 0" class="text-center text-sm text-slate-400 py-10">暂无历史数据</div>
                <div v-else class="flex items-end justify-between gap-1 h-[180px] px-2">
                  <div
                    v-for="(item, idx) in historyData"
                    :key="idx"
                    class="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      class="w-full bg-blue-500/80 rounded-t-sm min-h-[4px]"
                      :style="{ height: `${Math.max(4, ((item.used ?? item.avgUsed ?? 0) / Math.max(1, ...historyData.map(x => x.used ?? x.avgUsed ?? 0))) * 140)}px` }"
                    />
                    <div class="text-[10px] text-slate-500 truncate w-full text-center">{{ item.label.slice(-5) }}</div>
                  </div>
                </div>
              </NSpin>

              <!-- Raw JSON data -->
              <template v-if="selectedCard?.rawJson">
                <div class="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                  <div class="flex items-center justify-between mb-3">
                    <h4 class="font-medium text-sm">原始数据</h4>
                    <span class="text-xs text-slate-400">同步于 {{ selectedCard.syncedAt ? new Date(selectedCard.syncedAt).toLocaleString() : '-' }}</span>
                  </div>
                  <div class="bg-slate-800 rounded-lg p-3 overflow-auto max-h-72">
                    <pre class="text-xs text-green-400 whitespace-pre-wrap break-all">{{ JSON.stringify(selectedCard.rawJson, null, 2) }}</pre>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </NSpin>
      </NDrawerContent>
    </NDrawer>

    <!-- Batch Query Modal -->
    <NModal v-model:show="batchVisible" preset="card" title="批量查询卡片" style="width: 600px">
      <NAlert v-if="batchError" type="error" class="mb-4">{{ batchError }}</NAlert>
      <NInput
        v-model:value="batchText"
        type="textarea"
        placeholder="输入卡号，每行一个或逗号分隔（最多1000个）"
        :rows="6"
        class="mb-4"
      />
      <div class="flex justify-end gap-2">
        <NButton @click="batchVisible = false">取消</NButton>
        <NButton type="primary" :loading="batchLoading" @click="handleBatchQuery">查询</NButton>
      </div>
      <NSpin v-if="batchLoading" class="mt-4" />
      <NDataTable
        v-if="!batchLoading && batchResults.length > 0"
        :columns="tableColumns"
        :data="batchResults"
        class="mt-4 rounded-xl overflow-hidden"
        size="small"
        :pagination="false"
      />
    </NModal>
  </div>
</template>
