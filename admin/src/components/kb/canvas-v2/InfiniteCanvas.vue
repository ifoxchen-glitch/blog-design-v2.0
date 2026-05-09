<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, inject, watch } from 'vue'
import { useMessage } from 'naive-ui'
import type { UseInfiniteCanvasReturn, CanvasElementData } from '../../../composables/useInfiniteCanvas'

const emit = defineEmits<{
  (e: 'element-selected', el: CanvasElementData): void
  (e: 'selection-cleared'): void
  (e: 'dirty-changed', dirty: boolean): void
}>()

const wrapper = ref<HTMLDivElement>()
const message = useMessage()

const canvas = inject<UseInfiniteCanvasReturn>('canvasV2')!

// Context menu state
interface CtxMenu {
  visible: boolean; x: number; y: number
  type: 'node' | 'canvas'
  elementId?: string
}
const ctxMenu = ref<CtxMenu | null>(null)
const connectSourceLocal = ref<string | null>(null)

function hideCtxMenu() { ctxMenu.value = null }

function handleContextAction(action: string) {
  if (!ctxMenu.value) return
  const elId = ctxMenu.value.elementId
  if (!elId) { hideCtxMenu(); return }

  if (action === 'edit-label') {
    const el = canvas.elements.value.get(elId)
    if (el) {
      const newLabel = window.prompt('编辑标签', el.label)
      if (newLabel !== null && newLabel !== el.label) {
        canvas.updateElement(elId, { label: newLabel })
      }
    }
  } else if (action === 'connect') {
    if (connectSourceLocal.value) {
      canvas.startConnection(connectSourceLocal.value)
      canvas.completeConnection(elId).then(ok => {
        if (ok) message.success('连线已创建')
        else message.warning('连线已存在或创建失败')
        connectSourceLocal.value = null
      })
    } else {
      connectSourceLocal.value = elId
      message.info('已选择起点，请右键点击目标节点完成连线')
    }
  } else if (action === 'delete') {
    const s = new Set(canvas.selectedIds.value)
    if (!s.has(elId)) {
      s.add(elId)
      canvas.selectedIds.value = s
    }
    canvas.removeSelected()
  }
  hideCtxMenu()
}

function handleCanvasContextAction(action: string) {
  if (!ctxMenu.value) return
  if (action === 'fit') {
    canvas.zoomToFit()
  } else if (action === 'grid') {
    canvas.layoutGrid?.()
  } else if (action === 'circle') {
    canvas.layoutCircle?.()
  }
  hideCtxMenu()
}

// Drag-drop from doc panel
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
}

async function handleDrop(e: DragEvent) {
  e.preventDefault()
  const json = e.dataTransfer?.getData('application/json')
  if (!json) return
  try {
    const doc = JSON.parse(json)
    const canvasRect = wrapper.value?.getBoundingClientRect()
    if (!canvasRect) return
    const z = canvas.zoom.value / 100
    const x = (e.clientX - canvasRect.left - canvas.panX.value) / z
    const y = (e.clientY - canvasRect.top - canvas.panY.value) / z
    const id = await canvas.addKbDoc(doc, x, y)
    if (id) message.success(`已添加「${doc.title}」`)
    else message.error('添加失败')
  } catch { /* ignore */ }
}

// Watch selection changes
watch(() => canvas.selectedIds.value, (ids) => {
  if (ids.size > 0) {
    const first = [...ids][0]
    const el = canvas.elements.value.get(first)
    if (el) emit('element-selected', el)
  } else {
    emit('selection-cleared')
  }
}, { deep: true })

watch(() => canvas.isDirty.value, (dirty) => emit('dirty-changed', dirty))

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
    canvas.removeSelected()
  }
  if (e.key === 'Escape') {
    canvas.startConnection('')
    hideCtxMenu()
  }
  // Tool shortcuts
  if (!document.activeElement?.closest('input, textarea, [contenteditable]')) {
    if (e.key === 'v' || e.key === 'V') canvas.currentTool.value = 'select'
    if (e.key === 'h' || e.key === 'H') canvas.currentTool.value = 'pan'
    if (e.key === 'n' || e.key === 'N') canvas.currentTool.value = 'note'
  }
}

// Close context menu on outside click
function handleDocClick(e: MouseEvent) {
  if (ctxMenu.value) {
    const el = e.target as HTMLElement
    if (!el.closest('.canvas-v2-ctx-menu')) {
      hideCtxMenu()
    }
  }
}

onMounted(() => {
  if (wrapper.value) {
    canvas.init(wrapper.value)
  }
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('click', handleDocClick)
  if (wrapper.value) {
    wrapper.value.addEventListener('dragover', handleDragOver)
    wrapper.value.addEventListener('drop', handleDrop)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleDocClick)
  if (wrapper.value) {
    wrapper.value.removeEventListener('dragover', handleDragOver)
    wrapper.value.removeEventListener('drop', handleDrop)
  }
  canvas.destroy()
})
</script>

<template>
  <div ref="wrapper" class="w-full h-full relative">
    <!-- Context Menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu?.visible"
        class="canvas-v2-ctx-menu fixed z-[9999] bg-base-100 border border-base-content/10 rounded-lg shadow-xl py-1 min-w-36"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @click.stop
      >
        <!-- Node context menu -->
        <template v-if="ctxMenu.type === 'node'">
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left text-base-content"
            @click="handleContextAction('edit-label')">
            编辑标签
          </button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left text-base-content"
            @click="handleContextAction('connect')">
            {{ connectSourceLocal ? '完成连线' : '从此连线' }}
          </button>
          <div class="border-t border-base-content/5 my-0.5" />
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 text-left"
            @click="handleContextAction('delete')">
            删除
          </button>
        </template>

        <!-- Canvas background context menu -->
        <template v-if="ctxMenu.type === 'canvas'">
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left text-base-content"
            @click="handleCanvasContextAction('fit')">
            适应画布
          </button>
        </template>
      </div>
    </Teleport>

    <!-- Connect mode indicator -->
    <div v-if="canvas.currentTool.value === 'connect'"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs z-50">
      连线模式: 点击第一个节点，再点击第二个节点创建连线
    </div>

    <!-- Loading overlay -->
    <div v-if="canvas.isLoading.value"
      class="absolute inset-0 flex items-center justify-center bg-base-100/50 z-50">
      <div class="text-base-content/50 text-sm">加载中...</div>
    </div>
  </div>
</template>