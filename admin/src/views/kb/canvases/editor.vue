<script setup lang="ts">
import { computed, provide, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'
import { ArrowBackOutline } from '@vicons/ionicons5'
import { useCanvas, type UseCanvasReturn } from '../../../composables/useCanvas'
import CanvasGraph from '../../../components/kb/canvas/CanvasGraph.vue'
import CanvasToolbar from '../../../components/kb/canvas/CanvasToolbar.vue'
import CanvasNodePanel from '../../../components/kb/canvas/CanvasNodePanel.vue'
import KBDocBrowser from '../../../components/kb/canvas/KBDocBrowser.vue'
import DocDetailDialog from '../../../components/kb/canvas/DocDetailDialog.vue'
import type { KbDocumentListItem } from '../../../api/kb'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const canvasId = computed(() => {
  const id = Number(route.params.id)
  return Number.isFinite(id) && id > 0 ? id : 0
})

const canvas: UseCanvasReturn = useCanvas(canvasId.value)
provide('canvas', canvas)

// Panel visibility
const showBrowser = ref(true)
const showPanel = computed(() => canvas.selectedNode.value !== null)

let autoSaveTimer: ReturnType<typeof setInterval> | null = null

function startAutoSave() {
  autoSaveTimer = setInterval(async () => {
    if (canvas.isDirty.value && canvas.cy.value) {
      try {
        await canvas.saveCanvas()
        canvas.isDirty.value = false
      } catch { /* silent */ }
    }
  }, 10000)
}

function handleDirtyChange(dirty: boolean) {
  canvas.isDirty.value = dirty
}

function handleBack() {
  router.push({ name: 'kb-canvases' })
}

function handleBrowserClick(doc: KbDocumentListItem) {
  // Click to quickly add doc at center of viewport
  if (!canvas.cy.value) return
  const extent = canvas.cy.value.extent()
  const cx = (extent.x1 + extent.x2) / 2
  const cy_ = (extent.y1 + extent.y2) / 2
  canvas.addDocNodeWithConnections(doc, cx, cy_).then((result) => {
    if (result) message.success(`已添加「${doc.title}」`)
  })
}

// Doc detail dialog
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

  <!-- Desktop: three-column layout -->
  <div v-else class="flex flex-col overflow-hidden" style="height: calc(100vh - 180px); min-height: 600px">
    <!-- Top bar -->
    <div class="flex items-center gap-2 px-3 py-1.5 bg-base-100 border-b border-base-content/10 shrink-0">
      <NButton size="tiny" quaternary @click="handleBack">
        <ArrowBackOutline class="w-4 h-4" />
      </NButton>
      <span class="text-sm font-medium">画布编辑器</span>
      <span class="text-[11px] text-base-content/30">#{{ canvasId }}</span>

      <div class="flex-1" />

      <!-- Toggle browser button -->
      <NButton size="tiny" quaternary @click="showBrowser = !showBrowser" :type="showBrowser ? 'primary' : 'default'">
        文档库
      </NButton>

      <!-- Node/edge count -->
      <span class="text-[11px] text-base-content/30">
        {{ canvas.nodeCount.value }}N / {{ canvas.edgeCount.value }}E
      </span>
    </div>

    <!-- Toolbar -->
    <CanvasToolbar class="shrink-0" />

    <!-- Three-column main area -->
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <!-- Left: KB Doc Browser -->
      <KBDocBrowser
        v-if="showBrowser"
        class="w-60 shrink-0"
        @click-doc="handleBrowserClick"
      />

      <!-- Center: Canvas -->
      <div class="flex-1 relative min-w-0">
        <CanvasGraph
          :canvas-id="canvasId"
          @dirty-changed="handleDirtyChange"
        />
      </div>

      <!-- Right: Property Panel -->
      <CanvasNodePanel
        v-if="showPanel"
        class="w-72 shrink-0"
        @open-doc-detail="handleOpenDocDetail"
      />
    </div>
  </div>

  <!-- KB Document detail dialog -->
  <DocDetailDialog
    :show="showDocDetail"
    :doc-id="docDetailId"
    @update:show="(v: boolean) => showDocDetail = v"
  />
</template>
