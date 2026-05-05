<script setup lang="ts">
// 文章列表页 — T2.26
// 设计文档:docs/10-phase2-cms-frontend-plan.md §5
//
// 偏离设计文档之处:
// (P1) DataTable 用 :fetch + #search slot,而非设计文档假设的 :query v-bind
// (P2) 批量操作用 #toolbar slot scope { selectedKeys, clearSelection, refresh },
//      而非设计文档假设的 :batchActions prop
// (P3) 路由用 /cms/posts(带 cms 前缀),与 menus seed 对齐
// (P11) 后端 listPosts 仅支持 keyword + status 筛选,不支持 tagId/categoryId;
//       亦不返回 counts 聚合字段。本版只接 keyword + status,标签/分类筛选 + 状态卡片留待
//       §5.2 优化(后端追加聚合接口后再接);相应 select / statistic 暂不实现
// (P12) 后端无批量发布/下架/删除接口,前端用 Promise.allSettled 串单接口

import { computed, h, reactive, ref, type VNode } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  NButton,
  NImage,
  NInput,
  NSelect,
  NSpace,
  NTag,
  NPopconfirm,
  useMessage,
  useDialog,
  type DataTableColumns,
  type DataTableRowKey,
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import DataTable from '../../../components/common/DataTable.vue'
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

const router = useRouter()
const message = useMessage()
const dialog = useDialog()
const permissionStore = usePermissionStore()

// ---- DataTable query ----
interface PostQuery extends Record<string, unknown> {
  keyword: string
  status: '' | PostStatus
}

const initialQuery: PostQuery = {
  keyword: '',
  status: '',
}

const fetchPosts = async (
  params: PostQuery & { page: number; pageSize: number },
) => {
  const res = await apiGetPosts({
    page: params.page,
    pageSize: params.pageSize,
    keyword: params.keyword || undefined,
    status: params.status || undefined,
  })
  return { list: res.items, total: res.total }
}

const tableRef = ref<{
  refresh: () => Promise<void>
  reset: () => void
  clearSelection: () => void
} | null>(null)

function refreshTable() {
  tableRef.value?.refresh()
}

const STATUS_OPTIONS: Array<{ label: string; value: '' | PostStatus }> = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]

// ---- 行操作 ----
function handleEdit(row: PostListItem) {
  router.push({ name: 'cms-post-edit', params: { id: String(row.id) } })
}

function handleCreate() {
  router.push({ name: 'cms-post-new' })
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
    refreshTable()
  } catch (e: unknown) {
    message.error(extractError(e, '操作失败'))
  }
}

async function handleDelete(row: PostListItem) {
  try {
    await apiDeletePost(row.id)
    message.success('已删除')
    refreshTable()
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

// ---- 批量操作(后端无 bulk 接口,用 Promise.allSettled 串单接口)----
const reactiveSelected = reactive<{ keys: DataTableRowKey[] }>({ keys: [] })

function onSelectionUpdate(keys: DataTableRowKey[]) {
  reactiveSelected.keys = keys
}

async function batchOp(
  action: 'publish' | 'unpublish' | 'delete',
  keys: DataTableRowKey[],
  clearSelection: () => void,
) {
  if (keys.length === 0) {
    message.warning('请先勾选文章')
    return
  }
  const verb = action === 'publish' ? '发布' : action === 'unpublish' ? '下架' : '删除'
  const fn =
    action === 'publish'
      ? apiPublishPost
      : action === 'unpublish'
        ? apiUnpublishPost
        : apiDeletePost
  const ids = keys.map((k) => Number(k))

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
      clearSelection()
      refreshTable()
    },
  })
}

// ---- 列定义 ----
const columns = computed<DataTableColumns<PostListItem>>(() => {
  const cols: DataTableColumns<PostListItem> = []
  if (permissionStore.hasPermission('post:delete')) {
    cols.push({ type: 'selection', width: 40, fixed: 'left' })
  }
  cols.push(
    { title: 'ID', key: 'id', width: 70 },
    {
      title: '封面',
      key: 'coverImageUrl',
      width: 64,
      render(row) {
        if (!row.coverImageUrl) return h('span', { style: 'color: #999' }, '—')
        return h(NImage, {
          src: row.coverImageUrl,
          width: 40,
          height: 40,
          objectFit: 'cover',
          previewDisabled: true,
          fallbackSrc:
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="%23eee"/></svg>',
        })
      },
    },
    {
      title: '标题',
      key: 'title',
      minWidth: 200,
      ellipsis: { tooltip: true },
    },
    {
      title: 'Slug',
      key: 'slug',
      width: 160,
      ellipsis: { tooltip: true },
    },
    {
      title: '状态',
      key: 'status',
      width: 90,
      render(row) {
        return h(
          NTag,
          {
            type: row.status === 'published' ? 'success' : 'default',
            size: 'small',
          },
          { default: () => (row.status === 'published' ? '已发布' : '草稿') },
        )
      },
    },
    {
      title: '标签',
      key: 'tags',
      width: 200,
      render(row) {
        if (!row.tags?.length) return h('span', { style: 'color: #999' }, '—')
        return h(
          NSpace,
          { size: 4 },
          {
            default: () =>
              row.tags.map((t) =>
                h(NTag, { size: 'small', round: true }, { default: () => t.name }),
              ),
          },
        )
      },
    },
    {
      title: '分类',
      key: 'categories',
      width: 160,
      render(row) {
        if (!row.categories?.length) return h('span', { style: 'color: #999' }, '—')
        return h(
          NSpace,
          { size: 4 },
          {
            default: () =>
              row.categories.map((c) =>
                h(
                  NTag,
                  { size: 'small', type: 'info' },
                  { default: () => c.name },
                ),
              ),
          },
        )
      },
    },
    {
      title: '发布时间',
      key: 'publishedAt',
      width: 160,
      render(row) {
        return formatDateTime(row.publishedAt)
      },
    },
    {
      title: '更新时间',
      key: 'updatedAt',
      width: 160,
      render(row) {
        return formatDateTime(row.updatedAt)
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render(row) {
        const buttons: VNode[] = []
        if (permissionStore.hasPermission('post:update')) {
          buttons.push(
            h(
              NButton,
              { size: 'small', onClick: () => handleEdit(row) },
              { default: () => '编辑' },
            ),
          )
        }
        if (permissionStore.hasPermission('post:publish')) {
          buttons.push(
            h(
              NButton,
              {
                size: 'small',
                type: row.status === 'published' ? 'warning' : 'primary',
                onClick: () => handleTogglePublish(row),
              },
              { default: () => (row.status === 'published' ? '下架' : '发布') },
            ),
          )
        }
        if (permissionStore.hasPermission('post:delete')) {
          buttons.push(
            h(
              NPopconfirm,
              { onPositiveClick: () => handleDelete(row) },
              {
                trigger: () =>
                  h(
                    NButton,
                    { size: 'small', type: 'error' },
                    { default: () => '删除' },
                  ),
                default: () => '确认删除该文章?此操作不可恢复',
              },
            ),
          )
        }
        if (buttons.length === 0) return h('span', { style: 'color: #999' }, '—')
        return h(NSpace, { size: 4 }, { default: () => buttons })
      },
    },
  )
  return cols
})
</script>

<template>
  <div>
    <PageHeader title="文章管理" subtitle="管理博客文章">
      <NButton
        v-permission="'post:create'"
        type="primary"
        @click="handleCreate"
      >
        新建文章
      </NButton>
    </PageHeader>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchPosts"
      :initial-query="initialQuery"
      :row-key="(row: PostListItem) => row.id"
      :selectable="permissionStore.hasPermission('post:delete')"
      search-placeholder="搜索标题 / slug / 摘要"
      @update:selected-row-keys="onSelectionUpdate"
    >
      <template #search="{ query }">
        <NSpace>
          <NInput
            :value="(query as PostQuery).keyword"
            placeholder="搜索标题 / slug / 摘要"
            clearable
            style="width: 240px"
            @update:value="(v: string) => ((query as PostQuery).keyword = v)"
          />
          <NSelect
            :value="(query as PostQuery).status"
            :options="STATUS_OPTIONS"
            style="width: 140px"
            @update:value="
              (v: '' | PostStatus) => ((query as PostQuery).status = v)
            "
          />
        </NSpace>
      </template>

      <template #toolbar="{ selectedKeys, clearSelection }">
        <template v-if="selectedKeys.length > 0">
          <NButton
            v-if="permissionStore.hasPermission('post:publish')"
            size="small"
            type="primary"
            @click="batchOp('publish', selectedKeys, clearSelection)"
          >
            批量发布({{ selectedKeys.length }})
          </NButton>
          <NButton
            v-if="permissionStore.hasPermission('post:publish')"
            size="small"
            @click="batchOp('unpublish', selectedKeys, clearSelection)"
          >
            批量下架
          </NButton>
          <NButton
            v-if="permissionStore.hasPermission('post:delete')"
            size="small"
            type="error"
            @click="batchOp('delete', selectedKeys, clearSelection)"
          >
            批量删除
          </NButton>
        </template>
      </template>
    </DataTable>
  </div>
</template>
