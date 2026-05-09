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
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import SyncFileTree from '../../../components/kb/SyncFileTree.vue'
import FolderCheckItem from '../../../components/kb/FolderCheckItem.vue'
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
  type SyncLogEntry,
  type FileTreeData,
  type FileTreeNode,
} from '../../../api/kb'
import { usePermissionStore } from '../../../stores/permission'

// ---- Sync status type with export stats ----
interface SyncStatusResult {
  imported: number
  skipped: number
  conflicted: number
  errors: number
  exported: number
  export_skipped: number
  export_failed: number
}

interface SyncStatus {
  running: boolean
  last_sync_at: string | null
  last_result: SyncStatusResult | null
}

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
  selected_paths: [],
})

// Folder selection toggle
function toggleFolderSelect(folderPath: string) {
  const paths = config.value.selected_paths
  const idx = paths.indexOf(folderPath)
  if (idx >= 0) {
    paths.splice(idx, 1)
  } else {
    paths.push(folderPath)
  }
}

const status = ref<SyncStatus>({
  running: false,
  last_sync_at: null,
  last_result: null,
})

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
const totalResult = computed(() => status.value.last_result)

// Import progress
const importDone = computed(() => {
  if (!totalResult.value) return 0
  return totalResult.value.imported + totalResult.value.skipped + totalResult.value.conflicted + totalResult.value.errors
})
const importTotal = computed(() => {
  if (!totalResult.value) return 0
  return totalResult.value.imported + totalResult.value.skipped + totalResult.value.conflicted + totalResult.value.errors || 0
})
const importPct = computed(() => {
  if (!importTotal.value) return 0
  return Math.min(100, Math.round((importDone.value / importTotal.value) * 100))
})

// Export progress
const exportDone = computed(() => {
  if (!totalResult.value) return 0
  return totalResult.value.exported + totalResult.value.export_skipped + totalResult.value.export_failed
})
const exportTotal = computed(() => {
  if (!totalResult.value) return 0
  return totalResult.value.exported + totalResult.value.export_skipped + totalResult.value.export_failed || 0
})
const exportPct = computed(() => {
  if (!exportTotal.value) return 0
  return Math.min(100, Math.round((exportDone.value / exportTotal.value) * 100))
})

async function loadConfig() {
  loading.value = true
  try {
    config.value = await apiGetSyncConfig()
    if (!config.value) {
      config.value = { vault_path: '', auto_sync_enabled: false, sync_interval_minutes: 30, conflict_strategy: 'last_write_wins', last_sync_at: null, selected_paths: [] }
    }
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

async function loadStatus() {
  try {
    const res = await apiGetSyncStatus()
    // Cast to our extended type
    status.value = {
      running: res.running,
      last_sync_at: res.last_sync_at,
      last_result: res.last_result as SyncStatusResult | null,
    }
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
      selected_paths: config.value.selected_paths,
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
      startPolling()
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
      startPolling()
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
    startPolling()
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
    startPolling()
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

// ---- polling ----
let _pollTimer: ReturnType<typeof setInterval> | null = null

function startPolling() {
  stopPolling()
  _pollTimer = setInterval(async () => {
    try {
      const s = await apiGetSyncStatus()
      status.value = {
        running: s.running,
        last_sync_at: s.last_sync_at,
        last_result: s.last_result as SyncStatusResult | null,
      }
      if (!s.running) {
        stopPolling()
        loadLogs()
        loadFileTrees()
      }
    } catch { /* ignore */ }
  }, 1500)
}

function stopPolling() {
  if (_pollTimer) {
    clearInterval(_pollTimer)
    _pollTimer = null
  }
}

import { onBeforeUnmount } from 'vue'
onBeforeUnmount(stopPolling)

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
 * Compute diff status for all nodes (files + folders) in a tree.
 */
function computeTreeDiff(
  nodes: FileTreeNode[],
  diffMap: Record<string, 'new' | 'old' | 'synced'>,
  remoteFiles: Record<string, { checksum?: string | null }>,
  localFiles: Record<string, { checksum?: string | null }>,
) {
  for (const node of nodes) {
    if (node.type === 'file') {
      const rf = remoteFiles[node.path]
      const lf = localFiles[node.path]
      if (!rf) { diffMap[node.path] = 'new' }
      else if (!lf) { diffMap[node.path] = 'new' }
      else if (rf.checksum && lf.checksum && rf.checksum !== lf.checksum) { diffMap[node.path] = 'old' }
      else { diffMap[node.path] = 'synced' }
    }
    if (node.children) computeTreeDiff(node.children, diffMap, remoteFiles, localFiles)
  }
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

    // Diff for remote tree
    const rMap: Record<string, 'new' | 'old' | 'synced'> = {}
    computeTreeDiff(remote.tree, rMap, remoteFlat, localFlat)
    remoteDiffMap.value = rMap

    // Diff for local tree
    const lMap: Record<string, 'new' | 'old' | 'synced'> = {}
    computeTreeDiff(synced.tree, lMap, remoteFlat, localFlat)
    localDiffMap.value = lMap
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
          <!-- 4 action buttons -->
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

        <!-- Import section -->
        <div class="mb-4">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-base-content/60 font-medium">导入</span>
            <span class="text-base-content/40">{{ importDone }} / {{ importTotal }}</span>
          </div>
          <NProgress
            type="line"
            :percentage="importPct"
            :height="6"
            :border-radius="3"
            :fill-border-radius="3"
            :show-indicator="false"
            status="success"
          />
          <div v-if="totalResult && !status.running" class="flex flex-wrap gap-4 text-xs mt-1.5">
            <span class="text-green-500">成功 {{ totalResult.imported }}</span>
            <span class="text-base-content/30">跳过 {{ totalResult.skipped }}</span>
            <span class="text-amber-500">冲突 {{ totalResult.conflicted }}</span>
            <span class="text-red-500">错误 {{ totalResult.errors }}</span>
          </div>
        </div>

        <!-- Export section -->
        <div>
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-base-content/60 font-medium">导出</span>
            <span class="text-base-content/40">{{ exportDone }} / {{ exportTotal }}</span>
          </div>
          <NProgress
            type="line"
            :percentage="exportPct"
            :height="6"
            :border-radius="3"
            :fill-border-radius="3"
            :show-indicator="false"
            status="warning"
          />
          <div v-if="totalResult && !status.running" class="flex flex-wrap gap-4 text-xs mt-1.5">
            <span class="text-green-500">成功 {{ totalResult.exported }}</span>
            <span class="text-base-content/30">跳过 {{ totalResult.export_skipped }}</span>
            <span class="text-red-500">失败 {{ totalResult.export_failed }}</span>
          </div>
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

      <!-- Sync records (historical log) -->
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
            <div v-if="logs.length === 0" class="py-6 text-center text-xs text-base-content/30">暂无同步记录</div>
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

      <!-- Clear data -->
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

          <!-- Folder selection -->
          <div>
            <label class="text-xs text-base-content/50 block mb-1.5">
              同步文件夹
              <span class="text-base-content/20 ml-1">(选中的文件夹及其子文件会被同步)</span>
            </label>
            <div class="border border-base-content/10 rounded-lg p-2 max-h-48 overflow-y-auto">
              <NSpin :show="treeLoading" size="small">
                <div v-if="remoteTree.tree.length === 0 && !treeLoading" class="text-[10px] text-base-content/30 p-2">
                  请先配置仓库路径并测试连接
                </div>
                <FolderCheckItem
                  v-for="node in remoteTree.tree"
                  :key="node.path"
                  :node="node"
                  :selected-paths="config.selected_paths"
                  :depth="0"
                  @toggle="toggleFolderSelect"
                />
              </NSpin>
            </div>
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