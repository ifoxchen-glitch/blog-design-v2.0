<script setup lang="ts">
import { computed, h, ref } from 'vue'
import axios from 'axios'
import {
  NButton,
  NInput,
  NSelect,
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
import {
  apiGetCards,
  apiGetCard,
  apiSyncCards,
  apiBatchCards,
  apiGetBalance,
  apiDisableCard,
  apiEnableCard,
  type CardItem,
} from '../../../api/iot'
import { usePermissionStore } from '../../../stores/permission'
import { useTable } from '../../../composables/useTable'

const message = useMessage()
const permissionStore = usePermissionStore()

interface CardQuery {
  keyword: string
  status: string
  operator: string
}

const initialQuery: CardQuery = { keyword: '', status: '', operator: '' }

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

// Sync
const syncLoading = ref(false)
async function handleSync() {
  syncLoading.value = true
  try {
    const res = await apiSyncCards()
    message.success(`同步成功，共 ${res.cardCount} 张卡`)
    table.refresh()
    loadBalance()
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

async function handleView(row: CardItem) {
  detailLoading.value = true
  detailVisible.value = true
  selectedCard.value = null
  try {
    const res = await apiGetCard(row.cardNo)
    selectedCard.value = res
  } catch {
    // Use row data as fallback
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
  } catch (e: unknown) {
    message.error(extractError(e, nextEnabled ? '启用失败' : '禁用失败'))
  } finally {
    toggleLoadingMap.value[row.cardNo] = false
  }
}

// Status tag helper
function gprsStateTag(state: string) {
  const map: Record<string, { label: string; type: string }> = {
    '1': { label: '在线', type: 'success' },
    '2': { label: '离线', type: 'default' },
    '3': { label: '停机', type: 'error' },
    '4': { label: '机卡分离', type: 'warning' },
  }
  const t = map[state] || { label: state || '未知', type: 'default' }
  return h(NTag, { size: 'small', type: t.type as any }, () => t.label)
}

function operatorLabel(op: string) {
  const map: Record<string, string> = { '1': '联通', '2': '移动', '3': '电信' }
  return map[op] || op || '-'
}

// Table columns (list view — show all key fields)
const tableColumns = computed(() => [
  {
    title: '卡号',
    key: 'cardNo',
    width: 160,
    ellipsis: { tooltip: true },
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
    title: '运营商',
    key: 'operator',
    width: 70,
    render(row: CardItem) {
      return operatorLabel(row.operator)
    },
  },
  {
    title: '状态',
    key: 'gprsState',
    width: 80,
    render(row: CardItem) {
      return gprsStateTag(row.gprsState)
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
    key: 'usage',
    width: 120,
    render(row: CardItem) {
      const used = row.comboUsed
      const total = row.comboTotal
      if (used == null || total == null) return '-'
      return `${used.toFixed(0)} / ${total >= 1024 ? (total / 1024).toFixed(1) + 'G' : total.toFixed(0) + 'M'}`
    },
  },
  {
    title: '剩余',
    key: 'comboResidue',
    width: 90,
    render(row: CardItem) {
      const v = row.comboResidue
      if (v === null || v === undefined) return '-'
      if (v >= 1024) return (v / 1024).toFixed(1) + 'G'
      return v.toFixed(0) + 'M'
    },
  },
  {
    title: '激活状态',
    key: 'activatedState',
    width: 90,
    render(row: CardItem) {
      const map: Record<string, string> = { '1': '测试期', '2': '库存期', '3': '已激活' }
      return map[row.activatedState] || '-'
    },
  },
  {
    title: '到期时间',
    key: 'endTime',
    width: 110,
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
    width: 60,
    fixed: 'right',
    render(row: CardItem) {
      return h(NButton, { size: 'tiny', quaternary: true, onClick: () => handleView(row) }, () => '查看')
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
        style="width: 130px"
      />
      <NSelect
        v-model:value="table.query.operator"
        :options="OPERATOR_OPTIONS"
        placeholder="运营商"
        clearable
        style="width: 130px"
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
              :type="(card.gprsState === '1' ? 'success' : card.gprsState === '2' ? 'default' : card.gprsState === '3' ? 'error' : 'warning') as any"
            >
              {{ { '1': '在线', '2': '离线', '3': '停机', '4': '机卡分离' }[card.gprsState] || '未知' }}
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
            <div><span class="text-slate-400">运营商: </span>{{ operatorLabel(card.operator) }}</div>
            <div><span class="text-slate-400">激活: </span>{{ { '1': '测试期', '2': '库存期', '3': '已激活' }[card.activatedState] || '-' }}</div>
            <div><span class="text-slate-400">用量: </span>{{ card.comboUsed != null ? card.comboUsed.toFixed(0) + 'M' : '-' }} / {{ card.comboTotal != null ? (card.comboTotal >= 1024 ? (card.comboTotal/1024).toFixed(1) + 'G' : card.comboTotal.toFixed(0) + 'M') : '-' }}</div>
            <div><span class="text-slate-400">剩余: </span><span :class="(card.comboResidue ?? 0) < 100 ? 'text-red-500 font-medium' : ''">{{ card.comboResidue != null ? (card.comboResidue >= 1024 ? (card.comboResidue/1024).toFixed(1) + 'G' : card.comboResidue.toFixed(0) + 'M') : '-' }}</span></div>
            <div class="col-span-2"><span class="text-slate-400">套餐: </span>{{ card.comboName || '-' }}</div>
            <div><span class="text-slate-400">位置: </span>{{ card.realPosition || '-' }}</div>
            <div><span class="text-slate-400">到期: </span>{{ card.endTime || '-' }}</div>
          </div>

          <div class="flex justify-end">
            <NButton size="tiny" quaternary @click="handleView(card)">查看详情</NButton>
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

    <!-- Detail Drawer -->
    <NDrawer v-model:show="detailVisible" :width="420" placement="right">
      <NDrawerContent title="卡片详情" closable>
        <NSpin :show="detailLoading">
          <NDescriptions v-if="selectedCard" :column="1" label-placement="left" size="large">
            <NDescriptionsItem label="卡号">{{ selectedCard.cardNo }}</NDescriptionsItem>
            <NDescriptionsItem label="MSISDN">{{ selectedCard.msisdn || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="ICCID">{{ selectedCard.iccid || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="IMSI">{{ selectedCard.imsi || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="运营商">{{ operatorLabel(selectedCard.operator) }}</NDescriptionsItem>
            <NDescriptionsItem label="卡形态">{{ selectedCard.cardType || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="套餐">{{ selectedCard.comboName || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="已用">{{ selectedCard.comboUsed != null ? selectedCard.comboUsed + ' MB' : '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="剩余">{{ selectedCard.comboResidue != null ? selectedCard.comboResidue + ' MB' : '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="总量">{{ selectedCard.comboTotal != null ? selectedCard.comboTotal + ' MB' : '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="联网状态">{{ gprsStateTag(selectedCard.gprsState) }}</NDescriptionsItem>
            <NDescriptionsItem label="设备状态">{{ selectedCard.onOffStatus === '1' ? '在线' : selectedCard.onOffStatus === '0' ? '离线' : '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="激活状态">{{ selectedCard.activatedState === '1' ? '测试期' : selectedCard.activatedState === '2' ? '库存期' : selectedCard.activatedState === '3' ? '已激活' : '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="实时位置">{{ selectedCard.realPosition || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="激活时间">{{ selectedCard.activationTime || '-' }}</NDescriptionsItem>
            <NDescriptionsItem label="到期时间">{{ selectedCard.endTime || '-' }}</NDescriptionsItem>
          </NDescriptions>
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