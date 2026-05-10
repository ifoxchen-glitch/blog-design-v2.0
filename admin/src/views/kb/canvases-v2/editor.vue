<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'
import { ArrowBackOutline, BookOutline } from '@vicons/ionicons5'
import { useCanvasV2 } from '../../../composables/useCanvasV2'
import type { CanvasData } from '../../../composables/useCanvasV2'
import CanvasView from '../../../components/kb/canvas-v2/CanvasView.vue'
import CanvasToolbar from '../../../components/kb/canvas-v2/CanvasToolbar.vue'
import LeftDocPanel from '../../../components/kb/canvas-v2/LeftDocPanel.vue'
import RightPropsPanel from '../../../components/kb/canvas-v2/RightPropsPanel.vue'
import DocDetailDialog from '../../../components/kb/canvas/DocDetailDialog.vue'
import { request } from '../../../api/request'
import type { ApiResponse } from '../../../api/request'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const canvasId = computed(() => {
  const id = Number(route.params.id)
  return Number.isFinite(id) && id > 0 ? id : 0
})

const canvas = useCanvasV2(canvasId)

const showBrowser = ref(true)
const showDocDetail = ref(false)
const docDetailId = ref<number | null>(null)
const isMobile = ref(false)

function checkMobile() { isMobile.value = window.innerWidth < 768 }

// Load canvas data
let zoomFitTimer: ReturnType<typeof setTimeout> | null = null

async function loadCanvasData() {
  if (canvasId.value <= 0) return
  canvas.isLoading.value = true
  try {
    const res = await request.get<ApiResponse<CanvasData>>(`/api/v2/admin/kb/canvases/${canvasId.value}`)
    const data = res.data.data
    canvas.loadFromData(data.nodes || [], data.edges || [], {
      zoom: data.zoom || 1,
      panX: data.pan_x || 0,
      panY: data.pan_y || 0,
    })
    zoomFitTimer = setTimeout(() => canvas.zoomToFit(), 200)
  } catch {
    message.warning('加载画布数据失败')
  } finally {
    canvas.isLoading.value = false
  }
}

// Save — manual save (user clicks save button)
async function handleSave() {
  const err = await canvas.save()
  if (err) {
    message.error(err)
  } else {
    message.success('已保存')
  }
}

// Save before leaving — does NOT block navigation
async function saveBeforeLeave() {
  if (!canvas.isDirty.value) return
  const err = await canvas.save()
  if (err) {
    console.warn('save before leave failed:', err)
  }
}

function handleBack() {
  router.push({ name: 'kb-canvases-v2' })
}

function handleOpenDocDetail(docId: number) {
  docDetailId.value = docId
  showDocDetail.value = true
}

function handleClosePanel() {
  canvas.selectedIds.value = new Set()
}

// Auto-save
let autoSaveTimer: ReturnType<typeof setInterval> | null = null

function startAutoSave() {
  autoSaveTimer = setInterval(async () => {
    if (canvas.isDirty.value) {
      await canvas.save()
    }
  }, 15000)
}

// Save before leaving — never blocks navigation
onBeforeRouteLeave(async (_to, _from, next) => {
  await saveBeforeLeave()
  next()
})

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  startAutoSave()
  loadCanvasData()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  if (zoomFitTimer) clearTimeout(zoomFitTimer)
})
</script>

<template>
  <div v-if="isMobile" class="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
    <div class="text-5xl opacity-30">&#x1F5A5;</div>
    <h2 class="text-lg font-medium">请在桌面端使用画布编辑器</h2>
    <p class="text-sm text-base-content/50 max-w-md">画布编辑器需要较大的屏幕空间和精确的鼠标操作。</p>
    <NButton @click="handleBack">返回画布列表</NButton>
  </div>

  <div v-else class="flex flex-col overflow-hidden" style="height: calc(100vh - 180px); min-height: 600px">
    <div class="flex items-center gap-2 px-3 py-1.5 bg-base-100 border-b border-base-content/10 shrink-0">
      <NButton size="tiny" quaternary @click="handleBack">
        <ArrowBackOutline class="w-4 h-4" />
      </NButton>
      <span class="text-sm font-medium text-base-content">画布编辑器</span>
      <span class="text-[11px] text-base-content/30">#{{ canvasId }}</span>
      <div class="flex-1" />
      <NButton size="tiny" quaternary @click="showBrowser = !showBrowser"
        :type="showBrowser ? 'primary' : 'default'">
        <BookOutline class="w-3.5 h-3.5" />
        文档库
      </NButton>
      <span class="text-[11px] text-base-content/30 tabular-nums">
        {{ canvas.nodeCount.value }}E / {{ canvas.edgeCount.value }}C
      </span>
      <span v-if="canvas.isDirty.value" class="text-[10px] text-warning">未保存</span>
    </div>

    <CanvasToolbar :canvas="canvas" @save="handleSave" />

    <div class="flex flex-1 min-h-0 overflow-hidden">
      <LeftDocPanel v-if="showBrowser" :canvas="canvas" class="w-60 shrink-0" />
      <div class="flex-1 relative min-w-0">
        <CanvasView :canvas="canvas" />
      </div>
      <RightPropsPanel :canvas="canvas" @open-doc-detail="handleOpenDocDetail" @close="handleClosePanel" />
    </div>
  </div>

  <DocDetailDialog
    :show="showDocDetail"
    :doc-id="docDetailId"
    @update:show="(v: boolean) => showDocDetail = v"
  />
</template>