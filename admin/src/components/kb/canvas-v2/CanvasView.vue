<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useMessage } from 'naive-ui'
import { PencilOutline, LinkOutline, TrashOutline } from '@vicons/ionicons5'
import type { UseCanvasV2Return, CanvasElementData } from '../../../composables/useCanvasV2'

const props = defineProps<{
  canvas: UseCanvasV2Return
}>()

const emit = defineEmits<{
  (e: 'element-selected', el: CanvasElementData): void
  (e: 'selection-cleared'): void
}>()

const message = useMessage()
const wrapper = ref<HTMLDivElement>()

// Context menu
const ctxMenu = ref<{ visible: boolean; x: number; y: number; type: 'node' | 'canvas'; elementId?: string } | null>(null)
const connectSource = ref<string | null>(null)

function hideCtxMenu() { ctxMenu.value = null }

function handleCtxAction(action: string) {
  const m = ctxMenu.value
  if (!m) return
  const elId = m.elementId
  if (!elId) { hideCtxMenu(); return }

  if (action === 'edit-label') {
    const el = props.canvas.elements.value.get(elId)
    if (el) {
      const newLabel = window.prompt('编辑标签', el.label)
      if (newLabel !== null && newLabel !== el.label) {
        props.canvas.updateElement(elId, { label: newLabel })
      }
    }
  } else if (action === 'connect') {
    if (connectSource.value) {
      props.canvas.startConnection(connectSource.value)
      props.canvas.completeConnection(elId).then(ok => {
        if (ok) message.success('连线已创建')
        else message.warning('连线已存在或创建失败')
        connectSource.value = null
      })
    } else {
      connectSource.value = elId
      message.info('已选择起点，请右键点击目标节点完成连线')
    }
  } else if (action === 'delete') {
    const s = new Set(props.canvas.selectedIds.value)
    if (!s.has(elId)) { s.add(elId) }
    props.canvas.selectedIds.value = s
    props.canvas.removeSelected()
  }
  hideCtxMenu()
}

function handleCanvasCtxAction(action: string) {
  if (action === 'fit') props.canvas.zoomToFit()
  hideCtxMenu()
}

// Drag-drop from doc panel
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const json = e.dataTransfer?.getData('application/json')
  if (!json) return
  try {
    const doc = JSON.parse(json)
    const rect = wrapper.value?.getBoundingClientRect()
    if (!rect) return
    const z = props.canvas.zoom.value / 100
    const x = (e.clientX - rect.left - props.canvas.panX.value) / z
    const y = (e.clientY - rect.top - props.canvas.panY.value) / z
    props.canvas.addKbDoc(doc, x, y).then(id => {
      if (id) message.success(`已添加「${doc.title}」`)
      else message.error('添加失败')
    })
  } catch { /* ignore */ }
}

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
    props.canvas.removeSelected()
  }
  if (e.key === 'Escape') {
    props.canvas.startConnection('')
    hideCtxMenu()
  }
  if (!document.activeElement?.closest('input, textarea, [contenteditable]')) {
    if (e.key === 'v' || e.key === 'V') props.canvas.currentTool.value = 'select'
    if (e.key === 'h' || e.key === 'H') props.canvas.currentTool.value = 'pan'
    if (e.key === 'n' || e.key === 'N') props.canvas.currentTool.value = 'note'
  }
}

function handleDocClick(e: MouseEvent) {
  if (ctxMenu.value && !(e.target as HTMLElement).closest('.canvas-ctx-menu')) {
    hideCtxMenu()
  }
}

onMounted(() => {
  if (wrapper.value) {
    props.canvas.init(wrapper.value)
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
  props.canvas.destroy()
})
</script>

<template>
  <div ref="wrapper" class="w-full h-full relative">
    <Teleport to="body">
      <div v-if="ctxMenu?.visible"
        class="canvas-ctx-menu fixed z-[9999] bg-base-100 border border-base-content/10 rounded-lg shadow-xl py-1 min-w-36"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }" @click.stop>
        <template v-if="ctxMenu.type === 'node'">
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left text-base-content"
            @click="handleCtxAction('edit-label')">
            <PencilOutline class="w-3.5 h-3.5" /> 编辑标签
          </button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left text-base-content"
            @click="handleCtxAction('connect')">
            <LinkOutline class="w-3.5 h-3.5" />
            {{ connectSource ? '完成连线' : '从此连线' }}
          </button>
          <div class="border-t border-base-content/5 my-0.5" />
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 text-left"
            @click="handleCtxAction('delete')">
            <TrashOutline class="w-3.5 h-3.5" /> 删除
          </button>
        </template>
        <template v-if="ctxMenu.type === 'canvas'">
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left text-base-content"
            @click="handleCanvasCtxAction('fit')">适应画布</button>
        </template>
      </div>
    </Teleport>

    <div v-if="canvas.currentTool.value === 'connect'"
      class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg text-xs z-50">
      连线模式: 点击第一个节点，再点击第二个节点创建连线
    </div>

    <div v-if="canvas.isLoading.value"
      class="absolute inset-0 flex items-center justify-center bg-base-100/50 z-50">
      <div class="text-base-content/50 text-sm">加载中...</div>
    </div>
  </div>
</template>