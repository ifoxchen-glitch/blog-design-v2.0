<script setup lang="ts">
import { inject } from 'vue'
import { NButton, NPopover, NSpace } from 'naive-ui'
import {
  MoveOutline, ResizeOutline, DocumentTextOutline, ShapesOutline,
  LinkOutline, TrashOutline, ExpandOutline, DownloadOutline,
  SaveOutline, AddOutline, RemoveOutline,
} from '@vicons/ionicons5'
import type { CanvasTool, UseInfiniteCanvasReturn } from '../../../composables/useInfiniteCanvas'

const canvas = inject<UseInfiniteCanvasReturn>('canvasV2')!
const emit = defineEmits<{ (e: 'save'): void }>()

const tools: Array<{ tool: CanvasTool; icon: any; label: string }> = [
  { tool: 'select', icon: MoveOutline, label: '选择 (V)' },
  { tool: 'pan', icon: ResizeOutline, label: '平移 (H)' },
]

const shapes: Array<{ tool: CanvasTool; label: string }> = [
  { tool: 'rect', label: '矩形' },
  { tool: 'circle', label: '圆形' },
  { tool: 'triangle', label: '三角形' },
]

function setTool(tool: CanvasTool) {
  canvas.currentTool.value = tool
  if (canvas.fabCanvas.value) {
    canvas.fabCanvas.value.selection = tool === 'select'
    if (tool === 'pan') {
      canvas.fabCanvas.value.setCursor('grab')
    } else {
      canvas.fabCanvas.value.setCursor(tool === 'select' ? 'default' : 'crosshair')
    }
  }
}

function handleConnect() {
  if (canvas.currentTool.value === 'connect') {
    setTool('select')
    canvas.cancelConnection()
  } else {
    setTool('connect')
  }
}
</script>

<template>
  <div class="flex items-center gap-1 px-2 py-1.5 bg-base-100 border-b border-base-content/10">
    <!-- Tool buttons -->
    <NSpace :size="2">
      <NButton
        v-for="t in tools"
        :key="t.tool"
        size="tiny"
        quaternary
        :type="canvas.currentTool.value === t.tool ? 'primary' : 'default'"
        @click="setTool(t.tool)"
        :title="t.label"
      >
        <component :is="t.icon" class="w-3.5 h-3.5" />
      </NButton>
    </NSpace>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <!-- Add note -->
    <NButton size="tiny" quaternary @click="setTool('note')" title="便签 (N)"
      :type="canvas.currentTool.value === 'note' ? 'primary' : 'default'">
      <DocumentTextOutline class="w-3.5 h-3.5" />
    </NButton>

    <!-- Shapes popover -->
    <NPopover trigger="hover">
      <template #trigger>
        <NButton size="tiny" quaternary title="形状"
          :type="['rect','circle','triangle'].includes(canvas.currentTool.value) ? 'primary' : 'default'">
          <ShapesOutline class="w-3.5 h-3.5" />
        </NButton>
      </template>
      <div class="flex flex-col gap-1 p-1">
        <NButton v-for="s in shapes" :key="s.tool" size="tiny" quaternary
          @click="setTool(s.tool)" :type="canvas.currentTool.value === s.tool ? 'primary' : 'default'">
          {{ s.label }}
        </NButton>
      </div>
    </NPopover>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <!-- Connect -->
    <NButton size="tiny" quaternary @click="handleConnect" title="连线 (L)"
      :type="canvas.currentTool.value === 'connect' ? 'primary' : 'default'">
      <LinkOutline class="w-3.5 h-3.5" />
    </NButton>

    <!-- Delete selected -->
    <NButton size="tiny" quaternary @click="canvas.removeSelectedElements()" title="删除选中 (Del)">
      <TrashOutline class="w-3.5 h-3.5" />
    </NButton>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <!-- Auto-layout -->
    <NPopover trigger="hover">
      <template #trigger>
        <NButton size="tiny" quaternary title="自动布局">
          <ShapesOutline class="w-3.5 h-3.5" />
        </NButton>
      </template>
      <div class="flex flex-col gap-1 p-1">
        <NButton size="tiny" quaternary @click="canvas.layoutGrid()">网格排列</NButton>
        <NButton size="tiny" quaternary @click="canvas.layoutCircle()">环形排列</NButton>
        <NButton size="tiny" quaternary @click="canvas.layoutForce()">力导向排列</NButton>
        <NButton size="tiny" quaternary @click="canvas.zoomToFit()">适应画布</NButton>
      </div>
    </NPopover>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <!-- Zoom controls -->
    <NButton size="tiny" quaternary @click="() => {
      const c = canvas.fabCanvas.value
      if (c) {
        const z = Math.max(0.05, c.getZoom() * 0.8)
        c.setZoom(z)
        canvas.zoom.value = Math.round(z * 100)
        c.requestRenderAll()
      }
    }" title="缩小">
      <RemoveOutline class="w-3.5 h-3.5" />
    </NButton>
    <span class="text-[10px] text-base-content/50 w-10 text-center tabular-nums">{{ canvas.zoom.value }}%</span>
    <NButton size="tiny" quaternary @click="() => {
      const c = canvas.fabCanvas.value
      if (c) {
        const z = Math.min(10, c.getZoom() * 1.25)
        c.setZoom(z)
        canvas.zoom.value = Math.round(z * 100)
        c.requestRenderAll()
      }
    }" title="放大">
      <AddOutline class="w-3.5 h-3.5" />
    </NButton>
    <NButton size="tiny" quaternary @click="canvas.zoomToFit()" title="适应画布">
      <ExpandOutline class="w-3.5 h-3.5" />
    </NButton>

    <div class="flex-1" />

    <!-- Export + Save -->
    <NButton size="tiny" quaternary @click="canvas.exportPng()" title="导出 PNG">
      <DownloadOutline class="w-3.5 h-3.5" />
    </NButton>
    <NButton size="tiny" type="primary" @click="emit('save')" title="保存">
      <SaveOutline class="w-3.5 h-3.5" />
    </NButton>
  </div>
</template>
