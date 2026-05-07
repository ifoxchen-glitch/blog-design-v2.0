<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  NButton,
  NInput,
  NPopconfirm,
  NSpin,
  NEmpty,
  NModal,
  NForm,
  NFormItem,
  useMessage,
} from 'naive-ui'
import {
  AddOutline,
  TrashOutline,
  ShapesOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import {
  apiListCanvases,
  apiCreateCanvas,
  apiDeleteCanvas,
  type CanvasListItem,
} from '../../../api/kb'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'

const router = useRouter()
const message = useMessage()
const permissionStore = usePermissionStore()

const canvases = ref<CanvasListItem[]>([])
const loading = ref(false)

const showCreate = ref(false)
const newTitle = ref('')
const newDesc = ref('')
const creating = ref(false)

async function loadCanvases() {
  loading.value = true
  try {
    const res = await apiListCanvases()
    canvases.value = res.items
  } catch {
    /* ignore */
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  if (!newTitle.value.trim()) return
  creating.value = true
  try {
    const created = await apiCreateCanvas({
      title: newTitle.value.trim(),
      description: newDesc.value.trim() || undefined,
    })
    showCreate.value = false
    newTitle.value = ''
    newDesc.value = ''
    router.push({ name: 'kb-canvas-editor', params: { id: String(created.id) } })
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      message.error((e.response?.data as { message?: string })?.message ?? '创建失败')
    } else {
      message.error('创建失败')
    }
  } finally {
    creating.value = false
  }
}

async function handleDelete(canvas: CanvasListItem) {
  try {
    await apiDeleteCanvas(canvas.id)
    message.success('已删除')
    loadCanvases()
  } catch {
    message.error('删除失败')
  }
}

onMounted(() => {
  loadCanvases()
})
</script>

<template>
  <div>
    <PageHeader title="画布管理" subtitle="知识图谱与无限画布">
      <NButton v-permission="'kb:create'" type="primary" @click="showCreate = true">
        <template #icon><AddOutline class="w-4 h-4" /></template>
        新建画布
      </NButton>
    </PageHeader>

    <NSpin :show="loading">
      <div v-if="canvases.length === 0 && !loading" class="py-16">
        <NEmpty description="暂无画布">
          <template #extra>
            <p class="text-sm text-base-content/40 mt-2">点击右上角"新建画布"开始创建</p>
          </template>
        </NEmpty>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="canvas in canvases"
          :key="canvas.id"
          class="group bg-base-100 rounded-xl border border-base-content/5 overflow-hidden hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
        >
          <!-- 缩略图占位 -->
          <div
            class="h-32 bg-base-200/50 flex items-center justify-center"
            :class="canvas.node_count > 0 ? 'bg-primary/5' : ''"
            @click="router.push({ name: 'kb-canvas-editor', params: { id: String(canvas.id) } })"
          >
            <ShapesOutline class="h-10 w-10" :class="canvas.node_count > 0 ? 'text-primary/40' : 'text-base-content/20'" />
          </div>

          <div class="p-4">
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0 cursor-pointer" @click="router.push({ name: 'kb-canvas-editor', params: { id: String(canvas.id) } })">
                <h3 class="font-medium text-sm truncate">{{ canvas.title }}</h3>
                <p v-if="canvas.description" class="text-xs text-base-content/40 truncate mt-0.5">{{ canvas.description }}</p>
              </div>
              <NPopconfirm
                v-if="permissionStore.hasPermission('kb:delete')"
                @positive-click="handleDelete(canvas)"
              >
                <template #trigger>
                  <NButton size="tiny" quaternary type="error" @click.stop>
                    <TrashOutline class="w-3.5 h-3.5" />
                  </NButton>
                </template>
                确认删除该画布?此操作不可恢复
              </NPopconfirm>
            </div>

            <div class="flex items-center gap-3 mt-3 text-[11px] text-base-content/30">
              <span>{{ canvas.node_count }} 节点</span>
              <span>{{ canvas.edge_count }} 连线</span>
            </div>
            <div class="text-[10px] text-base-content/20 mt-1">
              更新于 {{ formatDateTime(canvas.updated_at) }}
            </div>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- 新建对话框 -->
    <NModal
      v-model:show="showCreate"
      preset="card"
      title="新建画布"
      style="max-width: 420px;"
      :mask-closable="false"
    >
      <NForm label-placement="top" size="small">
        <NFormItem label="画布名称" required>
          <NInput v-model:value="newTitle" placeholder="输入画布名称" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="newDesc" type="textarea" placeholder="可选描述" :autosize="{ minRows: 2, maxRows: 4 }" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreate = false">取消</NButton>
          <NButton type="primary" :loading="creating" :disabled="!newTitle.trim()" @click="handleCreate">创建</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
