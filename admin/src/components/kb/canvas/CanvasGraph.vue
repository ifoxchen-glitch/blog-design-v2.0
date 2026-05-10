<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, inject, watch, nextTick } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { TrashOutline, LinkOutline, PencilOutline } from '@vicons/ionicons5'
import type { UseCanvasReturn } from '../../../composables/useCanvas'

const emit = defineEmits<{
  (e: 'node-click', node: Record<string, unknown>): void
  (e: 'node-dblclick', node: Record<string, unknown>): void
  (e: 'edge-click', edge: Record<string, unknown>): void
  (e: 'canvas-click'): void
  (e: 'dirty-changed', dirty: boolean): void
}>()

const container = ref<HTMLDivElement>()
const message = useMessage()

const canvas = inject<UseCanvasReturn>('canvas')!

// Context menu state
const ctxMenu = ref<{
  visible: boolean
  x: number
  y: number
  targetType: 'node' | 'edge' | 'canvas'
  targetId: string | null
  modelPos?: { x: number; y: number }
} | null>(null)

// Connect mode: first selected node
const connectSource = ref<string | null>(null)

function dbNodeId(cyId: string): number {
  return Number(cyId.replace('n-', ''))
}

function dbEdgeId(cyId: string): number {
  return Number(cyId.replace('e-', ''))
}

function hideCtxMenu() {
  ctxMenu.value = null
}

function handleContextNodeAction(action: string) {
  if (!ctxMenu.value || !ctxMenu.value.targetId) return
  const nodeId = ctxMenu.value.targetId

  if (action === 'edit-label') {
    const labelNode = canvas.cy.value?.getElementById(nodeId)
    if (labelNode && labelNode.isNode()) {
      const currentLabel = (labelNode.data('label') as string) || ''
      const newLabel = prompt('输入节点标签:', currentLabel)
      if (newLabel !== null && newLabel !== currentLabel) {
        canvas.updateNodeLabel(nodeId, newLabel)
      }
    }
  } else if (action === 'connect') {
    if (connectSource.value) {
      // Second node clicked — create edge
      canvas.addEdge(connectSource.value, nodeId).then((ok) => {
        if (ok) {
          message.success('连线已创建')
        } else {
          message.warning('连线已存在或创建失败')
        }
        connectSource.value = null
      })
    } else {
      connectSource.value = nodeId
      message.info('已选择起点，请点击目标节点完成连线')
    }
  } else if (action === 'delete') {
    canvas.cy.value?.getElementById(nodeId)?.select()
    canvas.removeSelected()
  }

  hideCtxMenu()
}

function handleContextCanvasAction(type: string, modelPos: { x: number; y: number }) {
  if (!canvas.cy.value) return
  canvas.addNode(type, modelPos.x, modelPos.y)
  hideCtxMenu()
}

function handleAddNodeAtCtx(type: string) {
  const pos = ctxMenu.value?.modelPos ?? { x: 0, y: 0 }
  handleContextCanvasAction(type, pos)
}

function handleFitAndClose() {
  canvas.fitToScreen()
  hideCtxMenu()
}

function handleDeleteCtxEdge() {
  if (ctxMenu.value?.targetId) {
    canvas.cy.value?.getElementById(ctxMenu.value.targetId)?.select()
    canvas.removeSelected()
    hideCtxMenu()
  }
}

function bindEvents() {
  const cy = canvas.cy.value
  if (!cy) return

  // Left-click events
  cy.on('tap', 'node', (evt: { target: { id: () => string; data: (key: string) => unknown; position: () => { x: number; y: number } } }) => {
    hideCtxMenu()
    const n = evt.target
    const nodeId = n.id()

    // Connect mode: first click sets source, second click creates edge
    if (canvas.connectMode.value) {
      if (connectSource.value) {
        if (connectSource.value === nodeId) {
          message.warning('不能连接自身')
          return
        }
        canvas.addEdge(connectSource.value, nodeId).then((ok) => {
          if (ok) message.success('连线已创建')
          else message.warning('连线已存在或创建失败')
          connectSource.value = null
        })
      } else {
        connectSource.value = nodeId
        message.info('已选择起点，请点击目标节点完成连线')
      }
      return
    }

    emit('node-click', {
      id: dbNodeId(nodeId),
      type: n.data('type'),
      label: n.data('label'),
      content: n.data('content'),
      x: n.position().x,
      y: n.position().y,
      width: n.data('width'),
      height: n.data('height'),
      color: n.data('color'),
      metadata: n.data('metadata'),
      sort_order: n.data('sort_order'),
      created_at: n.data('created_at'),
      updated_at: n.data('updated_at'),
    })
  })

  cy.on('dbltap', 'node', (evt: { target: { id: () => string; data: (key: string) => unknown; position: () => { x: number; y: number } } }) => {
    hideCtxMenu()
    const n = evt.target
    emit('node-dblclick', {
      id: dbNodeId(n.id()),
      type: n.data('type'),
      label: n.data('label'),
      content: n.data('content'),
      x: n.position().x,
      y: n.position().y,
      width: n.data('width'),
      height: n.data('height'),
      color: n.data('color'),
      metadata: n.data('metadata'),
      sort_order: n.data('sort_order'),
      created_at: n.data('created_at'),
      updated_at: n.data('updated_at'),
    })
  })

  cy.on('tap', 'edge', (evt: { target: { id: () => string; data: (key: string) => unknown } }) => {
    hideCtxMenu()
    const e = evt.target
    emit('edge-click', {
      id: dbEdgeId(e.id()),
      source_node_id: dbNodeId(e.data('source') as string),
      target_node_id: dbNodeId(e.data('target') as string),
      label: e.data('label'),
      style: e.data('style'),
      created_at: e.data('created_at'),
      updated_at: e.data('updated_at'),
    })
  })

  cy.on('tap', (evt: { target: unknown }) => {
    hideCtxMenu()
    // In connect mode, clicking background cancels the pending source
    if (!canvas.connectMode.value) {
      connectSource.value = null
    }
    if (evt.target === cy) {
      emit('canvas-click')
    }
  })

  // Right-click (context menu) events
  cy.on('cxttap', 'node', (evt: { target: { id: () => string }; renderedPosition: { x: number; y: number }; originalEvent: MouseEvent }) => {
    evt.originalEvent.preventDefault()
    const id = evt.target.id()
    ctxMenu.value = {
      visible: true,
      x: evt.originalEvent.clientX,
      y: evt.originalEvent.clientY,
      targetType: 'node',
      targetId: id,
    }
  })

  cy.on('cxttap', 'edge', (evt: { target: { id: () => string }; originalEvent: MouseEvent }) => {
    evt.originalEvent.preventDefault()
    ctxMenu.value = {
      visible: true,
      x: evt.originalEvent.clientX,
      y: evt.originalEvent.clientY,
      targetType: 'edge',
      targetId: evt.target.id(),
    }
  })

  cy.on('cxttap', (evt: { target: unknown; position: { x: number; y: number }; originalEvent: MouseEvent }) => {
    if (evt.target === cy) {
      evt.originalEvent.preventDefault()
      hideCtxMenu()
      connectSource.value = null
      ctxMenu.value = {
        visible: true,
        x: evt.originalEvent.clientX,
        y: evt.originalEvent.clientY,
        targetType: 'canvas',
        targetId: null,
        modelPos: { x: evt.position.x, y: evt.position.y },
      }
    }
  })

  // Dirty tracking
  cy.on('add remove dragfree', () => {
    emit('dirty-changed', true)
  })
}

// Close context menu on any click outside
function handleDocumentClick(e: MouseEvent) {
  if (ctxMenu.value) {
    const el = e.target as HTMLElement
    if (!el.closest('.canvas-ctx-menu')) {
      hideCtxMenu()
    }
  }
}

// Edge connect mode: click node to complete connection
watch(() => canvas.connectMode.value, (active) => {
  if (!active) {
    connectSource.value = null
  }
})

// Drag-and-drop from KB doc browser
function handleDragOver(e: DragEvent) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'copy'
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const json = e.dataTransfer?.getData('application/json')
  if (!json) { console.warn('[drop] no json data'); return }
  if (!canvas.cy.value) { console.warn('[drop] cy not ready'); return }
  try {
    const doc = JSON.parse(json) as { id: number; title: string; category: string | null; doc_type: string | null; review_status: string | null; excerpt: string | null; tags: string[]; slug: string }
    console.log('[drop] doc:', doc.title, 'at', e.clientX, e.clientY)
    const rect = container.value!.getBoundingClientRect()
    const modelPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
    const pan = canvas.cy.value.pan()
    const zoom = canvas.cy.value.zoom()
    const x = (modelPos.x - pan.x) / zoom
    const y = (modelPos.y - pan.y) / zoom
    console.log('[drop] modelPos:', modelPos, 'pan:', pan, 'zoom:', zoom, '->', x, y)
    canvas.addDocNodeWithConnections(doc as any, x, y).then((result) => {
      console.log('[drop] result:', result)
      if (result) message.success(`已添加「${doc.title}」`)
      else message.error(`添加「${doc.title}」失败`)
    })
  } catch (e) {
    console.error('[drop] parse/process error:', e)
  }
}

// Global keyboard shortcuts
function handleGlobalKeydown(e: KeyboardEvent) {
  const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
  if (isInput) return

  // Ctrl+Z: Undo
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault()
    canvas.undo()
    return
  }
  // Ctrl+Y: Redo
  if (e.ctrlKey && e.key === 'y') {
    e.preventDefault()
    canvas.redo()
    return
  }
  // F: Fit to screen
  if (e.key === 'f' || e.key === 'F') {
    canvas.fitToScreen()
    e.preventDefault()
  }
}

onMounted(async () => {
  await nextTick()
  if (!container.value) return
  try {
    canvas.init(container.value)
  } catch (e) {
    console.error('canvas init failed:', e)
    return
  }
  try {
    await canvas.loadCanvas(canvas.canvasId.value)
  } catch (e) {
    console.error('canvas load failed:', e)
  }
  bindEvents()
  // Set up drag-drop
  container.value.addEventListener('dragover', handleDragOver)
  container.value.addEventListener('drop', handleDrop)
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleGlobalKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleGlobalKeydown)
  if (container.value) {
    container.value.removeEventListener('dragover', handleDragOver)
    container.value.removeEventListener('drop', handleDrop)
  }
  try {
    canvas.destroy()
  } catch (e) {
    console.error('canvas destroy failed:', e)
  }
})
</script>

<template>
  <div ref="container" class="w-full h-full absolute inset-0" />

  <!-- Context Menu -->
  <Teleport to="body">
    <div
      v-if="ctxMenu?.visible"
      class="canvas-ctx-menu fixed z-[9999] bg-base-100 border border-base-content/10 rounded-lg shadow-xl py-1 min-w-36"
      :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      @click.stop
    >
      <!-- Node context menu -->
      <template v-if="ctxMenu.targetType === 'node'">
        <button
          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left"
          @click="handleContextNodeAction('edit-label')"
        >
          <PencilOutline class="w-3.5 h-3.5" />
          编辑标签
        </button>
        <button
          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left"
          @click="handleContextNodeAction('connect')"
        >
          <LinkOutline class="w-3.5 h-3.5" />
          {{ connectSource ? '完成连线' : '从此节点连线' }}
        </button>
        <div class="border-t border-base-content/5 my-0.5" />
        <button
          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 text-left"
          @click="handleContextNodeAction('delete')"
        >
          <TrashOutline class="w-3.5 h-3.5" />
          删除节点
        </button>
      </template>

      <!-- Edge context menu -->
      <template v-if="ctxMenu.targetType === 'edge'">
        <button
          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-red-50 text-red-600 text-left"
          @click="handleDeleteCtxEdge"
        >
          <TrashOutline class="w-3.5 h-3.5" />
          删除连线
        </button>
      </template>

      <!-- Canvas background context menu -->
      <template v-if="ctxMenu.targetType === 'canvas'">
        <button
          v-for="nt in [{ type: 'concept', label: '概念', icon: '◆' }, { type: 'note', label: '笔记', icon: '◼' }, { type: 'term', label: '术语', icon: '▲' }, { type: 'reference', label: '引用', icon: '●' }, { type: 'text', label: '文本', icon: '▬' }, { type: 'rect', label: '矩形', icon: '▭' }, { type: 'circle', label: '圆形', icon: '○' }, { type: 'triangle', label: '三角形', icon: '△' }]"
          :key="nt.type"
          class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left"
          @click="handleAddNodeAtCtx(nt.type)"
        >
          <span class="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px]">{{ nt.icon }}</span>
          添加{{ nt.label }}
        </button>

        <!-- Alignment tools (visible when 2+ nodes selected) -->
        <div v-if="canvas.cy.value && canvas.cy.value.nodes(':selected').length >= 2" class="border-t border-base-content/5 my-0.5" />
        <template v-if="canvas.cy.value && canvas.cy.value.nodes(':selected').length >= 2">
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.alignLeft(); hideCtxMenu()">左对齐</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.alignRight(); hideCtxMenu()">右对齐</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.alignTop(); hideCtxMenu()">上对齐</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.alignBottom(); hideCtxMenu()">下对齐</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.alignCenter(); hideCtxMenu()">垂直居中</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.alignMiddle(); hideCtxMenu()">水平居中</button>
          <div class="border-t border-base-content/5 my-0.5" />
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.distributeHorizontally(); hideCtxMenu()">横向分布</button>
          <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="canvas.distributeVertically(); hideCtxMenu()">纵向分布</button>
        </template>

        <div class="border-t border-base-content/5 my-0.5" />
        <button class="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-base-200/50 text-left" @click="handleFitAndClose()">适应屏幕</button>
      </template>
    </div>
  </Teleport>

  <!-- Connect mode indicator -->
  <div
    v-if="connectSource"
    class="absolute bottom-4 left-1/2 -translate-x-1/2 bg-primary text-primary-content px-4 py-2 rounded-lg shadow-lg text-xs z-50 flex items-center gap-2"
  >
    <LinkOutline class="w-4 h-4" />
    已选择起点节点,请点击目标节点创建连线
    <NButton size="tiny" quaternary @click="connectSource = null">取消</NButton>
  </div>
</template>
