<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import {
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NTag,
  NSpin,
  NEmpty,
  NProgress,
  NDrawer,
  NDrawerContent,
  useMessage,
} from 'naive-ui'
import {
  RefreshOutline,
  CloudUploadOutline,
  DownloadOutline,
  SwapHorizontalOutline,
  SettingsOutline,
  StopOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import SyncFileTree from '../../../components/kb/SyncFileTree.vue'
import {
  apiGetSyncConfig,
  apiUpdateSyncConfig,
  apiTriggerSyncImport,
  apiTriggerSyncExport,
  apiGetSyncStatus,
  apiListSyncLogs,
  apiTestFilesystem,
  apiClearSyncedData,
  apiGetRemoteFiles,
  apiGetSyncedFiles,
  type SyncConfig,
  type SyncStatus,
  type SyncLogEntry,
  type FileTreeData,
  type FileTreeNode,
} from '../../../api/kb'
import { usePermissionStore } from '../../../stores/permission'

const message = useMessage()
const permissionStore = usePermissionStore()
const hasSyncPerm = computed(() => permissionStore.hasPermission('kb:sync'))

// ---- Drawer ----
const configDrawer = ref(false)

// File trees
const remoteTree = ref<FileTreeData>({ source: '', tree: [], fileCount: 0 })
const syncedTree = ref<FileTreeData>({ source: '', tree: [], fileCount: 0 })
const treeLoading = ref(false)
const remoteDiffMap = ref<Record<string, 'new' | 'old' | 'synced'>>({})
const localDiffMap = ref<Record<string, 'new' | 'old' | 'synced'>>({})

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

// ---- live log polling ----
const liveLogs = ref<SyncLogEntry[]>([])
const livePolling = ref(false)
let _pollTimer: ReturnType<typeof setInterval> | null = null

function startLivePolling() {
  stopLivePolling()
  liveLogs.value = []
  livePolling.value = true
  const since = new Date().toISOString()

  _pollTimer = setInterval(async () => {
    try {
      const s = await apiGetSyncStatus()
      status.value = s
      const res = await apiListSyncLogs({ page: 1, pageSize: 200, since })
      const fresh = res.items.reverse()
      if (fresh.length > liveLogs.value.length) {
        liveLogs.value = fresh
      }
      if (!s.running) {
        stopLivePolling()
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
}

onBeforeUnmount(() => stopLivePolling())

// ---- loading states ----
const loading = ref(false)
const syncing = ref(false)
const exporting = ref(false)
const clearing = ref(false)
const saving = ref(false)
const testingConn = ref(false)

const STRATEGY_OPTIONS = [
  { label: '最后写入覆盖', value: 'last_write_wins' },
  { label: '保留两者', value: 'keep_both' },
  { label: '跳过冲突', value: 'skip' },
]

const LOG_STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '成功', value: 'success' },
  { label: '跳过', value: 'skipped' },
  { label: '冲突', value: 'conflict' },
  { label: '错误', value: 'error' },
]

// ---- derived progress ----
const totalResult = computed(() => {
  if (!status.value.last_result) return null
  const r = status.value.last_result
  return {
    imported: r.imported,
    skipped: r.skipped,
    conflicted: r.conflicted,
    errors: r.errors,
    total: r.imported + r.skipped + r.conflicted + r.errors,
  }
})

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiGetSyncConfig()
    if (!config.value) {
      config.value = { vault_path: '', auto_sync_enabled: false, sync_interval_minutes: 30, conflict_strategy: 'last_write_wins', last_sync_at: null }
    }
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

async function loadStatus() {
  try {
    status.value = await apiGetSyncStatus()
  } catch { /* ignore */ }
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

async function handleTestConnection() {
  testingConn.value = true
  try {
    const result = await apiTestFilesystem()
    if (result.ok) {
      message.success(result.message)
    } else {
      message.error(result.message)
    }
  } catch {
    message.error('连接测试失败')
  } finally {
    testingConn.value = false
  }
}

async function handleSyncImport() {
  syncing.value = true
  try {
    const res = await apiTriggerSyncImport()
    if ((res as unknown as { status: string }).status) {
      message.info('导入已启动')
      startLivePolling()
    }
  } catch {
    message.error('启动同步失败')
  } finally {
    syncing.value = false
  }
}

async function handleSyncExport() {
  exporting.value = true
  try {
    const res = await apiTriggerSyncExport()
    if ((res as unknown as { status: string }).status) {
      message.info('导出已启动')
      startLivePolling()
    }
  } catch {
    message.error('启动导出失败')
  } finally {
    exporting.value = false
  }
}

async function handleSyncBoth() {
  syncing.value = true
  exporting.value = true
  try {
    await apiTriggerSyncImport()
    message.info('导入已启动')
    startLivePolling()
    // poll until import done
    const pollImport = () => new Promise<void>((resolve) => {
      const check = setInterval(async () => {
        try {
          const s = await apiGetSyncStatus()
          if (!s.running) { clearInterval(check); resolve() }
        } catch { /* ignore */ }
      }, 1000)
    })
    await pollImport()
    await apiTriggerSyncExport()
    message.info('导出已启动')
    startLivePolling()
  } catch {
    message.error('双向同步启动失败')
  } finally {
    syncing.value = false
    exporting.value = false
  }
}

async function handleClearData() {
  clearing.value = true
  try {
    const result = await apiClearSyncedData()
    message.success(`已清空: ${result.documentsDeleted} 个文档, ${result.logsDeleted} 条日志`)
    loadStatus()
    loadFileTrees()
  } catch {
    message.error('清空失败')
  } finally {
    clearing.value = false
  }
}

/**
 * Flatten a file tree into a map of path → { checksum, documentId } for files only.
 */
function flattenFiles(nodes: FileTreeNode[], map: Record<string, { checksum?: string | null; documentId?: number | null }> = {}) {
  for (const n of nodes) {
    if (n.type === 'file') { map[n.path] = { checksum: n.checksum, documentId: n.documentId } }
    if (n.children) flattenFiles(n.children, map)
  }
  return map
}

/**
 * Compute diff status map between remote and local file trees.
 */
function computeDiffStatus(
  remoteFiles: Record<string, { checksum?: string | null }>,
  localFiles: Record<string, { checksum?: string | null }>,
): { remote: Record<string, 'new' | 'old' | 'synced'>; local: Record<string, 'new' | 'old' | 'synced'> } {
  const remote: Record<string, 'new' | 'old' | 'synced'> = {}
  const local: Record<string, 'new' | 'old' | 'synced'> = {}
  for (const path of Object.keys(remoteFiles)) {
    const lf = localFiles[path]
    if (!lf) { remote[path] = 'new' }
    else if (remoteFiles[path].checksum && lf.checksum && remoteFiles[path].checksum !== lf.checksum) {
      remote[path] = 'old'; local[path] = 'old'
    } else { remote[path] = 'synced'; local[path] = 'synced' }
  }
  for (const path of Object.keys(localFiles)) {
    if (!remoteFiles[path]) local[path] = 'new'
  }
  return { remote, local }
}

async function loadFileTrees() {
  treeLoading.value = true
  try {
    const [remote, synced] = await Promise.all([
      apiGetRemoteFiles(),
      apiGetSyncedFiles(),
    ])
    remoteTree.value = remote
    syncedTree.value = synced
    const remoteFlat = flattenFiles(remote.tree)
    const localFlat = flattenFiles(synced.tree)
    const diff = computeDiffStatus(remoteFlat, localFlat)
    remoteDiffMap.value = diff.remote
    localDiffMap.value = diff.local
  } catch { /* ignore */ } finally {
    treeLoading.value = false
  }
}

function handleRefreshAll() {
  loadConfig()
  loadStatus()
  loadFileTrees()
}

// ---- Sync records (log list) ----
const logs = ref<SyncLogEntry[]>([])
const logsLoading = ref(false)
const logsTotal = ref(0)
const logsPage = ref(1)
const logsPageSize = ref(20)
const logsFilter = ref<{ direction?: string; status?: string }>({})
const logsCollapsed = ref(true)

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
  } catch { /* ignore */ } finally {
    logsLoading.value = false
  }
}

function handleLogPageChange(page: number) {
  logsPage.value = page
  loadLogs()
}

function handleLogFilterChange() {
  logsPage.value = 1
  loadLogs()
}

function logStatusTagType(s: string): 'success' | 'warning' | 'error' | 'default' {
  switch (s) {
    case 'success': return 'success'
    case 'conflict': return 'warning'
    case 'error': return 'error'
    default: return 'default'
  }
}

function logDirTagType(d: string): 'info' | 'success' {
  return d === 'import' ? 'info' : 'success'
}


onMounted(() => {
  loadConfig()
  loadStatus()
  loadFileTrees()
  loadLogs()
})
</script>

<template>
  <div>
    <PageHeader title="Obsidian 同步" subtitle="Obsidian Vault 双向同步管理">
      <NButton quaternary @click="handleRefreshAll">
        <template #icon><RefreshOutline class="w-4 h-4" /></template>
        刷新
      </NButton>
    </PageHeader>

    <NSpin :show="loading">
      <!-- 同步状态 + 4 action buttons -->
      <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 mb-6">
        <!-- Header row -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <h3 class="font-medium">同步状态</h3>
            <NTag v-if="status.running" type="warning" size="small">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5 animate-pulse" />
              同步中
            </NTag>
            <NTag v-else type="success" size="small">空闲</NTag>
          </div>
          <!-- 4 action buttons in a row -->
          <div class="flex items-center gap-2">
            <NButton
              size="small"
              :type="syncing ? 'primary' : 'default'"
              :loading="syncing"
              :disabled="!hasSyncPerm"
              @click="handleSyncImport"
            >
              <template #icon><CloudUploadOutline class="w-4 h-4" /></template>
              拉取到本地
            </NButton>
            <NButton
              size="small"
              :type="exporting ? 'warning' : 'default'"
              :loading="exporting"
              :disabled="!hasSyncPerm"
              @click="handleSyncExport"
            >
              <template #icon><DownloadOutline class="w-4 h-4" /></template>
              发布到远程
            </NButton>
            <NButton
              size="small"
              secondary
              :disabled="!hasSyncPerm || syncing || exporting"
              @click="handleSyncBoth"
            >
              <template #icon><SwapHorizontalOutline class="w-4 h-4" /></template>
              双向同步
            </NButton>
            <NButton
              size="small"
              quaternary
              @click="configDrawer = true"
            >
              <template #icon><SettingsOutline class="w-4 h-4" /></template>
              配置
            </NButton>
          </div>
        </div>

        <!-- Last sync info -->
        <div class="text-sm text-base-content/50 mb-4">
          上次同步: <span class="text-base-content font-medium">{{ status.last_sync_at ? new Date(status.last_sync_at).toLocaleString() : '从未' }}</span>
        </div>

        <!-- Import progress -->
        <div v-if="status.running || totalResult" class="mb-3">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-base-content/50">导入进度</span>
            <span v-if="totalResult" class="text-base-content/40">
              {{ totalResult.imported + totalResult.skipped + totalResult.conflicted + totalResult.errors }} / {{ totalResult.total || '-' }}
            </span>
          </div>
          <NProgress
            v-if="totalResult"
            type="line"
            :percentage="totalResult.total ? Math.round(((totalResult.imported + totalResult.skipped + totalResult.conflicted + totalResult.errors) / totalResult.total) * 100) : 0"
            :height="8"
            :border-radius="4"
            :fill-border-radius="4"
            status="default"
          />
        </div>

        <!-- Import stats row -->
        <div v-if="totalResult && !status.running" class="flex flex-wrap gap-4 text-xs mb-2">
          <span class="text-green-500">导入成功 {{ totalResult.imported }}</span>
          <span class="text-base-content/30">跳过 {{ totalResult.skipped }}</span>
          <span class="text-amber-500">冲突 {{ totalResult.conflicted }}</span>
          <span class="text-red-500">错误 {{ totalResult.errors }}</span>
        </div>

              </div>

      <!-- File tree comparison -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <!-- Remote file tree -->
        <div class="bg-base-100 rounded-xl border border-base-content/5 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 bg-base-200/50 border-b border-base-content/5">
            <div class="flex items-center gap-3">
              <h3 class="font-medium text-sm">远程文件</h3>
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">新</span>
                <span class="px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">旧</span>
                <span class="px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">已同步</span>
                <span class="text-base-content/30">对比</span>
              </div>
            </div>
            <span class="text-[10px] text-base-content/30">{{ remoteTree.fileCount }} 个文件</span>
          </div>
          <div class="max-h-80 overflow-y-auto p-2">
            <NSpin :show="treeLoading" size="small">
              <SyncFileTree
                :tree="remoteTree.tree"
                :loading="treeLoading"
                empty-text="暂无远程文件，请先配置数据源"
                :show-status="false"
                :diff-status-map="remoteDiffMap"
              />
            </NSpin>
          </div>
        </div>

        <!-- Local file tree -->
        <div class="bg-base-100 rounded-xl border border-base-content/5 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 bg-base-200/50 border-b border-base-content/5">
            <div class="flex items-center gap-3">
              <h3 class="font-medium text-sm">本地文件</h3>
              <div class="flex items-center gap-1.5 text-[10px]">
                <span class="px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">新</span>
                <span class="px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">旧</span>
                <span class="px-1 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">已同步</span>
                <span class="text-base-content/30">对比</span>
              </div>
            </div>
            <div class="flex items-center gap-2 text-[10px] text-base-content/30">
              <span v-if="syncedTree.stats" class="text-green-500">{{ syncedTree.stats.active }} 活跃</span>
              <span v-if="syncedTree.stats && syncedTree.stats.archived > 0">{{ syncedTree.stats.archived }} 归档</span>
              <span>{{ syncedTree.fileCount }} 个文件</span>
            </div>
          </div>
          <div class="max-h-80 overflow-y-auto p-2">
            <NSpin :show="treeLoading" size="small">
              <SyncFileTree
                :tree="syncedTree.tree"
                :loading="treeLoading"
                empty-text="暂无本地文件，点击拉取到本地开始同步"
                :show-status="true"
                :diff-status-map="localDiffMap"
              />
            </NSpin>
          </div>
        </div>
      </div>

      <!-- Live log section -->
      <div v-if="livePolling || liveLogs.length > 0" class="bg-base-100 rounded-xl border border-base-content/5 overflow-hidden mb-6">
        <div class="flex items-center justify-between px-4 py-2.5 bg-base-200/50 border-b border-base-content/5">
          <div class="flex items-center gap-2 text-xs">
            <span class="font-medium text-base-content">实时日志</span>
            <span v-if="livePolling" class="flex items-center gap-1 text-green-500">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              同步中
            </span>
            <span v-else class="text-base-content/40">已完成</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-base-content/30">{{ liveLogs.length }} 条</span>
            <NButton v-if="livePolling" size="tiny" quaternary @click="stopLivePolling">
              <template #icon><StopOutline class="w-3 h-3" /></template>
              停止
            </NButton>
          </div>
        </div>
        <div class="overflow-x-auto">
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
                v-for="(log, i) in liveLogs"
                :key="log.id || i"
                class="border-b border-base-content/5 hover:bg-base-200/30"
              >
                <td class="py-2 pr-4 text-base-content/40 whitespace-nowrap">
                  {{ new Date(log.created_at).toLocaleTimeString() }}
                </td>
                <td class="py-2 pr-4">
                  <NTag :type="logDirTagType(log.direction)" size="tiny">
                    {{ log.direction === 'import' ? '导入' : '导出' }}
                  </NTag>
                </td>
                <td class="py-2 pr-4 text-base-content/60 max-w-48 truncate">
                  {{ log.file_path || '-' }}
                </td>
                <td class="py-2 pr-4">
                  <NTag :type="logStatusTagType(log.status)" size="tiny">
                    {{ log.status === 'success' ? '成功' : log.status === 'skipped' ? '跳过' : log.status === 'conflict' ? '冲突' : log.status === 'error' ? '错误' : log.status }}
                  </NTag>
                </td>
                <td class="py-2 pr-4 text-base-content/40 max-w-40 truncate">
                  {{ log.detail || '-' }}
                </td>
              </tr>
              <tr v-if="liveLogs.length === 0 && livePolling">
                <td colspan="5" class="py-4 text-center text-base-content/30 italic">等待同步开始...</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sync records (historical log) - collapsed by default -->
      <div class="bg-base-100 rounded-xl border border-base-content/5">
        <div
          class="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-base-200/30"
          @click="logsCollapsed = !logsCollapsed"
        >
          <div class="flex items-center gap-2">
            <span class="font-medium text-sm">同步记录</span>
            <span class="text-[10px] text-base-content/30">{{ logsTotal }} 条</span>
          </div>
          <div class="flex items-center gap-2">
            <NTag v-if="!logsCollapsed" size="tiny" round>{{ logsTotal }}</NTag>
            <svg class="w-4 h-4 text-base-content/30 transition-transform" :class="logsCollapsed ? '' : 'rotate-180'" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <div v-if="!logsCollapsed" class="border-t border-base-content/5 p-4">
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs text-base-content/40">共 {{ logsTotal }} 条记录</span>
            <NSelect
              v-model:value="logsFilter.status"
              :options="LOG_STATUS_OPTIONS"
              size="tiny"
              style="width: 100px"
              placeholder="状态"
              clearable
              @update:value="handleLogFilterChange"
            />
          </div>
          <NSpin :show="logsLoading">
            <NEmpty v-if="logs.length === 0" description="暂无同步记录" class="py-6" />
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
                      <NTag :type="logDirTagType(log.direction)" size="tiny">
                        {{ log.direction === 'import' ? '导入' : '导出' }}
                      </NTag>
                    </td>
                    <td class="py-2 pr-4 text-base-content/60 max-w-48 truncate">
                      {{ log.file_path || '-' }}
                    </td>
                    <td class="py-2 pr-4">
                      <NTag :type="logStatusTagType(log.status)" size="tiny">
                        {{ log.status === 'success' ? '成功' : log.status === 'skipped' ? '跳过' : log.status === 'conflict' ? '冲突' : log.status === 'error' ? '错误' : log.status }}
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
              <span>{{ logsPage }} / {{ Math.ceil(logsTotal / logsPageSize) }}</span>
              <div class="flex items-center gap-2">
                <NButton size="tiny" quaternary :disabled="logsPage <= 1" @click="handleLogPageChange(logsPage - 1)">上一页</NButton>
                <NButton size="tiny" quaternary :disabled="logsPage >= Math.ceil(logsTotal / logsPageSize)" @click="handleLogPageChange(logsPage + 1)">下一页</NButton>
              </div>
            </div>
          </NSpin>
        </div>
      </div>

      <!-- Clear data (minor action) -->
      <div class="mt-4 text-right">
        <NButton
          size="tiny"
          quaternary
          type="error"
          :loading="clearing"
          :disabled="!hasSyncPerm"
          @click="handleClearData"
        >
          清空已同步数据
        </NButton>
      </div>
    </NSpin>

    <!-- Config drawer -->
    <NDrawer v-model:show="configDrawer" :width="360" placement="right">
      <NDrawerContent title="同步配置" :native-scrollbar="false">
        <div class="flex flex-col gap-5">
          <!-- Vault path -->
          <div>
            <label class="text-xs text-base-content/50 block mb-1.5">仓库路径</label>
            <NInput
              v-model:value="config.vault_path"
              placeholder="/path/to/obsidian/vault"
              size="small"
              :disabled="!hasSyncPerm"
            />
            <span class="text-[10px] text-base-content/30 mt-0.5 block">容器内路径或挂载卷路径</span>
          </div>

          <!-- Conflict strategy -->
          <div>
            <label class="text-xs text-base-content/50 block mb-1.5">冲突策略</label>
            <NSelect
              v-model:value="config.conflict_strategy"
              :options="STRATEGY_OPTIONS"
              size="small"
              :disabled="!hasSyncPerm"
            />
          </div>

          <!-- Auto sync -->
          <div class="flex items-center justify-between">
            <div>
              <div class="text-xs text-base-content/50">自动同步</div>
              <div class="text-[10px] text-base-content/30 mt-0.5">按间隔自动执行双向同步</div>
            </div>
            <NSwitch
              :value="config.auto_sync_enabled"
              :disabled="!hasSyncPerm"
              @update:value="(val: boolean) => config.auto_sync_enabled = val"
            />
          </div>

          <!-- Sync interval -->
          <div>
            <label class="text-xs text-base-content/50 block mb-1.5">同步间隔 (分钟)</label>
            <NInputNumber
              :value="config.sync_interval_minutes"
              :min="5"
              :max="1440"
              size="small"
              style="width: 120px"
              :disabled="!hasSyncPerm"
              @update:value="(val: number | null) => { if (val !== null) config.sync_interval_minutes = val }"
            />
          </div>
        </div>

        <template #footer>
          <div class="flex items-center gap-2">
            <NButton
              size="small"
              :loading="saving"
              :disabled="!hasSyncPerm"
              type="primary"
              @click="handleSaveConfig"
            >
              保存配置
            </NButton>
            <NButton
              size="small"
              :loading="testingConn"
              :disabled="!hasSyncPerm"
              @click="handleTestConnection"
            >
              测试连接
            </NButton>
          </div>
        </template>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>