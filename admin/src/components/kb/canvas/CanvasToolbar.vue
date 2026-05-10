<script setup lang="ts">
import { inject } from 'vue'
import { NButton, NPopover, useMessage } from 'naive-ui'
import {
  TrashOutline,
  ExpandOutline,
  SaveOutline,
  DownloadOutline,
  LinkOutline,
} from '@vicons/ionicons5'
import type { UseCanvasReturn } from '../../../composables/useCanvas'

const canvas = inject<UseCanvasReturn>('canvas')!
const message = useMessage()

async function handleAddNode(type: string) {
  if (!canvas.cy.value) return
  const extent = canvas.cy.value.extent()
  const cx = (extent.x1 + extent.x2) / 2
  const cy_ = (extent.y1 + extent.y2) / 2
  const jitter = (Math.random() - 0.5) * 100
  const result = await canvas.addNode(type, cx + jitter, cy_ + jitter)
  if (result) message.success('已添加节点')
}

async function handleRemove() {
  await canvas.removeSelected()
}

function handleLayout(name: 'cose-bilkent' | 'circle' | 'concentric' | 'grid') {
  canvas.runLayout(name)
}

async function handleSave() {
  await canvas.saveCanvas()
  message.success('已保存')
  canvas.isDirty.value = false
}

function handleExportPng() {
  canvas.exportPng()
  message.success('画布已导出为 PNG')
}

function handleToggleConnect() {
  canvas.connectMode.value = !canvas.connectMode.value
  if (canvas.connectMode.value) {
    message.info('连线模式: 点击一个节点作为起点,再点击另一个节点创建连线')
  }
}

const NODE_TYPES = [
  { type: 'concept', label: '概念', color: '#6366f1' },
  { type: 'note', label: '笔记', color: '#f59e0b' },
  { type: 'term', label: '术语', color: '#10b981' },
  { type: 'reference', label: '引用', color: '#3b82f6' },
]

const LAYOUT_OPTIONS = [
  { name: 'cose-bilkent' as const, label: '力导向' },
  { name: 'circle' as const, label: '环形' },
  { name: 'concentric' as const, label: '同心圆' },
  { name: 'grid' as const, label: '网格' },
]
</script>

<template>
  <div class="flex items-center gap-2 px-3 py-2 bg-base-100 border-b border-base-content/10">
    <div class="flex items-center gap-1">
      <NButton
        v-for="nt in NODE_TYPES"
        :key="nt.type"
        size="tiny"
        quaternary
        @click="handleAddNode(nt.type)"
      >
        +{{ nt.label }}
      </NButton>
    </div>

    <div class="w-px h-5 bg-base-content/10" />

    <NPopover trigger="hover">
      <template #trigger>
        <NButton size="tiny" quaternary>布局</NButton>
      </template>
      <div class="flex flex-col gap-1 p-1">
        <NButton
          v-for="lo in LAYOUT_OPTIONS"
          :key="lo.name"
          size="tiny"
          quaternary
          @click="handleLayout(lo.name)"
        >
          {{ lo.label }}
        </NButton>
      </div>
    </NPopover>

    <NButton size="tiny" quaternary @click="canvas.fitToScreen()" title="适应屏幕">
      <ExpandOutline class="w-4 h-4" />
    </NButton>

    <NButton
      size="tiny"
      :type="canvas.connectMode.value ? 'primary' : 'default'"
      quaternary
      @click="handleToggleConnect"
      title="连线模式"
    >
      <LinkOutline class="w-4 h-4" />
    </NButton>

    <div class="w-px h-5 bg-base-content/10" />

    <NButton size="tiny" quaternary @click="handleRemove" title="删除选中">
      <TrashOutline class="w-4 h-4" />
    </NButton>

    <NButton size="tiny" quaternary @click="handleExportPng" title="导出 PNG">
      <DownloadOutline class="w-4 h-4" />
    </NButton>

    <div class="flex-1" />

    <span class="text-[11px] text-base-content/30">
      {{ canvas.nodeCount.value }} 节点 / {{ canvas.edgeCount.value }} 连线
    </span>
    <span
      v-if="canvas.isDirty.value"
      class="text-[11px] text-warning"
    >
      未保存
    </span>

    <NButton size="tiny" type="primary" @click="handleSave" title="保存">
      <SaveOutline class="w-4 h-4" />
    </NButton>
  </div>
</template>
