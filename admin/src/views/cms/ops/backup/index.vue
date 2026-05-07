<script setup lang="ts">
import { h, ref, onMounted } from 'vue'
import {
  NButton,
  NTag,
  NSpace,
  NSelect,
  NPopconfirm,
  NIcon,
  NForm,
  NFormItem,
  NInput,
  NSwitch,
  NInputNumber,
  NModal,
  NUpload,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import {
  CloudUploadOutline,
  DownloadOutline,
  TrashOutline,
  RefreshOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../../components/common/PageHeader.vue'
import DataTable from '../../../../components/common/DataTable.vue'
import {
  apiGetBackups,
  apiCreateBackup,
  apiDeleteBackup,
  apiDownloadBackup,
  apiRestoreBackup,
  apiImportBackup,
  apiGetBackupSchedule,
  apiSetBackupSchedule,
  type BackupItem,
} from '../../../../api/ops'
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

async function handleDownload(row: BackupItem) {
  try {
    const blob = await apiDownloadBackup(row.id)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = row.filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.URL.revokeObjectURL(url)
    message.success('下载开始')
  } catch (e: any) {
    message.error(e?.response?.data?.message || '下载失败')
  }
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

async function handleRestore(row: BackupItem) {
  try {
    const result = await apiRestoreBackup(row.id)
    message.success('还原完成，请尽快重启服务')
    console.log('[restore] snapshot:', result.snapshotId, 'from:', result.restoredFrom)
    tableRef.value?.refresh()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '还原失败')
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
    width: 90,
    render(row: BackupItem) {
      const map: Record<string, string> = { manual: '手动', scheduled: '自动' }
      return h(NTag, { size: 'small' }, { default: () => map[row.type] ?? row.type })
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
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
      return h('div', { class: 'action-cell' }, [
        h(NSpace, { size: 2 }, {
          default: () => [
            h(
              NButton,
              { size: 'tiny', quaternary: true, title: '下载', onClick: () => handleDownload(row) },
              { icon: () => h(DownloadOutline, { style: 'width:14px;height:14px' }) },
            ),
            h(
              NPopconfirm,
              { onPositiveClick: () => handleRestore(row) },
              {
                trigger: () => h(
                  NButton,
                  { size: 'tiny', quaternary: true, title: '还原', type: 'warning' },
                  { icon: () => h(RefreshOutline, { style: 'width:14px;height:14px' }) },
                ),
                default: () => '确定从该备份还原？还原前会自动快照，还原后建议重启服务。',
              },
            ),
            h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row) },
              {
                trigger: () => h(
                  NButton,
                  { size: 'tiny', quaternary: true, type: 'error', title: '删除' },
                  { icon: () => h(TrashOutline, { style: 'width:14px;height:14px' }) },
                ),
                default: () => '确定删除该备份？文件将永久丢失。',
              },
            ),
          ],
        }),
      ])
    },
  },
]

// ---- Schedule config ----
const showScheduleModal = ref(false)
const scheduleLoading = ref(false)
const scheduleForm = ref<{
  name: string
  cron: string
  enabled: boolean
  timezone: string
  keepCount: number
}>({
  name: '每日自动备份',
  cron: '0 2 * * *',
  enabled: true,
  timezone: 'Asia/Shanghai',
  keepCount: 30,
})

async function loadSchedule() {
  try {
    const data = await apiGetBackupSchedule()
    if (data) {
      scheduleForm.value = {
        name: data.name,
        cron: data.cron,
        enabled: Boolean(data.enabled),
        timezone: data.timezone,
        keepCount: data.keepCount,
      }
    }
  } catch { /* ignore */ }
}

async function saveSchedule() {
  scheduleLoading.value = true
  try {
    await apiSetBackupSchedule({
      name: scheduleForm.value.name,
      cron: scheduleForm.value.cron,
      enabled: scheduleForm.value.enabled,
      timezone: scheduleForm.value.timezone,
      keepCount: scheduleForm.value.keepCount,
    })
    message.success('定时备份配置已保存')
    showScheduleModal.value = false
  } catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    scheduleLoading.value = false
  }
}

// ---- Import ----
const showImportModal = ref(false)
const importLoading = ref(false)
const importFileList = ref<any[]>([])

async function handleImport() {
  if (!importFileList.value.length) {
    message.warning('请选择文件')
    return
  }
  const file = importFileList.value[0]?.file
  if (!file) {
    message.warning('文件读取失败')
    return
  }
  importLoading.value = true
  try {
    await apiImportBackup(file, '手动导入')
    message.success('导入成功')
    showImportModal.value = false
    importFileList.value = []
    tableRef.value?.refresh()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '导入失败')
  } finally {
    importLoading.value = false
  }
}

onMounted(() => {
  loadSchedule()
})
</script>

<template>
  <div>
    <PageHeader title="备份管理" subtitle="手动触发或管理 SQLite 数据库备份">
      <template #extra>
        <NSpace>
          <NButton @click="showImportModal = true">
            <template #icon>
              <NIcon><CloudUploadOutline /></NIcon>
            </template>
            导入备份
          </NButton>
          <NButton @click="showScheduleModal = true">
            <template #icon>
              <NIcon><TimeOutline /></NIcon>
            </template>
            定时备份
          </NButton>
          <NButton type="primary" :loading="creating" @click="handleBackup">
            <template #icon>
              <NIcon><CloudUploadOutline /></NIcon>
            </template>
            立即备份
          </NButton>
        </NSpace>
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

    <!-- Schedule Modal -->
    <NModal
      v-model:show="showScheduleModal"
      title="定时备份配置"
      preset="card"
      style="width: 480px"
    >
      <NForm label-placement="left" label-width="100">
        <NFormItem label="名称">
          <NInput v-model:value="scheduleForm.name" placeholder="默认定时备份" />
        </NFormItem>
        <NFormItem label="Cron 表达式">
          <NInput v-model:value="scheduleForm.cron" placeholder="0 2 * * *" />
        </NFormItem>
        <NFormItem label="启用">
          <NSwitch v-model:value="scheduleForm.enabled" />
        </NFormItem>
        <NFormItem label="时区">
          <NInput v-model:value="scheduleForm.timezone" placeholder="Asia/Shanghai" />
        </NFormItem>
        <NFormItem label="保留数量">
          <NInputNumber v-model:value="scheduleForm.keepCount" :min="1" :max="365" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showScheduleModal = false">取消</NButton>
          <NButton type="primary" :loading="scheduleLoading" @click="saveSchedule">保存</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- Import Modal -->
    <NModal
      v-model:show="showImportModal"
      title="导入备份文件"
      preset="card"
      style="width: 480px"
    >
      <NUpload
        v-model:file-list="importFileList"
        :max="1"
        accept=".sqlite,.db"
      >
        <NButton>选择 .sqlite 文件</NButton>
      </NUpload>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showImportModal = false">取消</NButton>
          <NButton type="primary" :loading="importLoading" @click="handleImport">导入</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
