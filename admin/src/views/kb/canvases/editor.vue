<script setup lang="ts">
import { computed, provide, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton } from 'naive-ui'
import { ArrowBackOutline } from '@vicons/ionicons5'
import { useCanvas, type UseCanvasReturn } from '../../../composables/useCanvas'
import CanvasGraph from '../../../components/kb/canvas/CanvasGraph.vue'
import CanvasToolbar from '../../../components/kb/canvas/CanvasToolbar.vue'
import CanvasNodePanel from '../../../components/kb/canvas/CanvasNodePanel.vue'
import DocDetailDialog from '../../../components/kb/canvas/DocDetailDialog.vue'

const route = useRoute()
const router = useRouter()
const canvasId = computed(() => {
  const id = Number(route.params.id)
  return Number.isFinite(id) && id > 0 ? id : 0
})

const canvas: UseCanvasReturn = useCanvas(canvasId.value)
provide('canvas', canvas)

let autoSaveTimer: ReturnType<typeof setInterval> | null = null

function startAutoSave() {
  autoSaveTimer = setInterval(async () => {
    if (canvas.isDirty.value && canvas.cy.value) {
      try {
        await canvas.saveCanvas()
        canvas.isDirty.value = false
      } catch {
        // silent
      }
    }
  }, 10000) // auto-save every 10s
}

function handleDirtyChange(dirty: boolean) {
  canvas.isDirty.value = dirty
}

function handleBack() {
  router.push({ name: 'kb-canvases' })
}

// Doc detail dialog state
const showDocDetail = ref(false)
const docDetailId = ref<number | null>(null)

function handleOpenDocDetail(docId: number) {
  docDetailId.value = docId
  showDocDetail.value = true
}

startAutoSave()

// Mobile detection
const isMobile = ref(false)
function checkMobile() {
  isMobile.value = window.innerWidth < 768
}
onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

onBeforeUnmount(() => {
  if (autoSaveTimer) clearInterval(autoSaveTimer)
  if (canvas.isDirty.value) {
    canvas.saveCanvas().catch(() => {})
  }
})
</script>

<template>
  <!-- Mobile warning -->
  <div v-if="isMobile" class="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-4 px-6 text-center">
    <div class="text-5xl opacity-30">&#x1F5A5;</div>
    <h2 class="text-lg font-medium">请在桌面端使用画布编辑器</h2>
    <p class="text-sm text-base-content/50 max-w-md">
      画布编辑器需要较大的屏幕空间和精确的鼠标操作，手机端暂不支持。请切换至桌面浏览器访问。
    </p>
    <NButton @click="handleBack">返回画布列表</NButton>
  </div>

  <div v-else class="flex flex-col h-[calc(100vh-4rem)]">
    <!-- Top bar -->
    <div class="flex items-center gap-2 px-3 py-1.5 bg-base-100 border-b border-base-content/10 shrink-0">
      <NButton size="tiny" quaternary @click="handleBack">
        <ArrowBackOutline class="w-4 h-4" />
      </NButton>
      <span class="text-sm font-medium">画布编辑器</span>
      <span class="text-[11px] text-base-content/30">ID #{{ canvasId }}</span>
    </div>

    <!-- Toolbar -->
    <CanvasToolbar class="shrink-0" />

    <!-- Main area -->
    <div class="flex flex-1 min-h-0 relative">
      <div class="flex-1 relative">
        <CanvasGraph
          :canvas-id="canvasId"
          @dirty-changed="handleDirtyChange"
        />
      </div>
      <CanvasNodePanel @open-doc-detail="handleOpenDocDetail" />
    </div>
  </div>

  <!-- KB Document detail dialog -->
  <DocDetailDialog
    :show="showDocDetail"
    :doc-id="docDetailId"
    @update:show="(v: boolean) => showDocDetail = v"
  />
</template>
