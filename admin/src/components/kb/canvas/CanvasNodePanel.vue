<script setup lang="ts">
import { computed, inject } from 'vue'
import { NButton, NInput, NColorPicker, NDivider, NTag } from 'naive-ui'
import type { UseCanvasReturn } from '../../../composables/useCanvas'

const canvas = inject<UseCanvasReturn>('canvas')!

const node = computed(() => canvas.selectedNode.value)
const isOpen = computed(() => node.value !== null)

// KB document node detection
const isKbNode = computed(() => {
  if (!node.value) return false
  const meta = node.value.metadata as Record<string, unknown> | undefined
  return !!(meta && meta.doc_id !== undefined)
})
const kbMeta = computed(() => node.value?.metadata as Record<string, unknown> | undefined)
const kbDocId = computed(() => {
  const meta = node.value?.metadata as Record<string, unknown> | undefined
  return meta ? (meta.doc_id as number) : null
})

const emit = defineEmits<{
  (e: 'open-doc-detail', docId: number): void
}>()

function handleLabelChange(val: string) {
  if (!node.value || !canvas.cy.value) return
  canvas.updateNodeLabel(`n-${node.value.id}`, val)
}

function handleColorChange(val: string) {
  if (!node.value) return
  canvas.updateNodeColor(`n-${node.value.id}`, val)
}

function handleClose() {
  canvas.selectedNode.value = null
}

function handleOpenDetail() {
  if (kbDocId.value) {
    emit('open-doc-detail', kbDocId.value)
  }
}
</script>

<template>
  <div
    v-if="isOpen && node"
    class="w-72 shrink-0 border-l border-base-content/10 bg-base-100 overflow-y-auto"
  >
    <div class="p-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-medium text-sm">
          {{ isKbNode ? '知识库文档' : '节点属性' }}
        </h3>
        <NButton size="tiny" quaternary @click="handleClose">×</NButton>
      </div>

      <!-- KB Document view -->
      <div v-if="isKbNode && kbMeta" class="flex flex-col gap-3">
        <!-- Title -->
        <div>
          <label class="text-[11px] text-base-content/50 block mb-1">标题</label>
          <div class="text-sm font-medium text-base-content leading-snug">{{ kbMeta.doc_title }}</div>
        </div>

        <!-- Category + Type -->
        <div class="flex flex-wrap items-center gap-1.5">
          <NTag v-if="kbMeta.doc_category" size="tiny" :bordered="false" type="info">{{ kbMeta.doc_category }}</NTag>
          <NTag v-if="kbMeta.doc_type" size="tiny" :bordered="false" type="warning">{{ kbMeta.doc_type }}</NTag>
          <NTag v-if="kbMeta.review_status" size="tiny" :bordered="false" :type="kbMeta.review_status === 'mature' ? 'success' : kbMeta.review_status === 'developing' ? 'warning' : 'info'">
            {{ kbMeta.review_status === 'mature' ? '成熟' : kbMeta.review_status === 'developing' ? '完善中' : '草稿' }}
          </NTag>
        </div>

        <!-- Excerpt -->
        <div v-if="kbMeta.excerpt" class="text-xs text-base-content/50 bg-base-200/50 rounded p-2 border-l-2 border-primary">
          {{ kbMeta.excerpt }}
        </div>

        <!-- Tags -->
        <div v-if="kbMeta.tags && (kbMeta.tags as string[]).length > 0">
          <label class="text-[11px] text-base-content/50 block mb-1.5">标签</label>
          <div class="flex flex-wrap gap-1">
            <NTag
              v-for="tag in (kbMeta.tags as string[])"
              :key="tag"
              size="tiny"
              :bordered="false"
              class="bg-primary/10 text-primary"
            >
              {{ tag }}
            </NTag>
          </div>
        </div>

        <!-- View full detail button -->
        <NButton
          size="small"
          type="primary"
          block
          :disabled="!kbDocId"
          @click="handleOpenDetail"
        >
          查看完整内容
        </NButton>

        <NDivider />
      </div>

      <!-- Normal node view -->
      <div v-if="!isKbNode" class="space-y-3">
        <div>
          <label class="text-[11px] text-base-content/50 block mb-1">类型</label>
          <NInput
            size="small"
            :value="node.type"
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
      </div>

      <NDivider />

      <div class="text-[11px] text-base-content/30 space-y-1">
        <div>ID: {{ node.id }}</div>
        <div>位置: ({{ Math.round(node.x) }}, {{ Math.round(node.y) }})</div>
        <div v-if="node.width">尺寸: {{ node.width }} × {{ node.height }}</div>
      </div>
    </div>
  </div>
</template>