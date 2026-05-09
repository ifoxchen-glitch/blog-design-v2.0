<script setup lang="ts">
import { inject } from 'vue'
import { NButton, NSpace } from 'naive-ui'
import {
  MoveOutline, ResizeOutline, DocumentTextOutline,
  LinkOutline, TrashOutline, ExpandOutline,
  SaveOutline, AddOutline, RemoveOutline,
} from '@vicons/ionicons5'
import type { CanvasTool, UseInfiniteCanvasReturn } from '../../../composables/useInfiniteCanvas'

const canvas = inject<UseInfiniteCanvasReturn>('canvasV2')!
const emit = defineEmits<{ (e: 'save'): void }>()

const tools: Array<{ tool: Exclude<CanvasTool, 'note' | 'connect'>; icon: any; label: string }> = [
  { tool: 'select', icon: MoveOutline, label: '选择 (V)' },
  { tool: 'pan', icon: ResizeOutline, label: '平移 (H)' },
]

function setTool(tool: CanvasTool) {
  canvas.currentTool.value = tool
}

function handleConnect() {
  if (canvas.currentTool.value === 'connect') {
    canvas.currentTool.value = 'select'
  } else {
    canvas.currentTool.value = 'connect'
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

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <!-- Connect -->
    <NButton size="tiny" quaternary @click="handleConnect" title="连线 (L)"
      :type="canvas.currentTool.value === 'connect' ? 'primary' : 'default'">
      <LinkOutline class="w-3.5 h-3.5" />
    </NButton>

    <!-- Delete selected -->
    <NButton size="tiny" quaternary @click="canvas.removeSelected()" title="删除选中 (Del)">
      <TrashOutline class="w-3.5 h-3.5" />
    </NButton>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <!-- Zoom controls -->
    <NButton size="tiny" quaternary @click="canvas.zoomOut()" title="缩小">
      <RemoveOutline class="w-3.5 h-3.5" />
    </NButton>
    <span class="text-[10px] text-base-content/50 w-10 text-center tabular-nums">{{ canvas.zoom.value }}%</span>
    <NButton size="tiny" quaternary @click="canvas.zoomIn()" title="放大">
      <AddOutline class="w-3.5 h-3.5" />
    </NButton>
    <NButton size="tiny" quaternary @click="canvas.zoomToFit()" title="适应画布">
      <ExpandOutline class="w-3.5 h-3.5" />
    </NButton>

    <div class="flex-1" />

    <!-- Export + Save -->
    <NButton size="tiny" quaternary @click="emit('save')" title="保存">
      <SaveOutline class="w-3.5 h-3.5" />
    </NButton>
  </div>
</template>