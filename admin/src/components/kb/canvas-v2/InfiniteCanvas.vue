<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, inject, watch, nextTick } from 'vue'
import { useMessage } from 'naive-ui'
import { PencilOutline, LinkOutline, TrashOutline } from '@vicons/ionicons5'
import type { UseInfiniteCanvasReturn, CanvasElementData } from '../../../composables/useInfiniteCanvas'
import type { KbDocumentListItem } from '../../../api/kb'

const emit = defineEmits<{
  (e: 'element-selected', el: CanvasElementData): void
  (e: 'selection-cleared'): void
  (e: 'dirty-changed', dirty: boolean): void
}>()

const canvasEl = ref<HTMLCanvasElement>()
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
    const fc = canvas.fabCanvas.value
    const obj = fc?.getObjects().find(o => (o as any).fabricId === elId)
    if (obj) {
      // For groups, find the text child and enter editing mode
      if (obj.type === 'group' || obj.type === 'activeSelection') {
        const texts = (obj as any)._objects?.filter((c: any) => c.type === 'i-text' || c.type === 'text')
        if (texts?.length > 0) {
          fc?.setActiveObject(texts[0])
          if (texts[0].enterEditing) {
            texts[0].enterEditing()
          } else {
            fc?.setActiveObject(obj)
          }
        }
      } else if ((obj as any).enterEditing) {
        fc?.setActiveObject(obj)
        ;(obj as any).enterEditing()
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
    const fc = canvas.fabCanvas.value
    const obj = fc?.getObjects().find(o => (o as any).fabricId === elId)
    if (obj) {
      fc?.setActiveObject(obj)
      canvas.removeSelectedElements()
    }
  }
  hideCtxMenu()
}

function handleCanvasContextAction(action: string) {
  if (!ctxMenu.value) return
  if (action === 'fit') {
    canvas.zoomToFit()
  } else if (action === 'grid') {
    canvas.layoutGrid()
  } else if (action === 'circle') {
    canvas.layoutCircle()
  }
  hideCtxMenu()
}

// Right-click on canvas objects
function bindCanvasContextMenu() {
  const fc = canvas.fabCanvas.value
  if (!fc) return

  // Use the Fabric canvas wrapper element for right-click detection
  const upperCanvasEl = fc.upperCanvasEl || fc.getElement()
  if (!upperCanvasEl) return

  upperCanvasEl.addEventListener('contextmenu', (e: MouseEvent) => {
    e.preventDefault()
    const pointer = fc.getScenePoint(e)
    // Find target at mouse position by checking all objects
    let target: any = null
    const objs = fc.getObjects()
    for (let i = objs.length - 1; i >= 0; i--) {
      const o = objs[i]
      if ((o as any).customType === 'connection') continue
      if (o.containsPoint(pointer)) {
        target = o
        break
      }
    }

    if (target) {
      // Find the topmost group/node
      let obj = target
      while ((obj as any).group) obj = (obj as any).group

      const elId = (obj as any).fabricId
      if (!elId) return

      ctxMenu.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: 'node',
        elementId: elId,
      }
    } else {
      ctxMenu.value = {
        visible: true,
        x: e.clientX,
        y: e.clientY,
        type: 'canvas',
      }
    }
  })
}

// Double-click to edit text
function bindDblClickEdit() {
  const fc = canvas.fabCanvas.value
  if (!fc) return

  fc.on('mouse:dblclick', (opt) => {
    const target = opt.target
    if (!target) return

    // For groups, try to find editable text child
    if ((target as any).type === 'group') {
      const texts = (target as any)._objects?.filter((c: any) =>
        c.type === 'i-text' || c.type === 'textbox'
      )
      if (texts?.length > 0) {
        fc.setActiveObject(texts[0])
        if (typeof texts[0].enterEditing === 'function') {
          texts[0].enterEditing()
          texts[0].selectAll()
        }
        return
      }
    }

    // Direct editable text
    if (typeof (target as any).enterEditing === 'function') {
      fc.setActiveObject(target)
      ;(target as any).enterEditing()
      ;(target as any).selectAll?.()
    }
  })
}

// Drag-drop from doc panel
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const json = e.dataTransfer?.getData('application/json')
  if (!json || !canvas.fabCanvas.value) return
  try {
    const doc = JSON.parse(json)
    const pointer = canvas.fabCanvas.value.getScenePoint(e)
    canvas.addKbDocElement(doc as unknown as KbDocumentListItem, pointer.x, pointer.y).then(result => {
      if (result) message.success(`已添加「${doc.title}」`)
      else message.error('添加失败')
    })
  } catch { /* ignore */ }
}

// Watch selection changes
watch(() => canvas.selectedElements.value, (els) => {
  if (els.length > 0) emit('element-selected', els[0])
  else emit('selection-cleared')
}, { deep: true })

watch(() => canvas.isDirty.value, (dirty) => emit('dirty-changed', dirty))

// Keyboard shortcuts
function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
    canvas.removeSelectedElements()
  }
  if (e.key === 'Escape') {
    canvas.cancelConnection()
    canvas.fabCanvas.value?.discardActiveObject()
    canvas.fabCanvas.value?.requestRenderAll()
    hideCtxMenu()
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

onMounted(async () => {
  await nextTick()
  if (canvasEl.value) {
    canvas.init(canvasEl.value)
    bindCanvasContextMenu()
    bindDblClickEdit()
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
    <canvas ref="canvasEl" />

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
            <PencilOutline class="w-3.5 h-3.5" />
            编辑标签
          </button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left text-base-content"
            @click="handleContextAction('connect')">
            <LinkOutline class="w-3.5 h-3.5" />
            {{ connectSourceLocal ? '完成连线' : '从此连线' }}
          </button>
          <div class="border-t border-base-content/5 my-0.5" />
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 text-left"
            @click="handleContextAction('delete')">
            <TrashOutline class="w-3.5 h-3.5" />
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
  </div>
</template>

<style scoped>
canvas {
  display: block;
}
</style>
