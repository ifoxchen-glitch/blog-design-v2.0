<script setup lang="ts">
import { computed, provide, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { NButton, useMessage } from 'naive-ui'
import { ArrowBackOutline, BookOutline } from '@vicons/ionicons5'
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
const showDebug = ref(false)
const debugLogs = ref<string[]>([])
function addLog(msg: string) {
  debugLogs.value.push(`[${new Date().toLocaleTimeString()}] ${msg}`)
  console.log(msg)
}

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

function onCanvasDirty(dirty: boolean) {
  canvas.isDirty.value = dirty
}

// Save before leaving — never blocks navigation
onBeforeRouteLeave(async (_to, _from, next) => {
  if (canvas.isDirty.value && canvas.cy.value) {
    try {
      await canvas.saveCanvas()
      canvas.isDirty.value = false
    } catch {
      console.warn('save before leave failed')
    }
  }
  next()
})

function handleBack() {
  router.push({ name: 'kb-canvases' })
}

async function handleBrowserClick(doc: KbDocumentListItem) {
  addLog(`click add: ${doc.title} (id=${doc.id})`)
  if (!canvas.cy.value) {
    addLog('  ERROR: canvas not initialized')
    message.warning('画布未初始化')
    return
  }
  const extent = canvas.cy.value.extent()
  const cx = (extent.x1 + extent.x2) / 2
  const cy_ = (extent.y1 + extent.y2) / 2
  addLog(`  position: (${Math.round(cx)}, ${Math.round(cy_)})`)
  try {
    const result = await canvas.addDocNodeWithConnections(doc, cx, cy_)
    if (result) {
      addLog(`  SUCCESS: node id=${result}`)
      message.success(`已添加「${doc.title}」`)
    } else {
      addLog(`  FAILED: addDocNodeWithConnections returned null (precondition)`)
      message.error(`添加「${doc.title}」失败`)
    }
  } catch (err: any) {
    const msg = err?.response?.data?.message || err?.message || String(err)
    addLog(`  API ERROR: ${msg}`)
    message.error(`添加「${doc.title}」失败: ${msg}`)
  }
}

// Doc detail dialog
const showDocDetail = ref(false)
const docDetailId = ref<number | null>(null)

function handleOpenDocDetail(docId: number) {
  docDetailId.value = docId
  showDocDetail.value = true
}

// Mobile detection
const isMobile = ref(false)
function checkMobile() {
  isMobile.value = window.innerWidth < 768
}
function handleGlobalKeydown(e: KeyboardEvent) {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    showDebug.value = !showDebug.value
  }
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('keydown', handleGlobalKeydown)
  startAutoSave()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (autoSaveTimer) clearInterval(autoSaveTimer)
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

      <!-- Toggle left KB doc browser -->
      <NButton size="tiny" quaternary @click="showBrowser = !showBrowser"
        :type="showBrowser ? 'primary' : 'default'">
        <BookOutline class="w-3.5 h-3.5" />
      </NButton>

      <!-- Saving progress -->
      <div v-if="canvas.isSaving.value" class="w-16 h-1.5 rounded-full bg-base-content/10 overflow-hidden">
        <div class="h-full rounded-full bg-primary transition-all duration-300" style="width:60%"></div>
      </div>

      <!-- Node/edge count -->
      <span class="text-[11px] text-base-content/50">
        {{ canvas.nodeCount.value }} · {{ canvas.edgeCount.value }}
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
          @dirty-changed="onCanvasDirty"
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

  <!-- Debug log panel (toggle with Ctrl+Shift+D) -->
  <div v-if="showDebug" class="fixed bottom-0 left-0 right-0 z-[9999] bg-black/90 text-green-400 text-[10px] font-mono p-2 max-h-40 overflow-y-auto">
    <div class="flex items-center justify-between mb-1">
      <span class="text-white/50">调试日志</span>
      <NButton size="tiny" quaternary class="!text-white/50" @click="showDebug = false">关闭</NButton>
    </div>
    <div v-for="(log, i) in debugLogs" :key="i">{{ log }}</div>
  </div>
</template>
