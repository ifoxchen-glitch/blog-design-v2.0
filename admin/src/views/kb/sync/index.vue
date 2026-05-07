<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import {
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NTag,
  NSpin,
  NEmpty,
  useMessage,
} from 'naive-ui'
import {
  RefreshOutline,
  CloudUploadOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import {
  apiGetSyncConfig,
  apiUpdateSyncConfig,
  apiTriggerSyncImport,
  apiGetSyncStatus,
  apiListSyncLogs,
  type SyncConfig,
  type SyncStatus,
  type SyncLogEntry,
} from '../../../api/kb'
import { usePermissionStore } from '../../../stores/permission'

const message = useMessage()
const permissionStore = usePermissionStore()
const hasSyncPerm = computed(() => permissionStore.hasPermission('kb:sync'))

const loading = ref(false)
const syncing = ref(false)
const saving = ref(false)

const config = ref<SyncConfig>({
  vault_path: '',
  auto_sync_enabled: false,
  sync_interval_minutes: 30,
  conflict_strategy: 'last_write_wins',
  last_sync_at: null,
})

const status = ref<SyncStatus>({
  running: false,
  last_sync_at: null,
  last_result: null,
})

const logs = ref<SyncLogEntry[]>([])
const logsLoading = ref(false)
const logsTotal = ref(0)
const logsPage = ref(1)
const logsPageSize = ref(20)
const logsFilter = ref<{ direction?: string; status?: string }>({})

const STRATEGY_OPTIONS = [
  { label: '最后写入覆盖 (last_write_wins)', value: 'last_write_wins' },
  { label: '保留两者 (keep_both)', value: 'keep_both' },
  { label: '跳过冲突 (skip)', value: 'skip' },
]

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '成功', value: 'success' },
  { label: '跳过', value: 'skipped' },
  { label: '冲突', value: 'conflict' },
  { label: '错误', value: 'error' },
]

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiGetSyncConfig()
    if (!config.value) {
      config.value = { vault_path: '', auto_sync_enabled: false, sync_interval_minutes: 30, conflict_strategy: 'last_write_wins', last_sync_at: null }
    }
  } catch {
    /* ignore */
  } finally {
    loading.value = false
  }
}

async function loadStatus() {
  try {
    status.value = await apiGetSyncStatus()
  } catch {
    /* ignore */
  }
}

async function loadLogs() {
  logsLoading.value = true
  try {
    const res = await apiListSyncLogs({
      page: logsPage.value,
      pageSize: logsPageSize.value,
      ...logsFilter.value,
    })
    logs.value = res.items
    logsTotal.value = res.total
  } catch {
    /* ignore */
  } finally {
    logsLoading.value = false
  }
}

async function handleSaveConfig() {
  saving.value = true
  try {
    await apiUpdateSyncConfig({
      vault_path: config.value.vault_path,
      auto_sync_enabled: config.value.auto_sync_enabled,
      sync_interval_minutes: config.value.sync_interval_minutes,
      conflict_strategy: config.value.conflict_strategy,
    })
    message.success('配置已保存')
  } catch {
    message.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function handleSyncNow() {
  syncing.value = true
  try {
    const res = await apiTriggerSyncImport()
    if ((res as unknown as { status: string }).status) {
      message.info('同步已启动，请稍后刷新查看结果')
    }
  } catch {
    message.error('启动同步失败')
  } finally {
    syncing.value = false
  }
}

function handleRefreshAll() {
  loadConfig()
  loadStatus()
  loadLogs()
}

function handleLogPageChange(page: number) {
  logsPage.value = page
  loadLogs()
}

function handleLogFilterChange() {
  logsPage.value = 1
  loadLogs()
}

onMounted(() => {
  loadConfig()
  loadStatus()
  loadLogs()
})
</script>

<template>
  <div>
    <PageHeader title="Obsidian 同步" subtitle="配置仓库路径与同步策略">
      <NButton quaternary @click="handleRefreshAll">
        <template #icon><RefreshOutline class="w-4 h-4" /></template>
        刷新
      </NButton>
    </PageHeader>

    <NSpin :show="loading">
      <!-- 同步配置 -->
      <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 mb-6">
        <h3 class="font-medium mb-4">同步配置</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-w-2xl">
          <div>
            <label class="text-xs text-base-content/50 block mb-1.5">仓库路径 (Vault Path)</label>
            <NInput
              v-model:value="config.vault_path"
              placeholder="/path/to/obsidian/vault"
              size="small"
              :disabled="!hasSyncPerm"
            />
            <span class="text-[10px] text-base-content/30 mt-0.5 block">容器内路径或挂载卷路径</span>
          </div>
          <div>
            <label class="text-xs text-base-content/50 block mb-1.5">冲突策略</label>
            <NSelect
              v-model:value="config.conflict_strategy"
              :options="STRATEGY_OPTIONS"
              size="small"
              :disabled="!hasSyncPerm"
            />
          </div>
          <div class="flex items-center gap-4">
            <div>
              <label class="text-xs text-base-content/50 block mb-1.5">自动同步</label>
              <NSwitch
                :value="config.auto_sync_enabled"
                :disabled="!hasSyncPerm"
                @update:value="(val: boolean) => config.auto_sync_enabled = val"
              />
            </div>
            <div>
              <label class="text-xs text-base-content/50 block mb-1.5">同步间隔 (分钟)</label>
              <NInputNumber
                :value="config.sync_interval_minutes"
                :min="5"
                :max="1440"
                size="small"
                style="width: 100px"
                :disabled="!hasSyncPerm"
                @update:value="(val: number | null) => { if (val !== null) config.sync_interval_minutes = val }"
              />
            </div>
          </div>
        </div>
        <div class="mt-4">
          <NButton
            type="primary"
            size="small"
            :loading="saving"
            :disabled="!hasSyncPerm"
            @click="handleSaveConfig"
          >
            保存配置
          </NButton>
        </div>
      </div>

      <!-- 同步状态 -->
      <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 mb-6">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-medium">同步状态</h3>
          <NButton
            type="primary"
            size="small"
            :loading="syncing"
            :disabled="!hasSyncPerm"
            @click="handleSyncNow"
          >
            <template #icon><CloudUploadOutline class="w-4 h-4" /></template>
            立即导入
          </NButton>
        </div>
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <div class="text-base-content/60">
            上次同步: <span class="font-medium text-base-content">{{ status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : '从未' }}</span>
          </div>
          <NTag :type="status.running ? 'warning' : 'success'" size="small">
            {{ status.running ? '同步中...' : '空闲' }}
          </NTag>
        </div>
        <div v-if="status.last_result" class="mt-3 flex flex-wrap gap-4 text-xs">
          <span class="text-green-600">导入 {{ status.last_result.imported }}</span>
          <span class="text-base-content/40">跳过 {{ status.last_result.skipped }}</span>
          <span class="text-amber-600">冲突 {{ status.last_result.conflicted }}</span>
          <span class="text-red-500">错误 {{ status.last_result.errors }}</span>
        </div>
      </div>

      <!-- 同步日志 -->
      <div class="bg-base-100 rounded-xl border border-base-content/5 p-5">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-medium">同步日志</h3>
          <div class="flex items-center gap-2">
            <NSelect
              v-model:value="logsFilter.status"
              :options="STATUS_OPTIONS"
              size="tiny"
              style="width: 100px"
              placeholder="状态"
              clearable
              @update:value="handleLogFilterChange"
            />
          </div>
        </div>

        <NSpin :show="logsLoading">
          <NEmpty v-if="logs.length === 0 && !logsLoading" description="暂无同步日志" class="py-8" />
          <div v-else class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-left text-base-content/40 border-b border-base-content/5">
                  <th class="py-2 pr-4 font-normal">时间</th>
                  <th class="py-2 pr-4 font-normal">方向</th>
                  <th class="py-2 pr-4 font-normal">文件</th>
                  <th class="py-2 pr-4 font-normal">状态</th>
                  <th class="py-2 pr-4 font-normal">详情</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="log in logs"
                  :key="log.id"
                  class="border-b border-base-content/5 hover:bg-base-200/30"
                >
                  <td class="py-2 pr-4 text-base-content/40 whitespace-nowrap">
                    {{ new Date(log.created_at).toLocaleString() }}
                  </td>
                  <td class="py-2 pr-4">
                    <NTag :type="log.direction === 'import' ? 'info' : 'success'" size="tiny">
                      {{ log.direction === 'import' ? '导入' : '导出' }}
                    </NTag>
                  </td>
                  <td class="py-2 pr-4 text-base-content/60 max-w-48 truncate">
                    {{ log.file_path || '-' }}
                  </td>
                  <td class="py-2 pr-4">
                    <NTag
                      :type="log.status === 'success' ? 'success' : log.status === 'skipped' ? 'default' : log.status === 'conflict' ? 'warning' : 'error'"
                      size="tiny"
                    >
                      {{ log.status === 'success' ? '成功' : log.status === 'skipped' ? '跳过' : log.status === 'conflict' ? '冲突' : '错误' }}
                    </NTag>
                  </td>
                  <td class="py-2 pr-4 text-base-content/40 max-w-40 truncate">
                    {{ log.detail || '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="logsTotal > logsPageSize" class="mt-4 flex items-center justify-between text-xs text-base-content/40">
            <span>共 {{ logsTotal }} 条</span>
            <div class="flex items-center gap-2">
              <NButton
                size="tiny"
                quaternary
                :disabled="logsPage <= 1"
                @click="handleLogPageChange(logsPage - 1)"
              >
                上一页
              </NButton>
              <span>{{ logsPage }} / {{ Math.ceil(logsTotal / logsPageSize) }}</span>
              <NButton
                size="tiny"
                quaternary
                :disabled="logsPage >= Math.ceil(logsTotal / logsPageSize)"
                @click="handleLogPageChange(logsPage + 1)"
              >
                下一页
              </NButton>
            </div>
          </div>
        </NSpin>
      </div>
    </NSpin>
  </div>
</template>
