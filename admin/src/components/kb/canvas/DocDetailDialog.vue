<script setup lang="ts">
import { ref, watch } from 'vue'
import { NModal, NTag, NSpin, NEmpty } from 'naive-ui'
import { LinkOutline, DocumentOutline, TimeOutline, PricetagOutline } from '@vicons/ionicons5'
import { apiGetKbDocument } from '../../../api/kb'
import type { KbDocumentDetail } from '../../../api/kb'

const props = defineProps<{
  show: boolean
  docId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void
}>()

const doc = ref<KbDocumentDetail | null>(null)
const loading = ref(false)

async function loadDoc() {
  if (!props.docId) return
  loading.value = true
  try {
    doc.value = await apiGetKbDocument(props.docId)
  } catch {
    doc.value = null
  } finally {
    loading.value = false
  }
}

watch(() => props.show, (val) => {
  if (val) {
    doc.value = null
    loadDoc()
  }
})

function reviewLabel(s: string | null): string {
  if (s === 'mature') return '成熟'
  if (s === 'developing') return '完善中'
  if (s === 'seed') return '草稿'
  return ''
}
function reviewColor(s: string | null): string {
  if (s === 'mature') return 'success'
  if (s === 'developing') return 'warning'
  if (s === 'seed') return 'info'
  return 'default'
}
function docTypeLabel(s: string | null): string {
  if (s === 'entity') return '实体'
  if (s === 'concept') return '概念'
  if (s === 'source') return '来源'
  if (s === 'synthesis') return '综合'
  return s ?? ''
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :style="{ width: '680px', maxHeight: '80vh' }"
    :title="doc?.title ?? '文档详情'"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <NSpin :show="loading">
      <NEmpty v-if="!loading && !doc" description="无法加载文档" class="py-8" />

      <div v-else-if="doc" class="flex flex-col gap-4 overflow-y-auto max-h-[60vh] pr-2">
        <!-- Meta tags -->
        <div class="flex flex-wrap items-center gap-2">
          <NTag v-if="doc.category" size="small" :bordered="false" type="info">
            <template #icon><DocumentOutline class="w-3 h-3 mr-1" /></template>
            {{ doc.category }}
          </NTag>
          <NTag v-if="doc.doc_type" size="small" :bordered="false" type="warning">{{ docTypeLabel(doc.doc_type) }}</NTag>
          <NTag v-if="doc.review_status" size="small" :bordered="false" :type="reviewColor(doc.review_status) as any">{{ reviewLabel(doc.review_status) }}</NTag>
          <NTag v-if="doc.word_count" size="small" :bordered="false">{{ doc.word_count }} 字</NTag>
          <NTag v-if="doc.doc_date" size="small" :bordered="false">
            <template #icon><TimeOutline class="w-3 h-3 mr-1" /></template>
            {{ doc.doc_date }}
          </NTag>
        </div>

        <!-- Excerpt -->
        <div v-if="doc.excerpt" class="text-sm text-base-content/60 bg-base-200/30 rounded p-3 border-l-2 border-primary">
          {{ doc.excerpt }}
        </div>

        <!-- Connections -->
        <div v-if="doc.connections && doc.connections.length > 0">
          <div class="flex items-center gap-1.5 text-xs text-base-content/50 mb-2">
            <LinkOutline class="w-3.5 h-3.5" />
            <span>引用关键词条</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <NTag
              v-for="conn in doc.connections"
              :key="conn"
              size="small"
              :bordered="false"
              type="success"
              round
            >
              {{ conn }}
            </NTag>
          </div>
        </div>

        <!-- Sources -->
        <div v-if="doc.sources && doc.sources.length > 0">
          <div class="flex items-center gap-1.5 text-xs text-base-content/50 mb-2">
            <DocumentOutline class="w-3.5 h-3.5" />
            <span>参考来源</span>
          </div>
          <div class="flex flex-col gap-1">
            <a
              v-for="src in doc.sources"
              :key="src"
              :href="src"
              target="_blank"
              class="text-xs text-primary hover:underline truncate"
            >
              {{ src }}
            </a>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="doc.tags && doc.tags.length > 0">
          <div class="flex items-center gap-1.5 text-xs text-base-content/50 mb-2">
            <PricetagOutline class="w-3.5 h-3.5" />
            <span>标签</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <NTag
              v-for="tag in doc.tags"
              :key="tag"
              size="small"
              :bordered="false"
              class="bg-primary/10 text-primary"
            >
              {{ tag }}
            </NTag>
          </div>
        </div>

        <!-- Content -->
        <div v-if="doc.content_markdown" class="border-t border-base-content/5 pt-4">
          <div class="text-xs text-base-content/50 mb-2">正文内容</div>
          <div
            class="prose prose-sm max-w-none text-base-content/80"
            v-html="doc.content_html || doc.content_markdown"
          />
        </div>
      </div>
    </NSpin>
  </NModal>
</template>