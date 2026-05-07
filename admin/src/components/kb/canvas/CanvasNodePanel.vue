<script setup lang="ts">
import { computed, inject } from 'vue'
import { NButton, NInput, NColorPicker, NSelect, NDivider } from 'naive-ui'
import type { UseCanvasReturn } from '../../../composables/useCanvas'

const canvas = inject<UseCanvasReturn>('canvas')!

const node = computed(() => canvas.selectedNode.value)
const isOpen = computed(() => node.value !== null)

const TYPE_OPTIONS = [
  { label: '概念', value: 'concept' },
  { label: '笔记', value: 'note' },
  { label: '术语', value: 'term' },
  { label: '引用', value: 'reference' },
]

function handleLabelChange(val: string) {
  if (!node.value || !canvas.cy.value) return
  const cyNode = canvas.cy.value.getElementById(`n-${node.value.id}`)
  if (!cyNode.length) return
  canvas.updateNodeLabel(`n-${node.value.id}`, val)
}

function handleColorChange(val: string) {
  if (!node.value) return
  canvas.updateNodeColor(`n-${node.value.id}`, val)
}

function handleClose() {
  canvas.selectedNode.value = null
}
</script>

<template>
  <div
    v-if="isOpen && node"
    class="w-72 shrink-0 border-l border-base-content/10 bg-base-100 overflow-y-auto"
  >
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-sm">节点属性</h3>
        <NButton size="tiny" quaternary @click="handleClose">×</NButton>
      </div>

      <div class="space-y-3">
        <div>
          <label class="text-[11px] text-base-content/50 block mb-1">类型</label>
          <NSelect
            size="small"
            :value="node.type"
            :options="TYPE_OPTIONS"
            disabled
          />
        </div>
        <div>
          <label class="text-[11px] text-base-content/50 block mb-1">标签</label>
          <NInput
            size="small"
            :value="node.label"
            placeholder="节点标签"
            @update:value="handleLabelChange"
          />
        </div>
        <div>
          <label class="text-[11px] text-base-content/50 block mb-1">颜色</label>
          <div class="flex items-center gap-2">
            <NColorPicker
              :value="node.color"
              size="small"
              :modes="['hex']"
              @update:value="(val: string) => handleColorChange(val)"
            />
            <span class="text-xs text-base-content/30">{{ node.color }}</span>
          </div>
        </div>
        <div>
          <label class="text-[11px] text-base-content/50 block mb-1">内容 (Markdown)</label>
          <NInput
            size="small"
            type="textarea"
            :value="node.content"
            placeholder="节点详细内容..."
            :autosize="{ minRows: 3, maxRows: 6 }"
          />
        </div>
      </div>

      <NDivider />

      <div class="text-[11px] text-base-content/30 space-y-1">
        <div>ID: {{ node.id }}</div>
        <div>位置: ({{ Math.round(node.x) }}, {{ Math.round(node.y) }})</div>
        <div>尺寸: {{ node.width }} × {{ node.height }}</div>
      </div>
    </div>
  </div>
</template>
