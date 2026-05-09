<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NInput, NModal, NSpin, NPopconfirm, useMessage } from 'naive-ui'
import { AddOutline, TrashOutline } from '@vicons/ionicons5'
import { useCanvasPersistence } from '../../../composables/useCanvasPersistence'
import { usePermissionStore } from '../../../stores/permission'
import type { CanvasListItem } from '../../../api/kb'
import PageHeader from '../../../components/common/PageHeader.vue'

const router = useRouter()
const message = useMessage()
const permissionStore = usePermissionStore()
const { listCanvases, createCanvas, deleteCanvas } = useCanvasPersistence()

const canvases = ref<CanvasListItem[]>([])
const loading = ref(false)
const showCreate = ref(false)
const newTitle = ref('')
const creating = ref(false)

async function load() {
  loading.value = true
  try {
    canvases.value = await listCanvases()
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!newTitle.value.trim()) return
  creating.value = true
  try {
    const c = await createCanvas(newTitle.value.trim())
    message.success('画布已创建')
    showCreate.value = false
    newTitle.value = ''
    router.push({ name: 'kb-canvas-editor-v2', params: { id: String(c.id) } })
  } catch {
    message.error('创建失败')
  } finally {
    creating.value = false
  }
}

async function handleDelete(c: CanvasListItem) {
  try {
    await deleteCanvas(c.id)
    message.success('已删除')
    load()
  } catch { message.error('删除失败') }
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="无限画布" subtitle="可视化知识库关系 · 拖拽自由排版">
      <NButton type="primary" @click="showCreate = true" :disabled="!permissionStore.hasPermission('kb:update')">
        <template #icon><AddOutline class="w-4 h-4" /></template>
        新建画布
      </NButton>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="canvases.length === 0 && !loading" class="py-16 text-center">
        <p class="text-base-content/30 text-sm">暂无画布，点击右上角新建</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="c in canvases"
          :key="c.id"
          class="bg-base-100 rounded-xl border border-base-content/5 p-5 hover:border-primary/30 transition-all cursor-pointer group"
          @click="router.push({ name: 'kb-canvas-editor-v2', params: { id: String(c.id) } })"
        >
          <div class="flex items-start justify-between">
            <h3 class="font-medium text-sm text-base-content truncate">{{ c.title }}</h3>
            <NPopconfirm @positive-click="handleDelete(c)">
              <template #trigger>
                <NButton size="tiny" quaternary type="error" class="opacity-0 group-hover:opacity-100" @click.stop>
                  <TrashOutline class="w-3.5 h-3.5" />
                </NButton>
              </template>
              确认删除此画布？
            </NPopconfirm>
          </div>
          <p v-if="c.description" class="text-xs text-base-content/40 mt-1 truncate">{{ c.description }}</p>
          <div class="flex items-center gap-3 mt-3 text-[11px] text-base-content/30">
            <span>{{ c.node_count }} 元素</span>
            <span>{{ c.edge_count }} 连线</span>
            <span class="ml-auto">{{ formatDate(c.updated_at) }}</span>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- Create modal -->
    <NModal v-model:show="showCreate" title="新建画布">
      <div class="p-6 bg-base-100 rounded-xl w-96">
        <h3 class="text-lg font-medium mb-4">新建无限画布</h3>
        <NInput v-model:value="newTitle" placeholder="画布名称..." @keyup.enter="handleCreate" />
        <div class="flex justify-end gap-2 mt-4">
          <NButton @click="showCreate = false">取消</NButton>
          <NButton type="primary" :loading="creating" @click="handleCreate">创建</NButton>
        </div>
      </div>
    </NModal>
  </div>
</template>
