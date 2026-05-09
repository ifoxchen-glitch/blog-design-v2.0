<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, inject, watch, nextTick } from 'vue'
import { useMessage } from 'naive-ui'
import type { UseInfiniteCanvasReturn, CanvasElementData } from '../../../composables/useInfiniteCanvas'
import type { KbDocumentListItem } from '../../../api/kb'

const emit = defineEmits<{
  (e: 'element-selected', el: CanvasElementData): void
  (e: 'selection-cleared'): void
  (e: 'connection-created', conn: { fromId: string; toId: string }): void
  (e: 'dirty-changed', dirty: boolean): void
}>()

const canvasEl = ref<HTMLCanvasElement>()
const wrapper = ref<HTMLDivElement>()
const message = useMessage()

const canvas = inject<UseInfiniteCanvasReturn>('canvasV2')!

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
    const doc = JSON.parse(json) as { id: number; title: string; category: string | null; doc_type: string | null; review_status: string | null; excerpt: string | null; tags: string[]; slug: string }
    const pointer = canvas.fabCanvas.value.getScenePoint(e)
    canvas.addKbDocElement(doc as unknown as KbDocumentListItem, pointer.x, pointer.y).then(result => {
      if (result) message.success(`已添加「${doc.title}」`)
      else message.error('添加失败')
    })
  } catch { /* ignore */ }
}

// Watch selection changes
watch(() => canvas.selectedElements.value, (els) => {
  if (els.length > 0) {
    emit('element-selected', els[0])
  } else {
    emit('selection-cleared')
  }
}, { deep: true })

// Dirty tracking
watch(() => canvas.isDirty.value, (dirty) => {
  emit('dirty-changed', dirty)
})

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
  }
  if (e.key === 'a' && e.ctrlKey) {
    e.preventDefault()
    // Select all elements on canvas
    const fc = canvas.fabCanvas.value
    if (fc) {
      const objs = fc.getObjects().filter(o => (o as any).customType !== 'connection')
      if (objs.length > 0) {
        const sel = new (window as any).fabric.ActiveSelection(objs, { canvas: fc })
        fc.setActiveObject(sel)
        fc.requestRenderAll()
      }
    }
  }
}

onMounted(async () => {
  await nextTick()
  if (canvasEl.value) {
    canvas.init(canvasEl.value)
  }
  window.addEventListener('keydown', handleKeydown)
  if (wrapper.value) {
    wrapper.value.addEventListener('dragover', handleDragOver)
    wrapper.value.addEventListener('drop', handleDrop)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (wrapper.value) {
    wrapper.value.removeEventListener('dragover', handleDragOver)
    wrapper.value.removeEventListener('drop', handleDrop)
  }
  canvas.destroy()
})
</script>

<template>
  <div ref="wrapper" class="w-full h-full">
    <canvas ref="canvasEl" />
  </div>
</template>

<style scoped>
canvas {
  display: block;
}
</style>
