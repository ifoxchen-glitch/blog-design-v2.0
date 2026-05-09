<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue'
import { NInput, NTag, NSpin, useMessage } from 'naive-ui'
import { SearchOutline, ChevronDownOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import {
  apiListKbDocuments,
  apiListKbDocumentCategories,
  apiGetKbDocument,
  type KbDocumentListItem,
} from '../../../api/kb'
import type { UseInfiniteCanvasReturn } from '../../../composables/useInfiniteCanvas'

const canvas = inject<UseInfiniteCanvasReturn>('canvasV2')!
const message = useMessage()

const loading = ref(false)
const search = ref('')
const categories = ref<string[]>([])
const expanded = ref<Set<string>>(new Set())
const allDocs = ref<KbDocumentListItem[]>([])

const filteredDocs = computed(() => {
  if (!search.value.trim()) return allDocs.value
  const q = search.value.toLowerCase()
  return allDocs.value.filter(d =>
    d.title.toLowerCase().includes(q) ||
    d.category?.toLowerCase().includes(q) ||
    d.tags.some(t => t.toLowerCase().includes(q))
  )
})

const grouped = computed(() => {
  const groups = new Map<string, KbDocumentListItem[]>()
  for (const doc of filteredDocs.value) {
    const key = doc.category || '未分组'
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(doc)
  }
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === '未分组') return 1
    if (b[0] === '未分组') return -1
    return a[0].localeCompare(b[0])
  })
})

function toggleGroup(cat: string) {
  if (expanded.value.has(cat)) expanded.value.delete(cat)
  else expanded.value.add(cat)
  expanded.value = new Set(expanded.value)
}

function handleDragStart(e: DragEvent, doc: KbDocumentListItem) {
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('application/json', JSON.stringify({
    id: doc.id, title: doc.title, category: doc.category,
    doc_type: doc.doc_type, review_status: doc.review_status,
    excerpt: doc.excerpt, tags: doc.tags, slug: doc.slug,
  }))
}

async function handleClick(doc: KbDocumentListItem) {
  // Add at center of visible canvas area
  const z = canvas.zoom.value / 100
  const cx = (0 - canvas.panX.value) / z + 400
  const cy = (0 - canvas.panY.value) / z + 300
  const jitter = (Math.random() - 0.5) * 80

  const id = await canvas.addKbDoc(doc, cx + jitter, cy + jitter)
  if (id) {
    message.success(`已添加「${doc.title}」`)
    // Auto-connect related docs
    try {
      const detail = await apiGetKbDocument(doc.id)
      const connectedTitles = [...(detail.connections || []), ...(detail.sources || [])]
      if (connectedTitles.length > 0) {
        let added = 0
        for (const title of connectedTitles.slice(0, 5)) {
          const existing = allDocs.value.find(d => d.title === title && d.id !== doc.id)
          if (existing) {
            const rx = cx + (Math.random() - 0.5) * 400
            const ry = cy + (Math.random() - 0.5) * 300 + 150
            const connectedId = await canvas.addKbDoc(existing, rx, ry)
            if (connectedId) {
              await canvas.completeConnection(id)
              added++
            }
          }
        }
        if (added > 0) message.success(`已自动关联 ${added} 个文档`)
      }
    } catch { /* ignore */ }
  } else {
    message.error('添加失败')
  }
}

async function loadAll() {
  loading.value = true
  try {
    const [cats, res] = await Promise.all([
      apiListKbDocumentCategories(),
      apiListKbDocuments({ page: 1, pageSize: 500 }),
    ])
    categories.value = cats
    allDocs.value = res.items.filter(d => d.status === 'active')
    const firstThree = [...new Set(allDocs.value.map(d => d.category || '未分组'))].slice(0, 5)
    expanded.value = new Set(firstThree)
  } catch { /* ignore */ } finally {
    loading.value = false
  }
}

const REVIEW_LABELS: Record<string, string> = { mature: '成熟', developing: '完善中', seed: '草稿' }
const DOC_TYPE_COLORS: Record<string, string> = { entity: '#8b5cf6', concept: '#6366f1', source: '#0ea5e9', synthesis: '#f59e0b' }

onMounted(loadAll)
</script>

<template>
  <div class="h-full flex flex-col bg-base-200/50">
    <!-- Header -->
    <div class="px-3 py-2.5 border-b border-base-content/10 shrink-0">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm font-medium text-base-content">知识库</span>
        <span class="text-[10px] text-base-content/30 ml-auto">{{ allDocs.length }} 篇</span>
      </div>
      <NInput v-model:value="search" size="tiny" placeholder="搜索..." clearable>
        <template #prefix><SearchOutline class="w-3 h-3" /></template>
      </NInput>
    </div>

    <!-- Doc list -->
    <div class="flex-1 overflow-y-auto">
      <NSpin :show="loading" size="small">
        <div v-if="grouped.length === 0 && !loading" class="p-4 text-center text-xs text-base-content/30">
          暂无活跃文档
        </div>

        <div v-for="[cat, docs] in grouped" :key="cat">
          <div
            class="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-base-100/50 text-xs font-medium text-base-content/60 sticky top-0 bg-base-200/80 backdrop-blur z-10"
            @click="toggleGroup(cat)"
          >
            <component :is="expanded.has(cat) ? ChevronDownOutline : ChevronForwardOutline" class="w-3 h-3 shrink-0" />
            <span class="truncate">{{ cat }}</span>
            <span class="text-[10px] text-base-content/20 ml-auto">{{ docs.length }}</span>
          </div>

          <div v-if="expanded.has(cat)">
            <div
              v-for="doc in docs" :key="doc.id"
              class="group mx-2 my-0.5 px-2.5 py-2 rounded-lg cursor-pointer hover:bg-base-100 border border-transparent hover:border-base-content/10 transition-all"
              draggable="true"
              @dragstart="handleDragStart($event, doc)"
              @click="handleClick(doc)"
            >
              <div class="flex items-start gap-1.5">
                <div class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  :style="{ background: DOC_TYPE_COLORS[doc.doc_type ?? ''] || '#6366f1' }" />
                <div class="min-w-0 flex-1">
                  <div class="text-xs text-base-content truncate leading-snug">{{ doc.title }}</div>
                  <div class="flex items-center gap-1 mt-1 flex-wrap">
                    <NTag v-if="doc.doc_type" size="tiny" :bordered="false"
                      :style="{ background: (DOC_TYPE_COLORS[doc.doc_type] || '#6366f1') + '20', color: DOC_TYPE_COLORS[doc.doc_type] || '#6366f1' }">
                      {{ doc.doc_type }}
                    </NTag>
                    <NTag v-if="doc.review_status" size="tiny" :bordered="false"
                      :type="doc.review_status === 'mature' ? 'success' : doc.review_status === 'developing' ? 'warning' : 'info'">
                      {{ REVIEW_LABELS[doc.review_status] || doc.review_status }}
                    </NTag>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </NSpin>
    </div>
  </div>
</template>