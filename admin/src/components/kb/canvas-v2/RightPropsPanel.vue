<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { NButton, NTag, NInput, NInputNumber, NDivider, NSpace } from 'naive-ui'
import { AddOutline, TrashOutline } from '@vicons/ionicons5'
import type { UseInfiniteCanvasReturn, CanvasElementData } from '../../../composables/useInfiniteCanvas'

const canvas = inject<UseInfiniteCanvasReturn>('canvasV2')!

const selectedId = computed<string | null>(() => {
  const ids = canvas.selectedIds.value
  return ids.size === 1 ? [...ids][0] : null
})

const el = computed<CanvasElementData | null>(() => {
  if (!selectedId.value) return null
  return canvas.elements.value.get(selectedId.value) ?? null
})

const isKbDoc = computed(() => el.value?.type === 'kb-doc')
const meta = computed(() => el.value?.metadata || {})

const emit = defineEmits<{
  (e: 'open-doc-detail', docId: number): void
  (e: 'close'): void
}>()

// Custom labels
const newLabel = ref('')
const customLabels = computed(() => (meta.value.customLabels as string[]) || [])

function addCustomLabel() {
  if (!newLabel.value.trim() || !el.value) return
  const updated = [...customLabels.value, newLabel.value.trim()]
  canvas.updateElement(el.value.id, { metadata: { ...meta.value, customLabels: updated } })
  newLabel.value = ''
}

function removeCustomLabel(idx: number) {
  if (!el.value) return
  const updated = [...customLabels.value]
  updated.splice(idx, 1)
  canvas.updateElement(el.value.id, { metadata: { ...meta.value, customLabels: updated } })
}

function handleOpenDetail() {
  const docId = meta.value.doc_id as number
  if (docId) emit('open-doc-detail', docId)
}

const REVIEW_LABELS: Record<string, string> = { mature: '成熟', developing: '完善中', seed: '草稿' }
const REVIEW_COLORS: Record<string, string> = { mature: 'success', developing: 'warning', seed: 'info' }

function handleDelete() {
  if (!el.value) return
  canvas.removeSelected()
}
</script>

<template>
  <div v-if="el" class="h-full flex flex-col bg-base-100 border-l border-base-content/10 w-72 shrink-0">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-base-content/5 shrink-0">
      <h3 class="font-medium text-sm text-base-content">{{ isKbDoc ? '文档详情' : '元素属性' }}</h3>
      <NSpace :size="4">
        <NButton size="tiny" quaternary type="error" @click="handleDelete" title="删除">
          <TrashOutline class="w-3.5 h-3.5" />
        </NButton>
        <NButton size="tiny" quaternary @click="emit('close')">×</NButton>
      </NSpace>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4">
      <!-- KB Doc view -->
      <template v-if="isKbDoc && meta">
        <div>
          <label class="text-[11px] text-base-content/40 block mb-0.5">标题</label>
          <div class="text-sm font-medium text-base-content leading-snug">{{ meta.doc_title }}</div>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <NTag v-if="meta.doc_category" size="tiny" :bordered="false" type="info">{{ meta.doc_category }}</NTag>
          <NTag v-if="meta.doc_type" size="tiny" :bordered="false" type="warning">{{ meta.doc_type }}</NTag>
          <NTag v-if="meta.review_status" size="tiny" :bordered="false"
            :type="(REVIEW_COLORS[meta.review_status as string] || 'info') as any">
            {{ REVIEW_LABELS[meta.review_status as string] || meta.review_status }}
          </NTag>
        </div>

        <div v-if="meta.excerpt" class="text-xs text-base-content/50 bg-base-200/50 rounded-lg p-2.5 leading-relaxed">
          {{ meta.excerpt }}
        </div>

        <div v-if="meta.tags && (meta.tags as string[]).length > 0">
          <label class="text-[11px] text-base-content/40 block mb-1.5">标签</label>
          <div class="flex flex-wrap gap-1">
            <NTag v-for="tag in (meta.tags as string[])" :key="tag" size="tiny" :bordered="false" class="!bg-primary/10 !text-primary">
              {{ tag }}
            </NTag>
          </div>
        </div>

        <NDivider />

        <!-- Custom Labels -->
        <div>
          <label class="text-[11px] text-base-content/40 block mb-1.5">自定义标签</label>
          <div class="flex flex-wrap gap-1 mb-2">
            <NTag v-for="(label, idx) in customLabels" :key="idx" size="tiny" closable @close="removeCustomLabel(idx)">
              {{ label }}
            </NTag>
            <span v-if="customLabels.length === 0" class="text-[11px] text-base-content/20">暂无</span>
          </div>
          <div class="flex items-center gap-1">
            <NInput v-model:value="newLabel" size="tiny" placeholder="添加标签..."
              style="width:110px" @keyup.enter="addCustomLabel" />
            <NButton size="tiny" quaternary @click="addCustomLabel"><AddOutline class="w-3 h-3" /></NButton>
          </div>
        </div>

        <NDivider />

        <NButton size="small" type="primary" block @click="handleOpenDetail">查看完整内容</NButton>
      </template>

      <!-- Non-KB element view -->
      <template v-else>
        <div>
          <label class="text-[11px] text-base-content/40 block mb-0.5">类型</label>
          <div class="text-sm text-base-content">{{ el.type === 'note' ? '便签' : el.type === 'rect' ? '矩形' : el.type === 'circle' ? '圆形' : el.type === 'triangle' ? '三角形' : el.type }}</div>
        </div>
        <div>
          <label class="text-[11px] text-base-content/40 block mb-0.5">颜色</label>
          <div class="flex items-center gap-2">
            <div class="w-5 h-5 rounded border" :style="{ background: el.color }" />
            <span class="text-xs text-base-content/50">{{ el.color }}</span>
          </div>
        </div>
        <NButton size="small" type="error" quaternary block @click="handleDelete">删除</NButton>
      </template>

      <NDivider />

      <!-- Transform (common) -->
      <div>
        <label class="text-[11px] text-base-content/40 block mb-1">变换</label>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <span class="text-[10px] text-base-content/30">X</span>
            <NInputNumber :value="Math.round(el.x)" size="tiny" disabled />
          </div>
          <div>
            <span class="text-[10px] text-base-content/30">Y</span>
            <NInputNumber :value="Math.round(el.y)" size="tiny" disabled />
          </div>
          <div>
            <span class="text-[10px] text-base-content/30">宽</span>
            <NInputNumber :value="Math.round(el.width)" size="tiny" disabled />
          </div>
          <div>
            <span class="text-[10px] text-base-content/30">高</span>
            <NInputNumber :value="Math.round(el.height)" size="tiny" disabled />
          </div>
        </div>
      </div>
    </div>

    <div class="px-4 py-2 border-t border-base-content/5 text-[10px] text-base-content/25 shrink-0">
      ID: {{ el.id }} · {{ el.type }}
    </div>
  </div>

  <!-- Empty state -->
  <div v-else class="h-full flex flex-col bg-base-100 border-l border-base-content/10 w-72 shrink-0 items-center justify-center">
    <span class="text-xs text-base-content/20">选择元素以查看属性</span>
  </div>
</template>