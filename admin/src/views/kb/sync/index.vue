<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed, nextTick } from 'vue'
import {
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NTag,
  NSpin,
  NEmpty,
  NCollapse,
  NCollapseItem,
  useMessage,
} from 'naive-ui'
import {
  RefreshOutline,
  CloudUploadOutline,
  CloudOutline,
  StopOutline,
  TerminalOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import {
  apiGetSyncConfig,
  apiUpdateSyncConfig,
  apiTriggerSyncImport,
  apiTriggerCouchDBSyncImport,
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
const couchdbSyncing = ref(false)
const saving = ref(false)

const config = ref<SyncConfig>({
  vault_path: '',
  auto_sync_enabled: false,
  sync_interval_minutes: 30,
  conflict_strategy: 'last_write_wins',
  last_sync_at: null,
  couchdb_enabled: false,
  couchdb_url: '',
  couchdb_db_name: '',
  couchdb_username: '',
  couchdb_password: '',
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

// ---- live log polling ----
const liveLogs = ref<SyncLogEntry[]>([])
const livePolling = ref(false)
const liveSource = ref<'filesystem' | 'couchdb' | null>(null)
const liveContainer = ref<HTMLElement | null>(null)
let _pollTimer: ReturnType<typeof setInterval> | null = null

function autoScrollLive() {
  nextTick(() => {
    const el = liveContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function startLivePolling(source: 'filesystem' | 'couchdb') {
  stopLivePolling()
  liveLogs.value = []
  livePolling.value = true
  liveSource.value = source
  const since = new Date().toISOString()

  _pollTimer = setInterval(async () => {
    try {
      const s = await apiGetSyncStatus()
      status.value = s
      const res = await apiListSyncLogs({ page: 1, pageSize: 200, since })
      // Filter only import logs for live view, newest first
      const fresh = res.items
        .filter((l) => l.direction === 'import')
        .reverse() // chronological order for terminal feel
      if (fresh.length > liveLogs.value.length) {
        liveLogs.value = fresh
        autoScrollLive()
      }
      if (!s.running) {
        stopLivePolling()
        // Final refresh of the static log table
        loadLogs()
        loadStatus()
        autoScrollLive()
      }
    } catch {
      /* poll error — ignore */
    }
  }, 1500)
}

function stopLivePolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
  livePolling.value = false
  liveSource.value = null
}

onBeforeUnmount(() => stopLivePolling())

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

function statusLabel(s: string) {
  switch (s) {
    case 'success': return '成功'
    case 'skipped': return '跳过'
    case 'conflict': return '冲突'
    case 'error': return '错误'
    default: return s
  }
}

function liveLogClass(s: string) {
  switch (s) {
    case 'success': return 'text-green-400'
    case 'skipped': return 'text-gray-400'
    case 'conflict': return 'text-amber-400'
    case 'error': return 'text-red-400'
    default: return 'text-gray-300'
  }
}

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiGetSyncConfig()
    if (!config.value) {
      config.value = { vault_path: '', auto_sync_enabled: false, sync_interval_minutes: 30, conflict_strategy: 'last_write_wins', last_sync_at: null, couchdb_enabled: false, couchdb_url: '', couchdb_db_name: '', couchdb_username: '', couchdb_password: '' }
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
      couchdb_enabled: config.value.couchdb_enabled,
      couchdb_url: config.value.couchdb_url,
      couchdb_db_name: config.value.couchdb_db_name,
      couchdb_username: config.value.couchdb_username,
      couchdb_password: config.value.couchdb_password,
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
      message.info('同步已启动')
      startLivePolling('filesystem')
    }
  } catch {
    message.error('启动同步失败')
  } finally {
    syncing.value = false
  }
}

async function handleCouchDBSyncNow() {
  couchdbSyncing.value = true
  try {
    const res = await apiTriggerCouchDBSyncImport()
    if ((res as unknown as { status: string }).status) {
      message.info('CouchDB 同步已启动')
      startLivePolling('couchdb')
    }
  } catch {
    message.error('启动 CouchDB 同步失败')
  } finally {
    couchdbSyncing.value = false
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

        <NCollapse :default-expanded-names="['filesystem']">
          <!-- 文件系统同步 -->
          <NCollapseItem name="filesystem" title="文件系统 (Obsidian Vault)">
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
            </div>
          </NCollapseItem>

          <!-- CouchDB (LiveSync) 同步 -->
          <NCollapseItem name="couchdb" title="CouchDB (Obsidian LiveSync)">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 max-w-2xl">
              <div class="md:col-span-2 flex items-center gap-3">
                <label class="text-xs text-base-content/50">启用 CouchDB 同步</label>
                <NSwitch
                  :value="config.couchdb_enabled"
                  :disabled="!hasSyncPerm"
                  @update:value="(val: boolean) => config.couchdb_enabled = val"
                />
              </div>
              <div>
                <label class="text-xs text-base-content/50 block mb-1.5">CouchDB URL</label>
                <NInput
                  v-model:value="config.couchdb_url"
                  placeholder="http://localhost:5984"
                  size="small"
                  :disabled="!hasSyncPerm"
                />
              </div>
              <div>
                <label class="text-xs text-base-content/50 block mb-1.5">数据库名称</label>
                <NInput
                  v-model:value="config.couchdb_db_name"
                  placeholder="obsidian-vault"
                  size="small"
                  :disabled="!hasSyncPerm"
                />
              </div>
              <div>
                <label class="text-xs text-base-content/50 block mb-1.5">用户名 (可选)</label>
                <NInput
                  v-model:value="config.couchdb_username"
                  placeholder="admin"
                  size="small"
                  :disabled="!hasSyncPerm"
                />
              </div>
              <div>
                <label class="text-xs text-base-content/50 block mb-1.5">密码 (可选)</label>
                <NInput
                  v-model:value="config.couchdb_password"
                  type="password"
                  placeholder="CouchDB 密码"
                  size="small"
                  :disabled="!hasSyncPerm"
                />
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>

        <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-4">
          <div>
            <label class="text-xs text-base-content/50 block mb-1.5">冲突策略</label>
            <NSelect
              v-model:value="config.conflict_strategy"
              :options="STRATEGY_OPTIONS"
              size="small"
              style="width: 220px"
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
          <div class="flex items-center gap-2">
            <NButton
              size="small"
              :loading="couchdbSyncing"
              :disabled="!hasSyncPerm || !config.couchdb_enabled"
              @click="handleCouchDBSyncNow"
            >
              <template #icon><CloudOutline class="w-4 h-4" /></template>
              CouchDB 导入
            </NButton>
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

      <!-- 实时同步日志 (Live terminal) -->
      <div v-if="livePolling || liveLogs.length > 0" class="bg-[#0d1117] rounded-xl border border-gray-700 overflow-hidden mb-6">
        <div class="flex items-center justify-between px-4 py-2 bg-gray-800/50 border-b border-gray-700">
          <div class="flex items-center gap-2 text-xs">
            <TerminalOutline class="w-3.5 h-3.5 text-green-400" />
            <span class="text-gray-300 font-medium">
              实时日志
              <span v-if="liveSource === 'couchdb'" class="text-blue-400"> · CouchDB</span>
              <span v-else class="text-purple-400"> · 文件系统</span>
            </span>
            <span v-if="livePolling" class="flex items-center gap-1 text-green-400">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              同步中...
            </span>
            <span v-else class="text-gray-400">已完成</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-gray-500">{{ liveLogs.length }} 条</span>
            <NButton v-if="livePolling" size="tiny" quaternary @click="stopLivePolling">
              <template #icon><StopOutline class="w-3 h-3" /></template>
              停止
            </NButton>
          </div>
        </div>
        <div ref="liveContainer" class="max-h-80 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
          <div
            v-for="(log, i) in liveLogs"
            :key="log.id || i"
            class="flex gap-2 py-0.5"
          >
            <span class="text-gray-500 shrink-0 whitespace-nowrap">{{ new Date(log.created_at).toLocaleTimeString() }}</span>
            <span class="text-gray-600 shrink-0">[{{ statusLabel(log.status) }}]</span>
            <span :class="liveLogClass(log.status)">{{ log.file_path || '-' }}</span>
            <span v-if="log.detail" class="text-gray-500 truncate">{{ log.detail }}</span>
          </div>
          <div v-if="liveLogs.length === 0 && livePolling" class="text-gray-500 italic">
            等待同步开始...
          </div>
        </div>
      </div>
    </NSpin>
  </div>
</template>
