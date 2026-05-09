<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { NButton, NInput, NColorPicker, NTag, NDivider, NSpace } from 'naive-ui'
import { AddOutline, TrashOutline } from '@vicons/ionicons5'
import type { UseCanvasReturn } from '../../../composables/useCanvas'

const canvas = inject<UseCanvasReturn>('canvas')!

const node = computed(() => canvas.selectedNode.value)
const isOpen = computed(() => node.value !== null)

// KB document node detection
const isKbNode = computed(() => {
  if (!node.value) return false
  const meta = node.value.metadata as Record<string, unknown> | undefined
  return !!(meta?.doc_id !== undefined)
})
const kbMeta = computed(() => node.value?.metadata as Record<string, unknown> | undefined)
const kbDocId = computed(() => kbMeta.value?.doc_id as number | null)

const emit = defineEmits<{
  (e: 'open-doc-detail', docId: number): void
}>()

// Custom labels/tags editing
const newLabel = ref('')
const customLabels = computed(() => {
  if (!kbMeta.value) return []
  const labels = kbMeta.value.customLabels as string[] | undefined
  return labels || []
})

function addCustomLabel() {
  if (!newLabel.value.trim() || !node.value) return
  const updated = [...customLabels.value, newLabel.value.trim()]
  updateMetadata({ ...kbMeta.value, customLabels: updated })
  newLabel.value = ''
}

function removeCustomLabel(idx: number) {
  if (!node.value) return
  const updated = [...customLabels.value]
  updated.splice(idx, 1)
  updateMetadata({ ...kbMeta.value, customLabels: updated })
}

async function updateMetadata(newMeta: Record<string, unknown>) {
  if (!node.value) return
  await canvas.updateNodeMetadata(`n-${node.value.id}`, newMeta)
}

function handleLabelChange(val: string) {
  if (!node.value) return
  canvas.updateNodeLabel(`n-${node.value.id}`, val)
}

function handleColorChange(val: string) {
  if (!node.value) return
  canvas.updateNodeColor(`n-${node.value.id}`, val)
}

function handleClose() {
  canvas.selectedNode.value = null
}

function handleDelete() {
  if (!node.value || !canvas.cy.value) return
  canvas.cy.value.getElementById(`n-${node.value.id}`).select()
  canvas.removeSelected()
}

function handleOpenDetail() {
  if (kbDocId.value) emit('open-doc-detail', kbDocId.value)
}

const REVIEW_LABELS: Record<string, string> = { mature: '成熟', developing: '完善中', seed: '草稿' }
const REVIEW_COLORS: Record<string, string> = { mature: 'success', developing: 'warning', seed: 'info' }
</script>

<template>
  <div
    v-if="isOpen && node"
    class="h-full flex flex-col bg-base-100 border-l border-base-content/10 w-72 shrink-0"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-content/5 shrink-0">
      <h3 class="font-medium text-sm">
        {{ isKbNode ? '文档详情' : '节点属性' }}
      </h3>
      <NSpace :size="4">
        <NButton v-if="!isKbNode" size="tiny" quaternary type="error" @click="handleDelete">
          <TrashOutline class="w-3.5 h-3.5" />
        </NButton>
        <NButton size="tiny" quaternary @click="handleClose">×</NButton>
      </NSpace>
    </div>

    <!-- Body -->
    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- KB Document view -->
      <template v-if="isKbNode && kbMeta">
        <!-- Title -->
        <div>
          <label class="text-[11px] text-base-content/40 block mb-0.5">标题</label>
          <div class="text-sm font-medium text-base-content leading-snug">{{ kbMeta.doc_title }}</div>
        </div>

        <!-- Badge row: category, doc_type, review_status -->
        <div class="flex flex-wrap items-center gap-1.5">
          <NTag v-if="kbMeta.doc_category" size="tiny" :bordered="false" type="info">
            {{ kbMeta.doc_category }}
          </NTag>
          <NTag v-if="kbMeta.doc_type" size="tiny" :bordered="false" type="warning">
            {{ kbMeta.doc_type }}
          </NTag>
          <NTag v-if="kbMeta.review_status" size="tiny" :bordered="false"
            :type="(REVIEW_COLORS[kbMeta.review_status as string] || 'info') as any">
            {{ REVIEW_LABELS[kbMeta.review_status as string] || kbMeta.review_status }}
          </NTag>
        </div>

        <!-- Excerpt -->
        <div v-if="kbMeta.excerpt" class="text-xs text-base-content/50 bg-base-200/50 rounded-lg p-2.5 leading-relaxed">
          {{ kbMeta.excerpt }}
        </div>

        <!-- KB Tags -->
        <div v-if="kbMeta.tags && (kbMeta.tags as string[]).length > 0">
          <label class="text-[11px] text-base-content/40 block mb-1.5">文档标签</label>
          <div class="flex flex-wrap gap-1">
            <NTag
              v-for="tag in (kbMeta.tags as string[])"
              :key="tag"
              size="tiny"
              :bordered="false"
              class="!bg-primary/10 !text-primary"
            >
              {{ tag }}
            </NTag>
          </div>
        </div>

        <NDivider />

        <!-- Custom Labels -->
        <div>
          <label class="text-[11px] text-base-content/40 block mb-1.5">自定义标签</label>
          <div class="flex flex-wrap gap-1 mb-2">
            <NTag
              v-for="(label, idx) in customLabels"
              :key="idx"
              size="tiny"
              closable
              @close="removeCustomLabel(idx)"
            >
              {{ label }}
            </NTag>
            <span v-if="customLabels.length === 0" class="text-[11px] text-base-content/20">暂无自定义标签</span>
          </div>
          <div class="flex items-center gap-1">
            <NInput
              v-model:value="newLabel"
              size="tiny"
              placeholder="添加标签..."
              style="width: 120px"
              @keyup.enter="addCustomLabel"
            />
            <NButton size="tiny" quaternary @click="addCustomLabel">
              <AddOutline class="w-3.5 h-3.5" />
            </NButton>
          </div>
        </div>

        <NDivider />

        <NButton size="small" type="primary" block @click="handleOpenDetail">
          查看完整内容
        </NButton>
      </template>

      <!-- Custom node view -->
      <template v-else>
        <div>
          <label class="text-[11px] text-base-content/40 block mb-0.5">类型</label>
          <NInput size="small" :value="node.type" disabled />
        </div>
        <div>
          <label class="text-[11px] text-base-content/40 block mb-0.5">标签</label>
          <NInput
            size="small"
            :value="node.label"
            placeholder="节点标签"
            @update:value="handleLabelChange"
          />
        </div>
        <div>
          <label class="text-[11px] text-base-content/40 block mb-0.5">颜色</label>
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
        <NButton size="small" type="error" quaternary block @click="handleDelete">删除节点</NButton>
      </template>
    </div>

    <!-- Footer: position info -->
    <div v-if="node" class="px-4 py-2 border-t border-base-content/5 text-[10px] text-base-content/25 shrink-0">
      ID: {{ node.id }} · ({{ Math.round(node.x) }}, {{ Math.round(node.y) }})
    </div>
  </div>
</template>
