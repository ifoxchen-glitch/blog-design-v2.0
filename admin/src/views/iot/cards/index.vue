<script setup lang="ts">
import { computed, h, ref } from 'vue'
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
  useMessage,
} from 'naive-ui'
import {
  SearchOutline,
  RefreshOutline,
  CloudUploadOutline,
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

// Enable / Disable
async function handleEnable(row: CardItem) {
  try {
    await apiEnableCard(row.cardNo)
    message.success('卡已启用')
    table.refresh()
  } catch (e: unknown) {
    message.error(extractError(e, '启用失败'))
  }
}

async function handleDisable(row: CardItem) {
  try {
    await apiDisableCard(row.cardNo)
    message.success('卡已禁用')
    table.refresh()
  } catch (e: unknown) {
    message.error(extractError(e, '禁用失败'))
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

// Table columns
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
    title: '运营商',
    key: 'operator',
    width: 80,
    render(row: CardItem) {
      return operatorLabel(row.operator)
    },
  },
  {
    title: '状态',
    key: 'gprsState',
    width: 90,
    render(row: CardItem) {
      return gprsStateTag(row.gprsState)
    },
  },
  {
    title: '套餐',
    key: 'comboName',
    width: 140,
    ellipsis: { tooltip: true },
  },
  {
    title: '剩余(MB)',
    key: 'comboResidue',
    width: 100,
    render(row: CardItem) {
      const v = row.comboResidue
      if (v === null || v === undefined) return '-'
      if (v >= 1024) return (v / 1024).toFixed(1) + ' GB'
      return v.toFixed(0) + ' MB'
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    render(row: CardItem) {
      return h('div', { class: 'flex items-center gap-1' }, [
        h(
          NButton,
          { size: 'tiny', quaternary: true, onClick: () => handleView(row) },
          () => '查看',
        ),
        h(
          NPopconfirm,
          { 'onPositive-click': () => handleEnable(row) },
          {
            trigger: () => permissionStore.hasPermission('iot:card:enable')
              ? h(NButton, { size: 'tiny', quaternary: true, type: 'success', title: '启用' }, () => '启用')
              : null,
            default: () => '确认启用该卡?',
          },
        ),
        h(
          NPopconfirm,
          { 'onPositive-click': () => handleDisable(row) },
          {
            trigger: () => permissionStore.hasPermission('iot:card:disable')
              ? h(NButton, { size: 'tiny', quaternary: true, type: 'error', title: '禁用' }, () => '禁用')
              : null,
            default: () => '确认禁用该卡?',
          },
        ),
      ])
    },
  },
])

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
    </div>

    <!-- Table -->
    <NSpin :show="table.loading.value">
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
      />
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