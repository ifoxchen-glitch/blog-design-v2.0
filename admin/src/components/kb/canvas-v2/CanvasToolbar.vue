<script setup lang="ts">
import { NButton, NSpace } from 'naive-ui'
import {
  MoveOutline, ResizeOutline, DocumentTextOutline,
  LinkOutline, TrashOutline, ExpandOutline,
  SaveOutline, AddOutline, RemoveOutline,
} from '@vicons/ionicons5'
import type { CanvasTool, UseCanvasV2Return } from '../../../composables/useCanvasV2'

const props = defineProps<{
  canvas: UseCanvasV2Return
}>()

const emit = defineEmits<{ (e: 'save'): void }>()
</script>

<template>
  <div class="flex items-center gap-1 px-2 py-1.5 bg-base-100 border-b border-base-content/10">
    <NSpace :size="2">
      <NButton size="tiny" quaternary
        :type="canvas.currentTool.value === 'select' ? 'primary' : 'default'"
        @click="canvas.currentTool.value = 'select'" title="选择 (V)">
        <MoveOutline class="w-3.5 h-3.5" />
      </NButton>
      <NButton size="tiny" quaternary
        :type="canvas.currentTool.value === 'pan' ? 'primary' : 'default'"
        @click="canvas.currentTool.value = 'pan'" title="平移 (H)">
        <ResizeOutline class="w-3.5 h-3.5" />
      </NButton>
    </NSpace>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <NButton size="tiny" quaternary
      :type="canvas.currentTool.value === 'note' ? 'primary' : 'default'"
      @click="canvas.currentTool.value = 'note'" title="便签 (N)">
      <DocumentTextOutline class="w-3.5 h-3.5" />
    </NButton>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

    <NButton size="tiny" quaternary
      :type="canvas.currentTool.value === 'connect' ? 'primary' : 'default'"
      @click="canvas.currentTool.value = canvas.currentTool.value === 'connect' ? 'select' : 'connect'" title="连线 (L)">
      <LinkOutline class="w-3.5 h-3.5" />
    </NButton>

    <NButton size="tiny" quaternary @click="canvas.removeSelected()" title="删除选中 (Del)">
      <TrashOutline class="w-3.5 h-3.5" />
    </NButton>

    <div class="w-px h-4 bg-base-content/10 mx-1" />

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

    <NButton size="tiny" type="primary" @click="emit('save')" title="保存">
      <SaveOutline class="w-3.5 h-3.5" />
    </NButton>
  </div>
</template>