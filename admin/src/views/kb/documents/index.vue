<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  NButton,
  NInput,
  NSelect,
  NPopconfirm,
  NPagination,
  NSpin,
  NEmpty,
  NDataTable,
  NTag,
  useMessage,
} from 'naive-ui'
import {
  AddOutline,
  CreateOutline,
  TrashOutline,
  EyeOutline,
  SearchOutline,
  RefreshOutline,
  GridOutline,
  ListOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import PublishDialog from '../../../components/kb/publish/PublishDialog.vue'
import {
  apiListKbDocuments,
  apiListKbDocumentCategories,
  apiDeleteKbDocument,
  type KbDocumentListItem,
} from '../../../api/kb'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'
import { useTable } from '../../../composables/useTable'

const router = useRouter()
const message = useMessage()
const permissionStore = usePermissionStore()

type ViewMode = 'card' | 'table'
const viewMode = ref<ViewMode>('card')
const showPublishDialog = ref(false)
const publishTarget = ref<KbDocumentListItem | null>(null)

function handlePublish(row: KbDocumentListItem) {
  publishTarget.value = row
  showPublishDialog.value = true
}

interface DocQuery {
  search: string
  contentSearch: boolean
  source: string
  status: string
  category: string
  tag: string
  review_status: string
  sortBy: string
  sortDir: string
}

const initialQuery: DocQuery = { search: '', contentSearch: false, source: '', status: '', category: '', tag: '', review_status: '', sortBy: 'updated_at', sortDir: 'desc' }

const table = useTable<KbDocumentListItem, DocQuery>({
  fetch: async (params) => {
    const res = await apiListKbDocuments({
      page: params.page,
      pageSize: params.pageSize,
      search: params.search || undefined,
      contentSearch: params.contentSearch || undefined,
      source: params.source || undefined,
      status: params.status || undefined,
      category: params.category || undefined,
      tag: params.tag || undefined,
      review_status: params.review_status || undefined,
      sortBy: params.sortBy || undefined,
      sortDir: (params.sortDir as 'asc' | 'desc') || undefined,
    })
    return { list: res.items, total: res.total }
  },
  initialQuery,
  pageSize: 12,
})

function handleSortChange(sorter: { columnKey?: string; order?: 'ascend' | 'descend' }) {
  if (!sorter.columnKey || !sorter.order) {
    table.query.sortBy = 'updated_at'
    table.query.sortDir = 'desc'
  } else {
    table.query.sortBy = sorter.columnKey
    table.query.sortDir = sorter.order === 'ascend' ? 'asc' : 'desc'
  }
  table.refresh()
}

const categoryOptions = ref<Array<{ label: string; value: string }>>([])

async function loadCategories() {
  try {
    const cats = await apiListKbDocumentCategories()
    categoryOptions.value = [
      { label: '全部分类', value: '' },
      ...cats.map(c => ({ label: c, value: c })),
    ]
  } catch {
    categoryOptions.value = [{ label: '全部分类', value: '' }]
  }
}
loadCategories()

const SOURCE_OPTIONS = [
  { label: '全部来源', value: '' },
  { label: '手动创建', value: 'manual' },
  { label: 'Obsidian', value: 'obsidian' },
  { label: 'API', value: 'api' },
  { label: 'Open WebUI', value: 'openwebui' },
]

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '活跃', value: 'active' },
  { label: '归档', value: 'archived' },
]

const REVIEW_STATUS_OPTIONS = [
  { label: '全部成熟度', value: '' },
  { label: '草稿 (seed)', value: 'seed' },
  { label: '完善中 (developing)', value: 'developing' },
  { label: '成熟 (mature)', value: 'mature' },
]

function handleCreate() {
  router.push({ name: 'kb-document-new' })
}

function handleEdit(row: KbDocumentListItem) {
  router.push({ name: 'kb-document-edit', params: { id: String(row.id) } })
}

async function handleDelete(row: KbDocumentListItem) {
  try {
    await apiDeleteKbDocument(row.id)
    message.success('已删除')
    table.refresh()
  } catch (e: unknown) {
    message.error(extractError(e, '删除失败'))
  }
}

function extractError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message === 'slug_taken') return '该 slug 已被占用'
    if (data?.message) return data.message
  }
  if (e instanceof Error) return e.message
  return fallback
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'obsidian': return 'Obsidian'
    case 'api': return 'API'
    case 'openwebui': return 'Open WebUI'
    default: return '手动'
  }
}

function sourceTagType(source: string): 'success' | 'info' | 'warning' | 'default' {
  switch (source) {
    case 'obsidian': return 'success'
    case 'api': return 'info'
    case 'openwebui': return 'warning'
    default: return 'default'
  }
}

// ---- DataTable 列定义 ----
const tableColumns = computed(() => [
  {
    title: '标题',
    key: 'title' as const,
    sorter: true,
    ellipsis: { tooltip: true },
    width: 200,
  },
  {
    title: '来源',
    key: 'source' as const,
    width: 80,
    render(row: KbDocumentListItem) {
      return h(NTag, { size: 'small', type: sourceTagType(row.source) }, () => sourceLabel(row.source))
    },
  },
  {
    title: '分类',
    key: 'category' as const,
    sorter: true,
    width: 90,
    render(row: KbDocumentListItem) {
      return row.category ? h(NTag, { size: 'small', type: 'info' }, () => row.category) : ''
    },
  },
  {
    title: '文档类型',
    key: 'doc_type' as const,
    sorter: true,
    width: 90,
    render(row: KbDocumentListItem) {
      return row.doc_type ? h(NTag, { size: 'small', type: 'warning' }, () => row.doc_type) : ''
    },
  },
  {
    title: '标签',
    key: 'tags' as const,
    width: 140,
    render(row: KbDocumentListItem) {
      if (!row.tags?.length) return ''
      return row.tags.join(', ')
    },
  },
  {
    title: '成熟度',
    key: 'review_status' as const,
    sorter: true,
    width: 80,
    render(row: KbDocumentListItem) {
      if (!row.review_status) return ''
      const typeMap: Record<string, 'success' | 'warning' | 'info' | 'default'> = { mature: 'success', developing: 'warning', seed: 'info' }
      const labelMap: Record<string, string> = { mature: '成熟', developing: '完善中', seed: '草稿' }
      const rs = row.review_status ?? ''
      return h(NTag, { size: 'small', type: typeMap[rs] || 'default' }, () => labelMap[rs] || rs)
    },
  },
  {
    title: '字数',
    key: 'word_count' as const,
    sorter: true,
    width: 60,
  },
  {
    title: '状态',
    key: 'status' as const,
    width: 65,
    render(row: KbDocumentListItem) {
      return row.status === 'active'
        ? h(NTag, { size: 'small', type: 'success' }, () => '活跃')
        : h(NTag, { size: 'small' }, () => '归档')
    },
  },
  {
    title: '更新时间',
    key: 'updated_at' as const,
    sorter: true,
    width: 150,
    render(row: KbDocumentListItem) {
      return formatDateTime(row.updated_at)
    },
  },
  {
    title: '操作',
    key: 'actions' as const,
    width: 140,
    render(row: KbDocumentListItem) {
      return h('div', { class: 'flex items-center gap-1' }, [
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            onClick: () => handleEdit(row),
            style: permissionStore.hasPermission('kb:update') ? {} : { display: 'none' },
          },
          () => h(CreateOutline, { style: { width: '14px', height: '14px' } }),
        ),
        h(
          NButton,
          {
            size: 'tiny',
            quaternary: true,
            type: 'primary',
            onClick: () => handlePublish(row),
            style: permissionStore.hasPermission('kb:publish') ? {} : { display: 'none' },
          },
          () => h(EyeOutline, { style: { width: '14px', height: '14px' } }),
        ),
        h(
          NPopconfirm,
          { 'onPositive-click': () => handleDelete(row) },
          {
            trigger: () => permissionStore.hasPermission('kb:delete')
              ? h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, () => h(TrashOutline, { style: { width: '14px', height: '14px' } }))
              : null,
            default: () => '确认删除该文档?此操作不可恢复',
          },
        ),
      ])
    },
  },
])
</script>

<template>
  <div>
    <PageHeader title="文档管理" subtitle="知识库文档列表">
      <NButton v-permission="'kb:create'" type="primary" @click="handleCreate">
        <template #icon><AddOutline class="w-4 h-4" /></template>
        新建文档
      </NButton>
    </PageHeader>

    <!-- 搜索与筛选 -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-[200px] max-w-[400px] flex items-center gap-1">
        <NInput v-model:value="table.query.search" placeholder="搜索标题..." clearable class="flex-1">
          <template #prefix>
            <SearchOutline class="w-4 h-4 text-base-content/30" />
          </template>
        </NInput>
        <NButton
          size="tiny"
          :type="table.query.contentSearch ? 'primary' : 'default'"
          quaternary
          @click="table.query.contentSearch = !table.query.contentSearch; table.refresh()"
          title="搜索正文内容"
        >
          <span class="text-[10px]">全文</span>
        </NButton>
      </div>
      <NSelect
        v-model:value="table.query.source"
        :options="SOURCE_OPTIONS"
        placeholder="来源"
        clearable
        style="width: 130px"
      />
      <NSelect
        v-model:value="table.query.status"
        :options="STATUS_OPTIONS"
        placeholder="状态"
        clearable
        style="width: 120px"
      />
      <NSelect
        v-model:value="table.query.category"
        :options="categoryOptions"
        placeholder="分类"
        clearable
        style="width: 130px"
      />
      <NInput
        v-model:value="table.query.tag"
        placeholder="标签筛选"
        clearable
        style="width: 120px"
      />
      <NSelect
        v-model:value="table.query.review_status"
        :options="REVIEW_STATUS_OPTIONS"
        placeholder="成熟度"
        clearable
        style="width: 130px"
      />
      <NButton quaternary circle :loading="table.loading.value" @click="table.refresh()" title="刷新">
        <RefreshOutline class="w-4 h-4" />
      </NButton>
      <NButton quaternary size="tiny" @click="table.reset()" title="清除所有筛选">
        重置
      </NButton>
      <div class="ml-auto flex items-center gap-1 bg-base-200 rounded-lg p-0.5 border border-base-content/10">
        <NButton size="tiny" :type="viewMode === 'card' ? 'primary' : 'default'" quaternary @click="viewMode = 'card'" title="卡片视图">
          <GridOutline class="w-4 h-4" />
        </NButton>
        <NButton size="tiny" :type="viewMode === 'table' ? 'primary' : 'default'" quaternary @click="viewMode = 'table'" title="列表视图">
          <ListOutline class="w-4 h-4" />
        </NButton>
      </div>
    </div>

    <NSpin :show="table.loading.value">
      <!-- 卡片视图 -->
      <template v-if="viewMode === 'card'">
        <div v-if="table.data.value.length === 0 && !table.loading.value" class="py-16">
          <NEmpty description="暂无文档">
            <template #extra>
              <p class="text-sm text-base-content/40 mt-2">点击右上角"新建文档"开始创建</p>
            </template>
          </NEmpty>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <div
            v-for="row in table.data.value"
            :key="row.id"
            class="group bg-base-100 rounded-xl border border-base-content/5 overflow-hidden hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
            @click="handleEdit(row)"
          >
            <!-- 头部色带 -->
            <div class="h-2" :class="row.source === 'obsidian' ? 'bg-purple-500' : row.source === 'api' ? 'bg-blue-500' : 'bg-primary'" />

            <div class="p-4">
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-medium text-sm text-base-content truncate flex-1">{{ row.title }}</h3>
                <span
                  v-if="row.review_status"
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                  :class="{
                    'bg-green-500/10 text-green-500': row.review_status === 'mature',
                    'bg-amber-500/10 text-amber-500': row.review_status === 'developing',
                    'bg-blue-500/10 text-blue-500': row.review_status === 'seed',
                  }"
                >
                  {{ row.review_status === 'mature' ? '成熟' : row.review_status === 'developing' ? '完善中' : '草稿' }}
                </span>
              </div>
              <p class="text-xs text-base-content/30 mt-1 truncate">{{ row.slug }}</p>
              <p v-if="row.category" class="text-xs text-primary/60 mt-1">分类: {{ row.category }}</p>

              <!-- 标签 -->
              <div class="flex flex-wrap gap-1 mt-2.5">
                <span
                  v-for="tag in row.tags?.slice(0, 4)"
                  :key="tag"
                  class="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]"
                >
                  {{ tag }}
                </span>
                <span v-if="(row.tags?.length ?? 0) > 4" class="px-1.5 py-0.5 rounded bg-base-content/5 text-base-content/30 text-[10px]">
                  +{{ row.tags!.length - 4 }}
                </span>
              </div>

              <!-- 底部 -->
              <div class="flex items-center justify-between mt-3 pt-3 border-t border-base-content/5">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] text-base-content/30">{{ formatDateTime(row.updated_at) }}</span>
                  <NTag :bordered="false" size="small" :type="sourceTagType(row.source)">{{ sourceLabel(row.source) }}</NTag>
                </div>
                <span class="text-[11px] text-base-content/20">{{ row.word_count }} 字</span>
              </div>

              <!-- 操作按钮 -->
              <div class="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                <NButton
                  v-if="permissionStore.hasPermission('kb:update')"
                  size="tiny"
                  quaternary
                  @click.stop="handleEdit(row)"
                >
                  <CreateOutline class="w-3.5 h-3.5" />
                </NButton>
                <NButton
                  v-if="permissionStore.hasPermission('kb:publish')"
                  size="tiny"
                  quaternary
                  type="primary"
                  @click.stop="handlePublish(row)"
                >
                  <EyeOutline class="w-3.5 h-3.5" />
                </NButton>
                <NPopconfirm v-if="permissionStore.hasPermission('kb:delete')" @positive-click="handleDelete(row)">
                  <template #trigger>
                    <NButton size="tiny" quaternary type="error" @click.stop>
                      <TrashOutline class="w-3.5 h-3.5" />
                    </NButton>
                  </template>
                  确认删除该文档?此操作不可恢复
                </NPopconfirm>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 列表视图 -->
      <template v-else>
        <NDataTable
          :columns="tableColumns"
          :data="table.data.value"
          :loading="table.loading.value"
          :bordered="false"
          :single-line="false"
          striped
          size="small"
          class="rounded-xl overflow-hidden"
          @update:sorter="handleSortChange"
        />
      </template>
    </NSpin>

    <!-- 分页 -->
    <div class="mt-6 flex justify-end">
      <NPagination
        :page="table.page.value"
        :page-size="table.pageSize.value"
        :item-count="table.total.value"
        :page-sizes="[12, 24, 48]"
        show-size-picker
        @update:page="table.handlePageChange"
        @update:page-size="table.handlePageSizeChange"
      />
    </div>

    <PublishDialog
      v-if="publishTarget"
      :show="showPublishDialog"
      :document-id="publishTarget.id"
      :document-title="publishTarget.title"
      :document-slug="publishTarget.slug"
      :document-excerpt="publishTarget.excerpt"
      :document-tags="publishTarget.tags"
      @update:show="showPublishDialog = $event"
      @published="table.refresh()"
    />
  </div>
</template>
