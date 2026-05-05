<script setup lang="ts">
import { h, ref } from 'vue'
import {
  NButton,
  NInput,
  NSelect,
  NTag,
  NSpace,
  NModal,
  NCode,
  type DataTableColumns,
} from 'naive-ui'
import PageHeader from '../../../../components/common/PageHeader.vue'
import DataTable from '../../../../components/common/DataTable.vue'
import { apiGetAuditLogs, type AuditLogItem } from '../../../../api/ops'
import { formatDateTime } from '../../../../utils/format'

interface LogQuery {
  action: string
  resourceType: string
  username: string
  startDate: string
  endDate: string
}

const initialQuery: LogQuery = {
  action: '',
  resourceType: '',
  username: '',
  startDate: '',
  endDate: '',
}

const actionOptions = [
  { label: '全部操作', value: '' },
  { label: 'POST (创建)', value: 'post' },
  { label: 'PUT (更新)', value: 'put' },
  { label: 'DELETE (删除)', value: 'delete' },
  { label: 'PATCH (部分更新)', value: 'patch' },
]

const fetchLogs = async (params: LogQuery & { page: number; pageSize: number }) => {
  const res = await apiGetAuditLogs({
    page: params.page,
    pageSize: params.pageSize,
    action: params.action || undefined,
    resourceType: params.resourceType || undefined,
    username: params.username || undefined,
    startDate: params.startDate || undefined,
    endDate: params.endDate || undefined,
  })
  return { list: res.items, total: res.total }
}

// Detail modal
const detailModal = ref({
  show: false,
  row: null as AuditLogItem | null,
})

function openDetail(row: AuditLogItem) {
  detailModal.value.row = row
  detailModal.value.show = true
}

function closeDetail() {
  detailModal.value.show = false
  detailModal.value.row = null
}

const columns: DataTableColumns<AuditLogItem> = [
  { title: 'ID', key: 'id', width: 70 },
  {
    title: '时间',
    key: 'createdAt',
    width: 170,
    render(row: AuditLogItem) {
      return formatDateTime(row.createdAt)
    },
  },
  {
    title: '用户',
    key: 'username',
    width: 120,
    render(row: AuditLogItem) {
      return h('span', null, row.username ?? '—')
    },
  },
  {
    title: '操作',
    key: 'action',
    width: 90,
    render(row: AuditLogItem) {
      const typeMap: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
        post: 'success',
        put: 'warning',
        delete: 'error',
        patch: 'info',
      }
      return h(
        NTag,
        { size: 'small', type: typeMap[row.action] ?? 'default' },
        { default: () => row.action.toUpperCase() },
      )
    },
  },
  {
    title: '资源类型',
    key: 'resourceType',
    width: 120,
  },
  {
    title: '资源ID',
    key: 'resourceId',
    width: 90,
    render(row: AuditLogItem) {
      return h('span', null, row.resourceId ?? '—')
    },
  },
  {
    title: '状态码',
    key: 'status',
    width: 80,
    render(row: AuditLogItem) {
      const status = row.detail?.status ?? 0
      const type = status >= 200 && status < 300 ? 'success' : status >= 400 ? 'error' : 'default'
      return h(NTag, { size: 'small', type }, { default: () => String(status) })
    },
  },
  {
    title: '耗时',
    key: 'duration',
    width: 90,
    render(row: AuditLogItem) {
      const ms = row.detail?.durationMs ?? 0
      return h('span', null, `${ms}ms`)
    },
  },
  {
    title: 'IP',
    key: 'ip',
    width: 120,
    render(row: AuditLogItem) {
      return h('span', null, row.ip ?? '—')
    },
  },
  {
    title: '详情',
    key: 'detail',
    width: 80,
    render(row: AuditLogItem) {
      if (!row.detail) return h('span', { style: 'color: #999' }, '—')
      return h(
        NButton,
        { size: 'small', quaternary: true, onClick: () => openDetail(row) },
        { default: () => '查看' },
      )
    },
  },
]
</script>

<template>
  <div>
    <PageHeader title="审计日志" subtitle="查看所有后台操作记录（仅超管可用）" />

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchLogs"
      :initial-query="initialQuery"
      :row-key="(row: AuditLogItem) => row.id"
    >
      <template #search="{ query }">
        <NSpace :size="8" style="width: 100%">
          <NInput
            v-model:value="(query as LogQuery).username"
            placeholder="搜索用户名"
            clearable
            style="width: 160px"
          />
          <NSelect
            v-model:value="(query as LogQuery).action"
            :options="actionOptions"
            placeholder="操作类型"
            clearable
            style="width: 140px"
          />
          <NInput
            v-model:value="(query as LogQuery).resourceType"
            placeholder="资源类型"
            clearable
            style="width: 140px"
          />
          <NInput
            v-model:value="(query as LogQuery).startDate"
            placeholder="开始日期 (YYYY-MM-DD)"
            clearable
            style="width: 180px"
          />
          <NInput
            v-model:value="(query as LogQuery).endDate"
            placeholder="结束日期 (YYYY-MM-DD)"
            clearable
            style="width: 180px"
          />
        </NSpace>
      </template>
    </DataTable>

    <NModal
      v-model:show="detailModal.show"
      preset="card"
      title="请求详情"
      style="width: 560px"
      :bordered="false"
      @close="closeDetail"
    >
      <NSpace v-if="detailModal.row" vertical size="medium">
        <div>
          <strong>Query:</strong>
          <NCode
            :code="JSON.stringify(detailModal.row.detail?.query ?? {}, null, 2)"
            language="json"
          />
        </div>
        <div v-if="detailModal.row.detail?.body">
          <strong>Body:</strong>
          <NCode
            :code="JSON.stringify(detailModal.row.detail.body, null, 2)"
            language="json"
          />
        </div>
        <div>
          <strong>User Agent:</strong> {{ detailModal.row.userAgent ?? '—' }}
        </div>
      </NSpace>
    </NModal>
  </div>
</template>
