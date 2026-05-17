<script setup lang="ts">
import { ref, h, onMounted } from 'vue'
import {
  NButton, NCard, NSpace, NInput, NSelect, NSwitch, NTag,
  NDataTable, NDrawer, NDrawerContent, NPopconfirm, useMessage,
} from 'naive-ui'
import { AddOutline, TrashOutline, CreateOutline, SyncOutline } from '@vicons/ionicons5'
import {
  apiListSyncSources,
  apiCreateSyncSource,
  apiUpdateSyncSource,
  apiDeleteSyncSource,
  apiGetSyncSourceStatus,
  apiTriggerSyncSourceImport,
  type SyncSource,
  type SyncSourceStatus,
} from '../../api/kb'


const message = useMessage()


const sources = ref<SyncSource[]>([])
const loading = ref(false)
const drawerOpen = ref(false)
const editing = ref(false)

const form = ref<{ id?: number; name: string; type: SyncSource['type']; config: string; enabled: boolean }>({
  name: '',
  type: 'openwebui',
  config: '{}',
  enabled: true,
})

const typeOptions = [
  { label: 'Open WebUI', value: 'openwebui' },
  { label: 'Obsidian', value: 'obsidian' },
  { label: '本地文件夹', value: 'local_folder' },
]

const sourceStatus = ref<SyncSourceStatus | null>(null)
const statusDrawer = ref(false)

async function load() {
  loading.value = true
  try {
    sources.value = await apiListSyncSources()
  } catch (e: any) {
    message.error('加载同步源失败: ' + (e?.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editing.value = false
  form.value = { name: '', type: 'openwebui', config: '{}', enabled: true }
  drawerOpen.value = true
}

function openEdit(src: SyncSource) {
  editing.value = true
  form.value = { id: src.id, name: src.name, type: src.type, config: src.config, enabled: !!src.enabled }
  drawerOpen.value = true
}

async function save() {
  if (!form.value.name.trim()) { message.warning('请输入名称'); return }
  try {
    let configObj: Record<string, unknown> = {}
    try { configObj = JSON.parse(form.value.config) } catch { message.warning('配置必须是有效的 JSON'); return }

    if (editing.value && form.value.id) {
      await apiUpdateSyncSource(form.value.id, {
        name: form.value.name,
        type: form.value.type,
        config: configObj,
        enabled: form.value.enabled,
      })
      message.success('已更新')
    } else {
      await apiCreateSyncSource({ name: form.value.name, type: form.value.type, config: configObj })
      message.success('已创建')
    }
    drawerOpen.value = false
    await load()
  } catch (e: any) {
    message.error('保存失败: ' + (e?.message || '未知错误'))
  }
}

async function remove(id: number) {
  try {
    await apiDeleteSyncSource(id)
    message.success('已删除')
    await load()
  } catch (e: any) {
    message.error('删除失败: ' + (e?.message || '未知错误'))
  }
}

async function viewStatus(src: SyncSource) {
  try {
    sourceStatus.value = await apiGetSyncSourceStatus(src.id)
    statusDrawer.value = true
  } catch (e: any) {
    message.error('获取状态失败: ' + (e?.message || '未知错误'))
  }
}

async function triggerImport(src: SyncSource) {
  try {
    await apiTriggerSyncSourceImport(src.id)
    message.success('导入任务已触发')
    await load()
  } catch (e: any) {
    message.error('触发导入失败: ' + (e?.message || '未知错误'))
  }
}

const columns = [
  { title: '名称', key: 'name', width: 160 },
  {
    title: '类型', key: 'type', width: 120,
    render(row: any) {
      const label = typeOptions.find(t => t.value === row.type)?.label || row.type
      return h(NTag, { type: row.type === 'openwebui' ? 'info' : row.type === 'obsidian' ? 'warning' : 'default', size: 'small' }, { default: () => label })
    }
  },
  {
    title: '启用', key: 'enabled', width: 80,
    render(row: any) { return h(NTag, { type: row.enabled ? 'success' : 'error', size: 'small' }, { default: () => row.enabled ? '是' : '否' }) }
  },
  { title: '上次同步', key: 'last_sync_at', width: 180, render(row: any) { return row.last_sync_at || '-' } },
  {
    title: '操作', key: 'actions', width: 280,
    render(row: any) {
      return h(NSpace, { size: 'small' }, [
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => viewStatus(row) }, { default: () => '状态', icon: () => h(SyncOutline) }),
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => triggerImport(row) }, { default: () => '导入', icon: () => h(SyncOutline) }),
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => openEdit(row) }, { default: () => '编辑', icon: () => h(CreateOutline) }),
        h(NPopconfirm, { onPositiveClick: () => remove(row.id) }, {
          default: () => '确定删除?',
          trigger: () => h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, { default: () => '删除', icon: () => h(TrashOutline) }),
        }),
      ])
    }
  },
]

onMounted(load)
</script>

<template>
  <NCard title="同步源管理" size="small" :segmented="{ content: true }">
    <template #header-extra>
      <NButton size="small" type="primary" @click="openCreate">
        <template #icon><AddOutline /></template>
        新建同步源
      </NButton>
    </template>

    <NDataTable
      :columns="columns"
      :data="sources"
      :loading="loading"
      :bordered="false"
      :single-line="false"
      size="small"
      :row-key="(r: any) => r.id"
    />

    <!-- Create/Edit Drawer -->
    <NDrawer v-model:show="drawerOpen" :width="420" placement="right">
      <NDrawerContent :title="editing ? '编辑同步源' : '新建同步源'" closable>
        <NSpace vertical size="large">
          <div>
            <label class="block text-sm mb-1">名称</label>
            <NInput v-model:value="form.name" placeholder="例如: 我的 Obsidian 笔记" />
          </div>
          <div>
            <label class="block text-sm mb-1">类型</label>
            <NSelect v-model:value="form.type" :options="typeOptions" :disabled="editing" />
          </div>
          <div>
            <label class="block text-sm mb-1">配置 (JSON)</label>
            <NInput v-model:value="form.config" type="textarea" :rows="4" placeholder='例如: {"path": "/notes"}' />
          </div>
          <div class="flex items-center gap-2">
            <NSwitch v-model:value="form.enabled" />
            <span class="text-sm">启用</span>
          </div>
          <NButton type="primary" block @click="save">{{ editing ? '更新' : '创建' }}</NButton>
        </NSpace>
      </NDrawerContent>
    </NDrawer>

    <!-- Status Drawer -->
    <NDrawer v-model:show="statusDrawer" :width="480" placement="right">
      <NDrawerContent title="同步源状态" closable>
        <div v-if="sourceStatus">
          <p class="mb-2"><strong>名称:</strong> {{ sourceStatus!.source.name }}</p>
          <p class="mb-2"><strong>类型:</strong> {{ typeOptions.find(t => t.value === sourceStatus!.source.type)?.label || sourceStatus!.source.type }}</p>
          <p class="mb-2"><strong>上次同步:</strong> {{ sourceStatus!.source.last_sync_at || '从未' }}</p>
          <p class="mb-2"><strong>最近日志:</strong></p>
          <div v-if="sourceStatus!.recentLogs.length === 0" class="text-gray-400 text-sm">暂无日志</div>
          <div v-for="log in sourceStatus!.recentLogs" :key="log.id" class="text-sm mb-1 flex gap-2">
            <span class="text-gray-400">{{ log.created_at }}</span>
            <NTag :type="log.status === 'success' ? 'success' : 'error'" size="tiny">{{ log.status }}</NTag>
            <span class="truncate">{{ log.sync_type }}</span>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>
  </NCard>
</template>
