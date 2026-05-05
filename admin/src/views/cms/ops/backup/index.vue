<script setup lang="ts">
import { h, ref } from 'vue'
import {
  NButton,
  NTag,
  NSpace,
  NSelect,
  NPopconfirm,
  NIcon,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { CloudUploadOutline, DownloadOutline, TrashOutline, ArchiveOutline } from '@vicons/ionicons5'
import PageHeader from '../../../../components/common/PageHeader.vue'
import DataTable from '../../../../components/common/DataTable.vue'
import { apiGetBackups, apiCreateBackup, apiDeleteBackup, apiDownloadBackupUrl, type BackupItem } from '../../../../api/ops'
import { formatDateTime } from '../../../../utils/format'
import { formatSize } from '../../../../utils/size'

const message = useMessage()

interface BackupQuery {
  type: string
  status: string
}

const initialQuery: BackupQuery = {
  type: '',
  status: '',
}

const typeOptions = [
  { label: '全部类型', value: '' },
  { label: '手动', value: 'manual' },
  { label: '自动', value: 'scheduled' },
]

const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '正常', value: 'ok' },
  { label: '失败', value: 'failed' },
  { label: '已还原', value: 'restored' },
]

const tableRef = ref<{
  refresh: () => Promise<void>
  reset: () => void
} | null>(null)

const creating = ref(false)

async function handleBackup() {
  creating.value = true
  try {
    await apiCreateBackup('手动触发')
    message.success('备份成功')
    tableRef.value?.refresh()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '备份失败')
  } finally {
    creating.value = false
  }
}

function handleDownload(row: BackupItem) {
  window.open(apiDownloadBackupUrl(row.id), '_blank')
}

async function handleDelete(row: BackupItem) {
  try {
    await apiDeleteBackup(row.id)
    message.success('删除成功')
    tableRef.value?.refresh()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '删除失败')
  }
}

const fetchBackups = async (params: BackupQuery & { page: number; pageSize: number }) => {
  const res = await apiGetBackups({
    page: params.page,
    pageSize: params.pageSize,
    type: params.type || undefined,
    status: params.status || undefined,
  })
  return { list: res.items, total: res.total }
}

const columns: DataTableColumns<BackupItem> = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '文件名', key: 'filename', width: 260 },
  {
    title: '大小',
    key: 'size',
    width: 100,
    render(row: BackupItem) {
      return formatSize(row.size)
    },
  },
  {
    title: '类型',
    key: 'type',
    width: 100,
    render(row: BackupItem) {
      const map: Record<string, string> = { manual: '手动', scheduled: '自动' }
      return map[row.type] ?? row.type
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row: BackupItem) {
      const typeMap: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
        ok: 'success',
        failed: 'error',
        restored: 'warning',
      }
      const labelMap: Record<string, string> = {
        ok: '正常',
        failed: '失败',
        restored: '已还原',
      }
      return h(NTag, { size: 'small', type: typeMap[row.status] ?? 'default' }, { default: () => labelMap[row.status] ?? row.status })
    },
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 170,
    render(row: BackupItem) {
      return formatDateTime(row.createdAt)
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row: BackupItem) {
      return h(NSpace, { size: 4 }, {
        default: () => [
          h(
            NButton,
            { size: 'small', quaternary: true, onClick: () => handleDownload(row) },
            { icon: () => h(NIcon, null, { default: () => h(DownloadOutline) }) },
          ),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              trigger: () => h(
                NButton,
                { size: 'small', quaternary: true, type: 'error' },
                { icon: () => h(NIcon, null, { default: () => h(TrashOutline) }) },
              ),
              default: () => '确定删除该备份？文件将永久丢失。',
            },
          ),
        ],
      })
    },
  },
]
</script>

<template>
  <div>
    <PageHeader title="备份管理" subtitle="手动触发或管理 SQLite 数据库备份">
      <template #extra>
        <NButton type="primary" :loading="creating" @click="handleBackup">
          <template #icon>
            <NIcon><CloudUploadOutline /></NIcon>
          </template>
          立即备份
        </NButton>
      </template>
    </PageHeader>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchBackups"
      :initial-query="initialQuery"
      :row-key="(row: BackupItem) => row.id"
    >
      <template #search="{ query }">
        <NSpace :size="8">
          <NSelect
            v-model:value="(query as BackupQuery).type"
            :options="typeOptions"
            placeholder="类型"
            clearable
            style="width: 140px"
          />
          <NSelect
            v-model:value="(query as BackupQuery).status"
            :options="statusOptions"
            placeholder="状态"
            clearable
            style="width: 140px"
          />
        </NSpace>
      </template>
    </DataTable>
  </div>
</template>
