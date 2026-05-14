<script setup lang="ts">
import { computed, h, ref, watch } from 'vue'
import {
  NButton,
  NInput,
  NDataTable,
  NPagination,
  NTag,
  NSpace,
  NPopconfirm,
  NModal,
  NForm,
  NFormItem,
  NText,
  NAlert,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  SearchOutline,
  RefreshOutline,
  GridOutline,
  ListOutline,
  CloudDownloadOutline,
  PowerOutline,
  ReloadOutline,
  CreateOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetIotCards,
  apiQueryIotCard,
  apiBatchQueryIotCards,
  apiGetIotBalance,
  apiDisableIotCard,
  apiEnableIotCard,
  apiUpdateIotCard,
  apiDeleteIotCard,
  type IotCardItem,
} from '../../../api/iot'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'

const message = useMessage()
const permissionStore = usePermissionStore()

// ---- 视图模式 ----
type ViewMode = 'card' | 'table'
const viewMode = ref<ViewMode>('table')

// ---- 分页 ----
const cardPageInternal = ref(1)

// ---- 搜索 ----
const searchKeyword = ref('')

watch(searchKeyword, () => {
  cardPageInternal.value = 1
})

// ---- 余额 ----
const balance = ref<string | null>(null)
const balanceLoading = ref(false)

async function loadBalance() {
  balanceLoading.value = true
  try {
    const res = await apiGetIotBalance()
    balance.value = res.amount
  } catch {
    balance.value = null
  } finally {
    balanceLoading.value = false
  }
}
loadBalance()

// ---- 数据加载 ----
const cards = ref<IotCardItem[]>([])
const total = ref(0)
const loading = ref(false)
const pageSize = ref(20)
const page = computed({
  get: () => cardPageInternal.value,
  set: (v) => { cardPageInternal.value = v },
})

async function loadCards() {
  loading.value = true
  try {
    const res = await apiGetIotCards({
      page: cardPageInternal.value,
      pageSize: pageSize.value,
      keyword: searchKeyword.value || undefined,
    })
    cards.value = res.items
    total.value = res.total
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}
loadCards()

watch([cardPageInternal.value, pageSize.value, searchKeyword], () => {
  loadCards()
})

function handlePageSizeChange(size: number) {
  pageSize.value = size
  cardPageInternal.value = 1
}

// ---- 彩色卡片调色板 ----
const CARD_COLORS = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400', badge: 'bg-blue-500/15 text-blue-400' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400' },
  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400', badge: 'bg-purple-500/15 text-purple-400' },
  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-400' },
  { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400', badge: 'bg-rose-500/15 text-rose-400' },
]

function getColor(index: number) {
  return CARD_COLORS[index % CARD_COLORS.length]
}

// ---- 状态映射 ----
const STATUS_MAP: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  '0': { label: '未知', type: 'default' },
  '1': { label: '已激活', type: 'success' },
  '2': { label: '待激活', type: 'warning' },
  '3': { label: '停机', type: 'error' },
  '4': { label: '销户', type: 'error' },
  '5': { label: '测试', type: 'info' },
  '6': { label: '库存', type: 'info' },
}

const GPRS_STATE_MAP: Record<string, { label: string; type: 'success' | 'warning' | 'error' | 'info' | 'default' }> = {
  '0': { label: '未知', type: 'default' },
  '1': { label: '在线', type: 'success' },
  '2': { label: '离线', type: 'warning' },
  '3': { label: '停机', type: 'error' },
  '4': { label: '机卡分离', type: 'error' },
}

function getStatusTag(status: string) {
  const s = STATUS_MAP[status] || { label: status || '-', type: 'default' as const }
  return h(NTag, { type: s.type, size: 'small' }, { default: () => s.label })
}

function getGprsTag(gprsState: string) {
  const s = GPRS_STATE_MAP[gprsState] || { label: gprsState || '-', type: 'default' as const }
  return h(NTag, { type: s.type, size: 'small' }, { default: () => s.label })
}

const OPERATOR_MAP: Record<string, string> = {
  '1': '联通',
  '2': '移动',
  '3': '电信',
}

// ---- 表格列 ----
const tableColumns = computed<DataTableColumns<IotCardItem>>(() => [
  { title: 'ICCID', key: 'iccid', width: 180, ellipsis: { tooltip: true } },
  { title: 'MSISDN', key: 'msisdn', width: 120 },
  { title: '运营商', key: 'operator', width: 70, render: (row) => OPERATOR_MAP[row.operator] || '-' },
  { title: '套餐', key: 'comboName', width: 120, ellipsis: { tooltip: true } },
  {
    title: '套餐剩余',
    key: 'comboResidue',
    width: 100,
    render: (row) => row.comboResidue != null ? `${row.comboResidue} MB` : '-',
  },
  { title: '状态', key: 'status', width: 80, render: (row) => getStatusTag(row.status) },
  { title: '联网', key: 'gprsState', width: 80, render: (row) => getGprsTag(row.gprsState) },
  {
    title: '到期时间',
    key: 'endTime',
    width: 160,
    render: (row) => row.endTime ? formatDateTime(row.endTime) : '-',
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render: (row) => h(NSpace, { size: 4 }, { default: () => [
      permissionStore.hasPermission('iot:query')
        ? h(NButton, { size: 'tiny', quaternary: true, onClick: () => handleQueryCard(row.iccid) }, () => h(RefreshOutline, { style: { width: '14px', height: '14px' } }))
        : null,
      permissionStore.hasPermission('iot:manage')
        ? h(NPopconfirm, { onPositiveClick: () => handleToggle(row) }, {
            trigger: () => h(NButton, { size: 'tiny', quaternary: true, type: row.gprsState === '1' ? 'error' : 'success' }, () => row.gprsState === '1' ? h(PowerOutline, { style: { width: '14px', height: '14px' } }) : h(ReloadOutline, { style: { width: '14px', height: '14px' } })),
            default: () => row.gprsState === '1' ? '确认断网该卡?' : '确认恢复该卡?',
          })
        : null,
      permissionStore.hasPermission('iot:manage')
        ? h(NButton, { size: 'tiny', quaternary: true, onClick: () => openEditRemarks(row) }, () => h(CreateOutline, { style: { width: '14px', height: '14px' } }))
        : null,
      permissionStore.hasPermission('iot:manage')
        ? h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
            trigger: () => h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, () => h(TrashOutline, { style: { width: '14px', height: '14px' } })),
            default: () => '确认从本地删除该卡记录?',
          })
        : null,
    ] }),
  },
])

// ---- 单卡查询 ----
const queryModalVisible = ref(false)
const queryCardNo = ref('')
const queryLoading = ref(false)

async function handleQueryCard(cardNo: string) {
  queryCardNo.value = cardNo
  queryModalVisible.value = true
  await doQueryCard(cardNo)
}

async function doQueryCard(cardNo: string) {
  queryLoading.value = true
  try {
    await apiQueryIotCard(cardNo)
    message.success('查询成功')
    loadCards()
    loadBalance()
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '查询失败')
  } finally {
    queryLoading.value = false
  }
}

async function submitQueryCard() {
  if (!queryCardNo.value.trim()) {
    message.warning('请输入卡号')
    return
  }
  await doQueryCard(queryCardNo.value.trim())
}

// ---- 批量查询 ----
const batchModalVisible = ref(false)
const batchCardNos = ref('')
const batchLoading = ref(false)

async function handleBatchQuery() {
  batchLoading.value = true
  try {
    const lines = batchCardNos.value.split('\n').map((s) => s.trim()).filter(Boolean)
    if (!lines.length) {
      message.warning('请输入卡号')
      return
    }
    if (lines.length > 1000) {
      message.warning('单次最多查询 1000 张卡')
      return
    }
    await apiBatchQueryIotCards(lines)
    message.success('批量查询完成')
    batchModalVisible.value = false
    batchCardNos.value = ''
    loadCards()
    loadBalance()
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '批量查询失败')
  } finally {
    batchLoading.value = false
  }
}

// ---- 断网/恢复 ----
async function handleToggle(row: IotCardItem) {
  try {
    if (row.gprsState === '1') {
      await apiDisableIotCard(row.iccid)
      message.success('断网成功')
    } else {
      await apiEnableIotCard(row.iccid)
      message.success('恢复成功')
    }
    loadCards()
    loadBalance()
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

// ---- 编辑备注 ----
const drawerVisible = ref(false)
const editingCard = ref<IotCardItem | null>(null)
const editingRemarks = ref('')
const submitting = ref(false)

function openEditRemarks(row: IotCardItem) {
  editingCard.value = row
  editingRemarks.value = row.remarks || ''
  drawerVisible.value = true
}

async function submitRemarks() {
  if (!editingCard.value) return
  submitting.value = true
  try {
    await apiUpdateIotCard(editingCard.value.id, editingRemarks.value)
    message.success('保存成功')
    drawerVisible.value = false
    loadCards()
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    submitting.value = false
  }
}

// ---- 删除 ----
async function handleDelete(row: IotCardItem) {
  try {
    await apiDeleteIotCard(row.id)
    message.success('删除成功')
    loadCards()
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '删除失败')
  }
}
</script>

<template>
  <div>
    <PageHeader title="物联网卡管理" subtitle="管理物联网卡状态与余额">
      <template #actions>
        <NTag v-if="balance !== null" type="info" size="large">
          账户余额: ¥{{ balance }}
        </NTag>
        <NButton v-permission="'iot:query'" type="primary" @click="batchModalVisible = true">
          <template #icon>
            <CloudDownloadOutline />
          </template>
          批量查询
        </NButton>
        <NButton v-permission="'iot:query'" @click="loadCards">
          <template #icon>
            <RefreshOutline />
          </template>
          刷新
        </NButton>
      </template>
    </PageHeader>

    <!-- 工具栏 -->
    <div class="flex items-center gap-3 mb-4">
      <NInput
        v-model:value="searchKeyword"
        placeholder="搜索 ICCID / MSISDN / IMSI"
        clearable
        style="max-width: 300px"
      >
        <template #prefix>
          <SearchOutline />
        </template>
      </NInput>
      <div class="flex-1" />
      <NSelect
        v-model:value="pageSize"
        :options="[12, 20, 50, 100].map(v => ({ label: String(v), value: v }))"
        size="small"
        style="width: 100px"
        @update:value="handlePageSizeChange"
      />
      <NButton quaternary size="small" @click="viewMode = 'card'">
        <template #icon><GridOutline /></template>
      </NButton>
      <NButton quaternary size="small" @click="viewMode = 'table'">
        <template #icon><ListOutline /></template>
      </NButton>
    </div>

    <!-- 卡片视图 -->
    <div v-if="viewMode === 'card'" class="iot-cards-grid">
      <div
        v-for="(card, idx) in cards"
        :key="card.id"
        :class="['iot-card', getColor(idx).bg, getColor(idx).border, 'border']"
      >
        <div class="flex items-center justify-between mb-2">
          <span :class="['text-sm font-mono', getColor(idx).text]">{{ card.iccid }}</span>
          <div class="flex gap-1">
            <NTag :type="STATUS_MAP[card.status]?.type || 'default'" size="small">
              {{ STATUS_MAP[card.status]?.label || card.status || '-' }}
            </NTag>
          </div>
        </div>
        <div class="text-xs text-gray-400 mb-1">
          {{ OPERATOR_MAP[card.operator] || '-' }} · {{ card.comboName || '-' }}
        </div>
        <div class="text-xs text-gray-500">
          剩余 {{ card.comboResidue }} MB / 共 {{ card.comboTotal }} MB
        </div>
        <div class="flex items-center gap-2 mt-2">
          <NButton size="tiny" @click="handleQueryCard(card.iccid)">刷新</NButton>
          <NPopconfirm @positive-click="handleToggle(card)">
            <template #trigger>
              <NButton size="tiny" :type="card.gprsState === '1' ? 'error' : 'success'">
                {{ card.gprsState === '1' ? '断网' : '恢复' }}
              </NButton>
            </template>
            {{ card.gprsState === '1' ? '确认断网?' : '确认恢复?' }}
          </NPopconfirm>
        </div>
      </div>
    </div>

    <!-- 表格视图 -->
    <div v-else>
      <NDataTable
        :columns="tableColumns"
        :data="cards"
        :loading="loading"
        :pagination="false"
        :scroll-x="900"
        :row-key="(row: IotCardItem) => row.id"
        striped
      />
    </div>

    <!-- 分页 -->
    <div class="flex justify-end mt-4">
      <NPagination
        v-model:page="page"
        :page-size="pageSize"
        :item-count="total"
        :page-sizes="[12, 20, 50, 100]"
        show-size-picker
        @update:page-size="handlePageSizeChange"
      />
    </div>

    <!-- 批量查询弹窗 -->
    <NModal v-model:show="batchModalVisible" preset="card" title="批量查询物联网卡" style="width: 600px">
      <NAlert type="info" class="mb-4">
        每行一个卡号，最多 1000 个。查询结果会同步到本地并更新套餐信息。
      </NAlert>
      <NInput
        v-model:value="batchCardNos"
        type="textarea"
        placeholder="898606xxxxxxxxxxxxx&#10;898606yyyyyyyyyyyyy"
        :rows="8"
        class="mb-4"
      />
      <div class="flex justify-end gap-2">
        <NButton @click="batchModalVisible = false">取消</NButton>
        <NButton type="primary" :loading="batchLoading" @click="handleBatchQuery">开始查询</NButton>
      </div>
    </NModal>

    <!-- 单卡查询弹窗 -->
    <NModal v-model:show="queryModalVisible" preset="card" title="查询物联网卡" style="width: 400px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="卡号">
          <NInput v-model:value="queryCardNo" placeholder="ICCID" />
        </NFormItem>
      </NForm>
      <div class="flex justify-end gap-2">
        <NButton @click="queryModalVisible = false">关闭</NButton>
        <NButton type="primary" :loading="queryLoading" @click="submitQueryCard">查询</NButton>
      </div>
    </NModal>

    <!-- 备注编辑抽屉 -->
    <FormDrawer
      v-model:show="drawerVisible"
      :title="`编辑备注 - ${editingCard?.iccid}`"
      :loading="submitting"
      @submit="submitRemarks"
    >
      <NForm label-placement="left" label-width="80">
        <NFormItem label="ICCID">
          <NText>{{ editingCard?.iccid }}</NText>
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="editingRemarks" type="textarea" :rows="4" placeholder="填写备注信息" />
        </NFormItem>
      </NForm>
    </FormDrawer>
  </div>
</template>

<style scoped>
.iot-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.iot-card {
  border-radius: 12px;
  padding: 16px;
}
</style>