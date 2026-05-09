<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NInput, NTag, NSpin } from 'naive-ui'
import { SearchOutline, ChevronDownOutline, ChevronForwardOutline, BookOutline } from '@vicons/ionicons5'
import {
  apiListKbDocuments,
  apiListKbDocumentCategories,
  type KbDocumentListItem,
} from '../../../api/kb'

const emit = defineEmits<{
  (e: 'drag-start', doc: KbDocumentListItem): void
  (e: 'click-doc', doc: KbDocumentListItem): void
}>()

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
  // Sort groups: "未分组" last
  return [...groups.entries()].sort((a, b) => {
    if (a[0] === '未分组') return 1
    if (b[0] === '未分组') return -1
    return a[0].localeCompare(b[0])
  })
})

function toggleGroup(cat: string) {
  if (expanded.value.has(cat)) {
    expanded.value.delete(cat)
  } else {
    expanded.value.add(cat)
  }
  // Trigger reactivity
  expanded.value = new Set(expanded.value)
}

function handleDragStart(e: DragEvent, doc: KbDocumentListItem) {
  e.dataTransfer!.effectAllowed = 'copy'
  e.dataTransfer!.setData('application/json', JSON.stringify({
    id: doc.id,
    title: doc.title,
    category: doc.category,
    doc_type: doc.doc_type,
    review_status: doc.review_status,
    excerpt: doc.excerpt,
    tags: doc.tags,
    slug: doc.slug,
  }))
  emit('drag-start', doc)
}

async function loadAll() {
  loading.value = true
  try {
    const [cats, res] = await Promise.all([
      apiListKbDocumentCategories(),
      apiListKbDocuments({ page: 1, pageSize: 500 }, undefined as any),
    ])
    categories.value = cats
    allDocs.value = res.items.filter(d => d.status === 'active')
    // Expand first 3 groups by default
    const firstThree = [...new Set(allDocs.value.map(d => d.category || '未分组'))].slice(0, 3)
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
  <div class="h-full flex flex-col bg-base-200/50 border-r border-base-content/10">
    <!-- Header -->
    <div class="px-3 py-2.5 border-b border-base-content/10 shrink-0">
      <div class="flex items-center gap-2 mb-2">
        <BookOutline class="w-4 h-4 text-base-content/50" />
        <span class="text-sm font-medium">知识库文档</span>
        <span class="text-[10px] text-base-content/30 ml-auto">{{ allDocs.length }}</span>
      </div>
      <NInput
        v-model:value="search"
        size="tiny"
        placeholder="搜索文档..."
        clearable
      >
        <template #prefix>
          <SearchOutline class="w-3.5 h-3.5" />
        </template>
      </NInput>
    </div>

    <!-- Doc list by groups -->
    <div class="flex-1 overflow-y-auto">
      <NSpin :show="loading" size="small">
        <div v-if="grouped.length === 0 && !loading" class="p-4 text-center text-xs text-base-content/30">
          暂无文档
        </div>

        <div v-for="[cat, docs] in grouped" :key="cat">
          <!-- Group header -->
          <div
            class="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer hover:bg-base-100/50 text-xs font-medium text-base-content/60 sticky top-0 bg-base-200/80 backdrop-blur"
            @click="toggleGroup(cat)"
          >
            <component :is="expanded.has(cat) ? ChevronDownOutline : ChevronForwardOutline" class="w-3 h-3 shrink-0" />
            <span class="truncate">{{ cat }}</span>
            <span class="text-[10px] text-base-content/20 ml-auto">{{ docs.length }}</span>
          </div>

          <!-- Docs -->
          <div v-if="expanded.has(cat)">
            <div
              v-for="doc in docs"
              :key="doc.id"
              class="group mx-2 my-0.5 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-base-100 border border-transparent hover:border-base-content/10 transition-all"
              draggable="true"
              @dragstart="handleDragStart($event, doc)"
              @click="emit('click-doc', doc)"
            >
              <div class="flex items-start gap-1.5">
                <div
                  class="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  :style="{ background: DOC_TYPE_COLORS[doc.doc_type ?? ''] || '#6366f1' }"
                />
                <div class="min-w-0 flex-1">
                  <div class="text-xs text-base-content truncate leading-snug">{{ doc.title }}</div>
                  <div class="flex items-center gap-1 mt-1">
                    <NTag
                      v-if="doc.doc_type"
                      size="tiny"
                      :bordered="false"
                      :style="{ background: (DOC_TYPE_COLORS[doc.doc_type] || '#6366f1') + '20', color: DOC_TYPE_COLORS[doc.doc_type] || '#6366f1' }"
                    >
                      {{ doc.doc_type }}
                    </NTag>
                    <NTag
                      v-if="doc.review_status"
                      size="tiny"
                      :bordered="false"
                      :type="doc.review_status === 'mature' ? 'success' : doc.review_status === 'developing' ? 'warning' : 'info'"
                    >
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
