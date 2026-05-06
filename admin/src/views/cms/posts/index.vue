<script setup lang="ts">
import { computed, ref } from 'vue'
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
  useMessage,
  useDialog,
} from 'naive-ui'
import {
  CreateOutline,
  TrashOutline,
  EyeOutline,
  EyeOffOutline,
  SearchOutline,
  RefreshOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import {
  apiGetPosts,
  apiDeletePost,
  apiPublishPost,
  apiUnpublishPost,
  type PostListItem,
  type PostStatus,
} from '../../../api/cms'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'
import { useTable } from '../../../composables/useTable'

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const permissionStore = usePermissionStore()

interface PostQuery {
  keyword: string
  status: '' | PostStatus
}

const initialQuery: PostQuery = { keyword: '', status: '' }

const table = useTable<PostListItem, PostQuery>({
  fetch: async (params) => {
    const res = await apiGetPosts({
      page: params.page,
      pageSize: params.pageSize,
      keyword: params.keyword || undefined,
      status: params.status || undefined,
    })
    return { list: res.items, total: res.total }
  },
  initialQuery,
  pageSize: 12,
})

const STATUS_OPTIONS: Array<{ label: string; value: '' | PostStatus }> = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]

function handleCreate() {
  router.push({ name: 'cms-post-new' })
}

function handleEdit(row: PostListItem) {
  router.push({ name: 'cms-post-edit', params: { id: String(row.id) } })
}

async function handleTogglePublish(row: PostListItem) {
  try {
    if (row.status === 'published') {
      await apiUnpublishPost(row.id)
      message.success('已下架为草稿')
    } else {
      await apiPublishPost(row.id)
      message.success('已发布')
    }
    table.refresh()
  } catch (e: unknown) {
    message.error(extractError(e, '操作失败'))
  }
}

async function handleDelete(row: PostListItem) {
  try {
    await apiDeletePost(row.id)
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

// ---- 批量操作 ----
const selectedIds = ref<Set<number>>(new Set())

function toggleSelect(id: number) {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id)
  } else {
    selectedIds.value.add(id)
  }
}

const hasSelection = computed(() => selectedIds.value.size > 0)

async function batchOp(action: 'publish' | 'unpublish' | 'delete') {
  const ids = Array.from(selectedIds.value)
  if (ids.length === 0) return
  const verb = action === 'publish' ? '发布' : action === 'unpublish' ? '下架' : '删除'
  const fn = action === 'publish' ? apiPublishPost : action === 'unpublish' ? apiUnpublishPost : apiDeletePost

  dialog.warning({
    title: `批量${verb}`,
    content: `将对所选 ${ids.length} 篇文章执行${verb}。继续?`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      const results = await Promise.allSettled(ids.map((id) => fn(id)))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      const fail = results.length - ok
      if (fail === 0) {
        message.success(`${verb}成功(${ok})`)
      } else {
        message.warning(`${verb}完成:成功 ${ok},失败 ${fail}`)
      }
      selectedIds.value.clear()
      table.refresh()
    },
  })
}
</script>

<template>
  <div>
    <PageHeader title="文章管理" subtitle="管理博客文章">
      <NButton v-permission="'post:create'" type="primary" @click="handleCreate">
        新建文章
      </NButton>
    </PageHeader>

    <!-- 搜索与筛选 -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-[240px] max-w-[400px]">
        <NInput
          v-model:value="table.query.keyword"
          placeholder="搜索标题 / slug / 摘要"
          clearable
        >
          <template #prefix>
            <SearchOutline class="w-4 h-4 text-base-content/30" />
          </template>
        </NInput>
      </div>
      <NSelect
        v-model:value="table.query.status"
        :options="STATUS_OPTIONS"
        placeholder="状态"
        clearable
        style="width: 130px"
      />
      <NButton quaternary circle :loading="table.loading.value" @click="table.refresh()">
        <RefreshOutline class="w-4 h-4" />
      </NButton>
    </div>

    <!-- 批量操作栏 -->
    <div
      v-if="hasSelection"
      class="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20"
    >
      <span class="text-sm text-primary">已选 {{ selectedIds.size }} 篇</span>
      <div class="flex-1" />
      <NButton v-if="permissionStore.hasPermission('post:publish')" size="small" type="primary" @click="batchOp('publish')">
        批量发布
      </NButton>
      <NButton v-if="permissionStore.hasPermission('post:publish')" size="small" @click="batchOp('unpublish')">
        批量下架
      </NButton>
      <NButton v-if="permissionStore.hasPermission('post:delete')" size="small" type="error" @click="batchOp('delete')">
        批量删除
      </NButton>
      <NButton size="small" quaternary @click="selectedIds.clear()">
        取消选择
      </NButton>
    </div>

    <!-- 卡片网格 -->
    <NSpin :show="table.loading.value">
      <div v-if="table.data.value.length === 0 && !table.loading.value" class="py-16">
        <NEmpty description="暂无文章">
          <template #extra>
            <p class="text-sm text-base-content/40 mt-2">点击右上角"新建文章"开始创作</p>
          </template>
        </NEmpty>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <div
          v-for="row in table.data.value"
          :key="row.id"
          class="group bg-base-100 rounded-xl border border-base-content/5 overflow-hidden hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
          :class="selectedIds.has(row.id) ? 'ring-2 ring-primary/40 border-primary/30' : ''"
        >
          <!-- 封面 -->
          <div class="aspect-[3/2] overflow-hidden bg-base-300/30 relative">
            <img
              v-if="row.coverImageUrl"
              :src="row.coverImageUrl"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div v-else class="w-full h-full flex items-center justify-center text-base-content/10">
              <svg class="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>

            <!-- 复选框 -->
            <div
              v-if="permissionStore.hasPermission('post:delete')"
              class="absolute top-2 left-2 z-10"
            >
              <button
                class="w-5 h-5 rounded border flex items-center justify-center transition-colors"
                :class="selectedIds.has(row.id)
                  ? 'bg-primary border-primary text-white'
                  : 'bg-black/30 border-white/30 text-transparent group-hover:bg-black/50 group-hover:border-white/50'"
                @click.stop="toggleSelect(row.id)"
              >
                <svg v-if="selectedIds.has(row.id)" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>

            <!-- 状态 -->
            <div class="absolute top-2 right-2 z-10">
              <span
                class="px-2 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-sm"
                :class="row.status === 'published'
                  ? 'bg-success/20 text-success border border-success/20'
                  : 'bg-base-content/10 text-base-content/60 border border-base-content/10'"
              >
                {{ row.status === 'published' ? '已发布' : '草稿' }}
              </span>
            </div>
          </div>

          <!-- 内容 -->
          <div class="p-4">
            <h3
              class="font-medium text-sm text-base-content truncate cursor-pointer hover:text-primary transition-colors"
              @click="handleEdit(row)"
            >
              {{ row.title }}
            </h3>
            <p class="text-xs text-base-content/30 mt-1 truncate">{{ row.slug }}</p>

            <!-- 标签 -->
            <div class="flex flex-wrap gap-1 mt-2.5">
              <span
                v-for="tag in row.tags?.slice(0, 4)"
                :key="tag.name"
                class="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]"
              >
                {{ tag.name }}
              </span>
              <span v-if="(row.tags?.length ?? 0) > 4" class="px-1.5 py-0.5 rounded bg-base-content/5 text-base-content/30 text-[10px]">
                +{{ row.tags!.length - 4 }}
              </span>
            </div>

            <!-- 底部 -->
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-base-content/5">
              <span class="text-[11px] text-base-content/30">{{ formatDateTime(row.updatedAt) }}</span>

              <!-- 操作按钮 -->
              <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <NButton
                  v-if="permissionStore.hasPermission('post:update')"
                  size="tiny"
                  quaternary
                  title="编辑"
                  @click="handleEdit(row)"
                >
                  <CreateOutline class="w-3.5 h-3.5" />
                </NButton>
                <NButton
                  v-if="permissionStore.hasPermission('post:publish')"
                  size="tiny"
                  quaternary
                  :title="row.status === 'published' ? '下架' : '发布'"
                  @click="handleTogglePublish(row)"
                >
                  <EyeOffOutline v-if="row.status === 'published'" class="w-3.5 h-3.5" />
                  <EyeOutline v-else class="w-3.5 h-3.5" />
                </NButton>
                <NPopconfirm
                  v-if="permissionStore.hasPermission('post:delete')"
                  @positive-click="handleDelete(row)"
                >
                  <template #trigger>
                    <NButton size="tiny" quaternary type="error" title="删除">
                      <TrashOutline class="w-3.5 h-3.5" />
                    </NButton>
                  </template>
                  确认删除该文章?此操作不可恢复
                </NPopconfirm>
              </div>
            </div>
          </div>
        </div>
      </div>
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
  </div>
</template>
