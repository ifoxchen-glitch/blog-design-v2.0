<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import {
  NModal,
  NButton,
  NInput,
  NSpin,
  NEmpty,
  NTag,
} from 'naive-ui'
import {
  SearchOutline,
  DocumentOutline,
  LinkOutline,
  ArrowForwardOutline,
} from '@vicons/ionicons5'
import {
  apiListKbDocuments,
  apiListKbDocumentCategories,
  type KbDocumentListItem,
} from '../../../api/kb'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', val: boolean): void
  (e: 'select', doc: KbDocumentListItem): void
}>()

const loading = ref(false)
const categories = ref<Array<{ label: string; value: string }>>([])
const selectedCategory = ref<string>('')
const search = ref('')
const docs = ref<KbDocumentListItem[]>([])
const docsTotal = ref(0)
const docsLoading = ref(false)

async function loadCategories() {
  try {
    const cats = await apiListKbDocumentCategories()
    categories.value = [
      { label: '全部', value: '' },
      ...cats.map(c => ({ label: c, value: c })),
    ]
  } catch {
    categories.value = [{ label: '全部', value: '' }]
  }
}

async function loadDocs() {
  docsLoading.value = true
  try {
    const res = await apiListKbDocuments({
      page: 1,
      pageSize: 50,
      category: selectedCategory.value || undefined,
      search: search.value || undefined,
      status: 'active',
    })
    docs.value = res.items
    docsTotal.value = res.total
  } catch {
    docs.value = []
  } finally {
    docsLoading.value = false
  }
}

function handleSelect(doc: KbDocumentListItem) {
  emit('select', doc)
  emit('update:show', false)
}

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

let searchTimer: ReturnType<typeof setTimeout> | null = null
function handleSearch(val: string) {
  search.value = val
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { loadDocs() }, 300)
}

watch(selectedCategory, () => loadDocs())
watch(() => props.show, (val) => {
  if (val) {
    loadDocs()
  }
})

onMounted(() => {
  loadCategories()
})
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :style="{ width: '800px', maxHeight: '80vh' }"
    title="从知识库添加"
    @update:show="(v: boolean) => emit('update:show', v)"
  >
    <div class="flex gap-4" style="height: 520px">
      <!-- Category sidebar -->
      <div class="w-40 shrink-0 overflow-y-auto border-r border-base-content/5 pr-3">
        <div
          v-for="cat in categories"
          :key="cat.value"
          class="px-3 py-2 text-xs rounded cursor-pointer mb-1 transition-colors"
          :class="selectedCategory === cat.value
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-base-content/60 hover:bg-base-200/50'"
          @click="selectedCategory = cat.value"
        >
          {{ cat.label }}
        </div>
      </div>

      <!-- Document list -->
      <div class="flex-1 overflow-hidden flex flex-col min-w-0">
        <!-- Search -->
        <div class="mb-3">
          <NInput
            :value="search"
            placeholder="搜索文档标题..."
            clearable
            size="small"
            @update:value="handleSearch"
          >
            <template #prefix>
              <SearchOutline class="w-3.5 h-3.5 text-base-content/30" />
            </template>
          </NInput>
        </div>

        <NSpin :show="docsLoading" class="flex-1 overflow-y-auto">
          <NEmpty v-if="docs.length === 0 && !docsLoading" description="该分类暂无文档" class="py-8" />

          <div v-else class="flex flex-col gap-2 overflow-y-auto pr-1">
            <div
              v-for="doc in docs"
              :key="doc.id"
              class="group border border-base-content/5 rounded-lg p-3 hover:border-primary/30 hover:bg-base-200/30 cursor-pointer transition-all"
              @click="handleSelect(doc)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <DocumentOutline class="w-3.5 h-3.5 text-base-content/30 shrink-0 mt-0.5" />
                  <h4 class="text-sm font-medium text-base-content truncate flex-1">{{ doc.title }}</h4>
                </div>
                <ArrowForwardOutline class="w-3.5 h-3.5 text-base-content/20 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <p v-if="doc.excerpt" class="text-xs text-base-content/40 mt-1 line-clamp-2 pl-5">
                {{ doc.excerpt }}
              </p>

              <!-- Meta row -->
              <div class="flex flex-wrap items-center gap-1.5 mt-2 pl-5">
                <NTag v-if="doc.category" size="tiny" :bordered="false" type="info">{{ doc.category }}</NTag>
                <NTag v-if="doc.review_status" size="tiny" :bordered="false" :type="reviewColor(doc.review_status) as any">
                  {{ reviewLabel(doc.review_status) }}
                </NTag>
                <NTag v-if="doc.doc_type" size="tiny" :bordered="false" type="warning">{{ doc.doc_type }}</NTag>

                <!-- Connections preview -->
                <span v-if="doc.connections && doc.connections.length > 0" class="flex items-center gap-0.5 text-[10px] text-base-content/30">
                  <LinkOutline class="w-3 h-3" />
                  {{ doc.connections.length }}
                </span>

                <!-- Tags -->
                <span
                  v-for="tag in doc.tags?.slice(0, 3)"
                  :key="tag"
                  class="px-1 py-0.5 rounded bg-primary/10 text-primary text-[10px]"
                >
                  {{ tag }}
                </span>
                <span v-if="(doc.tags?.length ?? 0) > 3" class="text-[10px] text-base-content/30">
                  +{{ doc.tags!.length - 3 }}
                </span>
              </div>
            </div>
          </div>
        </NSpin>
      </div>
    </div>
  </NModal>
</template>