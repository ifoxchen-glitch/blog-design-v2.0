# Phase 2 §5.1.5 CMS 前端页面整片设计

> 本文档配合 `05-implementation-plan.md` §5.1.5 中的 T2.26 ~ T2.32。
>
> 给 Claude Code 执行用。每节末有 **"提交检查清单"**。
>
> 前置条件：§5.1.3 通用组件 + §5.1.4 RBAC 前端页面全部合并。
>
> 预计总工时：17h（7 个 PR）。

---

## 0. 前置依赖与 §5.1.4 实际偏差修正

- **§5.1.2 CMS 后端** — posts/tags/categories/links/upload/backup 全部 API 已就绪。
- **§5.1.3 通用组件** — PageHeader / DataTable / FormDrawer / MarkdownEditor / ImageUploader 已合并。
- **§5.1.4 实际偏差**（§5.1.5 设计已对齐）：
  - DataTable 的 prop 是 `:fetch`（不是 `:api`），返回 `{ list, total }`（不是 `{ items, total }`）
  - 筛选条件放 DataTable 的 `query` reactive，内部 watch deep 自动触发刷新
  - DataTable 已 expose `{ refresh, reset, clearSelection }`
  - `App.vue` 已包 `NMessageProvider` + `NDialogProvider`，页面可直接用 `useMessage()` / `useDialog()`
  - api 层内部做 snake_case 转换（前端传 camelCase，在 api 函数里转）
  - `n-cascader` 不支持 null value，根菜单用 `0` sentinel（提交前转 null）

### 0.1 新增 API 文件

统一封装在 `admin/src/api/cms.ts`，7 个页面共用。

```ts
import { request, type ApiResponse } from './request'
import type { AxiosInstance } from 'axios'

// ========== Post ==========
export interface PostItem {
  id: number
  title: string
  slug: string
  excerpt: string | null
  coverImageUrl: string | null
  status: 'published' | 'draft'
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  tags: Array<{ id: number; name: string }>
  categories: Array<{ id: number; name: string }>
}

export interface PostDetail extends PostItem {
  contentMarkdown: string
  contentHtml: string | null
}

export interface PostListResponse {
  list: PostItem[]
  total: number
  counts: { all: number; published: number; draft: number }
}

export async function apiGetPosts(
  params: { page: number; pageSize: number; keyword?: string; status?: string; tagId?: number; categoryId?: number; sortBy?: string; sortOrder?: string },
  client: AxiosInstance = request,
): Promise<PostListResponse> {
  const res = await client.get<ApiResponse<PostListResponse>>('/api/v2/admin/cms/posts', { params })
  return res.data.data
}

export async function apiGetPost(
  id: number,
  client: AxiosInstance = request,
): Promise<PostDetail> {
  const res = await client.get<ApiResponse<PostDetail>>(`/api/v2/admin/cms/posts/${id}`)
  return res.data.data
}

export async function apiCreatePost(
  data: { title: string; slug?: string; excerpt?: string; coverImageUrl?: string; contentMarkdown: string; status?: string; tags?: string; categories?: string },
  client: AxiosInstance = request,
): Promise<PostDetail> {
  const res = await client.post<ApiResponse<PostDetail>>('/api/v2/admin/cms/posts', data)
  return res.data.data
}

export async function apiUpdatePost(
  id: number,
  data: { title?: string; slug?: string; excerpt?: string; coverImageUrl?: string; contentMarkdown?: string; status?: string; tags?: string; categories?: string },
  client: AxiosInstance = request,
): Promise<PostDetail> {
  const res = await client.put<ApiResponse<PostDetail>>(`/api/v2/admin/cms/posts/${id}`, data)
  return res.data.data
}

export async function apiDeletePost(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/posts/${id}`)
}

export async function apiPublishPost(
  id: number,
  client: AxiosInstance = request,
): Promise<{ id: number; status: string; publishedAt: string; updatedAt: string }> {
  const res = await client.post<ApiResponse<{ id: number; status: string; publishedAt: string; updatedAt: string }>>(
    `/api/v2/admin/cms/posts/${id}/publish`,
  )
  return res.data.data
}

export async function apiUnpublishPost(
  id: number,
  client: AxiosInstance = request,
): Promise<{ id: number; status: string; publishedAt: string; updatedAt: string }> {
  const res = await client.post<ApiResponse<{ id: number; status: string; publishedAt: string; updatedAt: string }>>(
    `/api/v2/admin/cms/posts/${id}/unpublish`,
  )
  return res.data.data
}

// ========== Tag ==========
export interface TagItem {
  id: number
  name: string
  slug: string
  postCount: number
  createdAt: string
}

export async function apiGetTags(
  client: AxiosInstance = request,
): Promise<{ list: TagItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ list: TagItem[]; total: number }>>('/api/v2/admin/cms/tags')
  return res.data.data
}

export async function apiCreateTag(
  data: { name: string },
  client: AxiosInstance = request,
): Promise<TagItem> {
  const res = await client.post<ApiResponse<TagItem>>('/api/v2/admin/cms/tags', data)
  return res.data.data
}

export async function apiUpdateTag(
  id: number,
  data: { name?: string },
  client: AxiosInstance = request,
): Promise<TagItem> {
  const res = await client.put<ApiResponse<TagItem>>(`/api/v2/admin/cms/tags/${id}`, data)
  return res.data.data
}

export async function apiDeleteTag(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/tags/${id}`)
}

// ========== Category ==========
export interface CategoryItem {
  id: number
  name: string
  slug: string
  postCount: number
  createdAt: string
}

export async function apiGetCategories(
  client: AxiosInstance = request,
): Promise<{ list: CategoryItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ list: CategoryItem[]; total: number }>>('/api/v2/admin/cms/categories')
  return res.data.data
}

export async function apiCreateCategory(
  data: { name: string },
  client: AxiosInstance = request,
): Promise<CategoryItem> {
  const res = await client.post<ApiResponse<CategoryItem>>('/api/v2/admin/cms/categories', data)
  return res.data.data
}

export async function apiUpdateCategory(
  id: number,
  data: { name?: string },
  client: AxiosInstance = request,
): Promise<CategoryItem> {
  const res = await client.put<ApiResponse<CategoryItem>>(`/api/v2/admin/cms/categories/${id}`, data)
  return res.data.data
}

export async function apiDeleteCategory(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/categories/${id}`)
}

// ========== Link ==========
export interface LinkItem {
  id: number
  title: string
  url: string
  icon: string | null
  iconSize: string
  sortOrder: number
}

export async function apiGetLinks(
  client: AxiosInstance = request,
): Promise<{ list: LinkItem[]; total: number }> {
  const res = await client.get<ApiResponse<{ list: LinkItem[]; total: number }>>('/api/v2/admin/cms/links')
  return res.data.data
}

export async function apiCreateLink(
  data: { title: string; url: string; icon?: string; iconSize?: string; sortOrder?: number },
  client: AxiosInstance = request,
): Promise<LinkItem> {
  const res = await client.post<ApiResponse<LinkItem>>('/api/v2/admin/cms/links', data)
  return res.data.data
}

export async function apiUpdateLink(
  id: number,
  data: { title?: string; url?: string; icon?: string; iconSize?: string; sortOrder?: number },
  client: AxiosInstance = request,
): Promise<LinkItem> {
  const res = await client.put<ApiResponse<LinkItem>>(`/api/v2/admin/cms/links/${id}`, data)
  return res.data.data
}

export async function apiDeleteLink(
  id: number,
  client: AxiosInstance = request,
): Promise<void> {
  await client.delete<ApiResponse<void>>(`/api/v2/admin/cms/links/${id}`)
}

export async function apiReorderLinks(
  items: Array<{ id: number; sortOrder: number }>,
  client: AxiosInstance = request,
): Promise<void> {
  await client.post<ApiResponse<void>>('/api/v2/admin/cms/links/reorder', { items })
}

// ========== Backup ==========
export interface BackupData {
  version: number
  exportedAt: string
  links: any[]
  posts: any[]
  tags: any[]
  postTags: any[]
  categories: any[]
  postCategories: any[]
}

export async function apiExportData(
  client: AxiosInstance = request,
): Promise<BackupData> {
  const res = await client.get<ApiResponse<BackupData>>('/api/v2/admin/cms/backup/export')
  return res.data.data
}

export async function apiImportData(
  data: BackupData,
  client: AxiosInstance = request,
): Promise<{ imported: boolean }> {
  const res = await client.post<ApiResponse<{ imported: boolean }>>('/api/v2/admin/cms/backup/import', data)
  return res.data.data
}
```

### 0.2 路由注册

在 `admin/src/router/index.ts` 的 `/dashboard` children 中追加：

```ts
{
  path: '/posts',
  name: 'posts',
  component: () => import('../views/cms/posts/index.vue'),
  meta: { permission: 'post:list' },
},
{
  path: '/posts/new',
  name: 'post-new',
  component: () => import('../views/cms/posts/edit.vue'),
  meta: { permission: 'post:create' },
},
{
  path: '/posts/:id/edit',
  name: 'post-edit',
  component: () => import('../views/cms/posts/edit.vue'),
  meta: { permission: 'post:update' },
},
{
  path: '/tags',
  name: 'tags',
  component: () => import('../views/cms/tags/index.vue'),
  meta: { permission: 'post:list' },
},
{
  path: '/categories',
  name: 'categories',
  component: () => import('../views/cms/categories/index.vue'),
  meta: { permission: 'post:list' },
},
{
  path: '/links',
  name: 'links',
  component: () => import('../views/cms/links/index.vue'),
  meta: { permission: 'post:list' },
},
{
  path: '/media',
  name: 'media',
  component: () => import('../views/cms/media/index.vue'),
  meta: { permission: 'post:create' },
},
{
  path: '/backup',
  name: 'backup',
  component: () => import('../views/cms/backup/index.vue'),
  meta: { permission: 'ops:backup' },
},
```

---

## 1. 总体节奏 & 依赖图

```
T2.28 标签管理   (2h)  ┐
T2.29 分类管理   (2h)  ┼─ 互不依赖，可并列
T2.30 友链管理   (2h)  ┘
   ↓
T2.26 文章列表   (3h)  ← 依赖 tags/categories 已存在（下拉选项）
   ↓
T2.27 文章编辑   (4h)  ← 依赖文章列表（跳转）+ MarkdownEditor + ImageUploader
   ↓
T2.31 媒体库     (1.5h)
   ↓
T2.32 导入导出   (2.5h)
```

**建议合并节奏**：每个任务一个 PR，7 PR 全程。
- T2.26=#56, T2.27=#57, T2.28=#58, T2.29=#59, T2.30=#60, T2.31=#61, T2.32=#62

---

## 2. T2.28 — 标签管理页面

**Issue**: #58 / **估时**: 2h / **依赖**: §5.1.3

### 2.1 页面结构

```
views/cms/tags/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="标签管理" subtitle="管理文章标签">
      <n-button type="primary" v-permission="'post:create'" @click="openCreate">新建标签</n-button>
    </PageHeader>

    <DataTable
      :columns="columns"
      :fetch="apiGetTags"
      search-placeholder="搜索标签名称..."
    />

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑标签' : '新建标签'"
      :loading="submitting"
      :rules="formRules"
      @submit="handleSubmit"
    >
      <n-form-item label="名称" path="name">
        <n-input v-model:value="form.name" placeholder="如 Vue" />
      </n-form-item>
    </FormDrawer>
  </div>
</template>
```

### 2.2 DataTable columns

```ts
const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '名称', key: 'name', width: 140, sorter: true },
  { title: 'Slug', key: 'slug', width: 140 },
  { title: '文章数', key: 'postCount', width: 90 },
  { title: '创建时间', key: 'createdAt', width: 160, render: (row: TagItem) => formatDateTime(row.createdAt) },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row: TagItem) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
            default: () => '确认删除该标签？关联文章将自动解绑。',
          }),
        ],
      })
    },
  },
]
```

### 2.3 表单校验

```ts
const formRules = {
  name: { required: true, message: '请输入标签名称', trigger: 'blur' },
}
```

### 2.4 提交检查清单

- [ ] `admin/src/api/cms.ts` 包含 Tag 相关 API
- [ ] `views/cms/tags/index.vue` 页面结构完整（PageHeader + DataTable + FormDrawer）
- [ ] DataTable 列：ID/名称/Slug/文章数/创建时间/操作
- [ ] 新建/编辑抽屉只有 name 字段
- [ ] 删除按钮 + Popconfirm
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #58` + merge

---

## 3. T2.29 — 分类管理页面

**Issue**: #59 / **估时**: 2h / **依赖**: §5.1.3

### 3.1 特点

与标签管理**完全同构**，只是 api 换成本地分类接口。可直接 copy T2.28 改 api 和标题。

### 3.2 页面结构

```
views/cms/categories/
└── index.vue
```

```vue
<PageHeader title="分类管理" subtitle="管理文章分类">
  <n-button type="primary" v-permission="'post:create'" @click="openCreate">新建分类</n-button>
</PageHeader>

<DataTable
  :columns="columns"
  :fetch="apiGetCategories"
  search-placeholder="搜索分类名称..."
/>
```

columns、drawer、逻辑与 T2.28 一致，api 换成 `apiGetCategories` / `apiCreateCategory` / `apiUpdateCategory` / `apiDeleteCategory`。

### 3.3 提交检查清单

- [ ] `views/cms/categories/index.vue` 页面完整
- [ ] DataTable 列：ID/名称/Slug/文章数/创建时间/操作
- [ ] 新建/编辑抽屉只有 name 字段
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #59` + merge

---

## 4. T2.30 — 友链管理页面

**Issue**: #60 / **估时**: 2h / **依赖**: §5.1.3

### 4.1 页面结构

```
views/cms/links/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="友链管理" subtitle="管理友情链接">
      <n-button type="primary" v-permission="'post:create'" @click="openCreate">新建友链</n-button>
    </PageHeader>

    <DataTable
      :columns="columns"
      :fetch="apiGetLinks"
      search-placeholder="搜索标题或 URL..."
    />

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑友链' : '新建友链'"
      :loading="submitting"
      :rules="formRules"
      @submit="handleSubmit"
    >
      <n-form-item label="标题" path="title">
        <n-input v-model:value="form.title" />
      </n-form-item>
      <n-form-item label="URL" path="url">
        <n-input v-model:value="form.url" placeholder="https://..." />
      </n-form-item>
      <n-form-item label="图标" path="icon">
        <n-input v-model:value="form.icon" placeholder="https://... 或 data:image..." />
      </n-form-item>
      <n-form-item label="图标尺寸" path="iconSize">
        <n-select v-model:value="form.iconSize" :options="iconSizeOptions" />
      </n-form-item>
      <n-form-item label="排序" path="sortOrder">
        <n-input-number v-model:value="form.sortOrder" :min="0" />
      </n-form-item>
    </FormDrawer>
  </div>
</template>
```

### 4.2 DataTable columns

```ts
const columns = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '标题', key: 'title', width: 160, sorter: true },
  { title: 'URL', key: 'url', width: 220, ellipsis: true },
  { title: '图标', key: 'icon', width: 120, ellipsis: true },
  { title: '尺寸', key: 'iconSize', width: 80 },
  { title: '排序', key: 'sortOrder', width: 80, sorter: true },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row: LinkItem) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
          h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
            default: () => '确认删除该友链？',
          }),
        ],
      })
    },
  },
]
```

### 4.3 表单校验

```ts
const formRules = {
  title: { required: true, message: '请输入标题', trigger: 'blur' },
  url: [
    { required: true, message: '请输入 URL', trigger: 'blur' },
    { type: 'url', message: 'URL 格式不正确', trigger: 'blur' },
  ],
}

const iconSizeOptions = [
  { label: '1x1', value: '1x1' },
  { label: '2x1', value: '2x1' },
  { label: '1x2', value: '1x2' },
  { label: '2x2', value: '2x2' },
]
```

### 4.4 提交检查清单

- [ ] `admin/src/api/cms.ts` 包含 Link 相关 API
- [ ] `views/cms/links/index.vue` 页面完整
- [ ] DataTable 列：ID/标题/URL/图标/尺寸/排序/操作
- [ ] 新建/编辑抽屉：title/url/icon/iconSize/sortOrder
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #60` + merge

---

## 5. T2.26 — 文章管理页面（列表）

**Issue**: #56 / **估时**: 3h / **依赖**: T2.28/T2.29（标签/分类已就绪）

### 5.1 页面结构

```
views/cms/posts/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="文章管理" subtitle="管理博客文章">
      <n-button type="primary" v-permission="'post:create'" @click="$router.push('/posts/new')">新建文章</n-button>
    </PageHeader>

    <!-- 状态统计卡片 -->
    <n-space class="mb-4">
      <n-statistic label="全部" :value="counts.all" />
      <n-statistic label="已发布" :value="counts.published" />
      <n-statistic label="草稿" :value="counts.draft" />
    </n-space>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchPosts"
      :query="query"
      search-placeholder="搜索标题、摘要..."
    >
      <template #extra>
        <n-select v-model:value="query.status" :options="statusOptions" placeholder="状态筛选" clearable class="w-32" />
        <n-select v-model:value="query.tagId" :options="tagOptions" placeholder="标签筛选" clearable class="w-32" />
        <n-select v-model:value="query.categoryId" :options="categoryOptions" placeholder="分类筛选" clearable class="w-32" />
      </template>
    </DataTable>
  </div>
</template>
```

### 5.2 DataTable columns

```ts
const columns = [
  { type: 'selection', fixed: 'left' },
  { title: 'ID', key: 'id', width: 60 },
  { title: '标题', key: 'title', width: 200, sorter: true, ellipsis: true },
  { title: 'Slug', key: 'slug', width: 140, ellipsis: true },
  {
    title: '标签',
    key: 'tags',
    width: 140,
    render(row: PostItem) {
      return row.tags.map((t) => h(NTag, { size: 'small' }, { default: () => t.name }))
    },
  },
  {
    title: '分类',
    key: 'categories',
    width: 140,
    render(row: PostItem) {
      return row.categories.map((c) => h(NTag, { size: 'small', type: 'info' }, { default: () => c.name }))
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row: PostItem) {
      return h(NTag, { type: row.status === 'published' ? 'success' : 'warning', size: 'small' }, {
        default: () => (row.status === 'published' ? '已发布' : '草稿'),
      })
    },
  },
  { title: '发布时间', key: 'publishedAt', width: 160, render: (row: PostItem) => formatDateTime(row.publishedAt) },
  { title: '更新时间', key: 'updatedAt', width: 160, render: (row: PostItem) => formatDateTime(row.updatedAt) },
  {
    title: '操作',
    key: 'actions',
    width: 240,
    fixed: 'right',
    render(row: PostItem) {
      return h(NSpace, {}, {
        default: () => [
          h(NButton, { size: 'small', onClick: () => $router.push(`/posts/${row.id}/edit`) }, { default: () => '编辑' }),
          row.status === 'draft'
            ? h(NButton, { size: 'small', type: 'success', onClick: () => handlePublish(row) }, { default: () => '发布' })
            : h(NButton, { size: 'small', onClick: () => handleUnpublish(row) }, { default: () => '下架' }),
          h(NPopconfirm, { onPositiveClick: () => handleDelete(row) }, {
            trigger: () => h(NButton, { size: 'small', type: 'error' }, { default: () => '删除' }),
            default: () => '确认删除该文章？',
          }),
        ],
      })
    },
  },
]
```

### 5.3 筛选与统计

```ts
const query = reactive({ status: null as string | null, tagId: null as number | null, categoryId: null as number | null })
const counts = reactive({ all: 0, published: 0, draft: 0 })
const statusOptions = [
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
]

async function fetchPosts(params: any) {
  const res = await apiGetPosts({
    ...params,
    status: query.status || undefined,
    tagId: query.tagId || undefined,
    categoryId: query.categoryId || undefined,
  })
  counts.all = res.counts.all
  counts.published = res.counts.published
  counts.draft = res.counts.draft
  return { list: res.list, total: res.total }
}

// 加载标签/分类下拉选项
const tagOptions = ref<Array<{ label: string; value: number }>>([])
const categoryOptions = ref<Array<{ label: string; value: number }>>([])

onMounted(async () => {
  const [tagsRes, catsRes] = await Promise.all([apiGetTags(), apiGetCategories()])
  tagOptions.value = tagsRes.list.map((t) => ({ label: t.name, value: t.id }))
  categoryOptions.value = catsRes.list.map((c) => ({ label: c.name, value: c.id }))
})
```

### 5.4 发布/下架/删除

```ts
const message = useMessage()

async function handlePublish(row: PostItem) {
  await apiPublishPost(row.id)
  message.success('发布成功')
  tableRef.value?.refresh()
}

async function handleUnpublish(row: PostItem) {
  await apiUnpublishPost(row.id)
  message.success('已下架')
  tableRef.value?.refresh()
}

async function handleDelete(row: PostItem) {
  await apiDeletePost(row.id)
  message.success('删除成功')
  tableRef.value?.refresh()
}
```

### 5.5 批量操作

```ts
const batchActions = [
  {
    label: '批量删除',
    type: 'error' as const,
    permission: 'post:delete',
    onClick: async (rows: PostItem[]) => {
      await Promise.all(rows.map((r) => apiDeletePost(r.id)))
      message.success(`已删除 ${rows.length} 篇文章`)
      tableRef.value?.refresh()
    },
  },
  {
    label: '批量发布',
    type: 'success' as const,
    permission: 'post:publish',
    onClick: async (rows: PostItem[]) => {
      await Promise.all(rows.map((r) => apiPublishPost(r.id)))
      message.success(`已发布 ${rows.length} 篇文章`)
      tableRef.value?.refresh()
    },
  },
]
```

### 5.6 提交检查清单

- [ ] `admin/src/api/cms.ts` 包含 Post 相关 API（含 publish/unpublish）
- [ ] `views/cms/posts/index.vue` 页面完整
- [ ] 顶部统计卡片：全部/已发布/草稿
- [ ] DataTable 列：ID/标题/Slug/标签/分类/状态/发布时间/更新时间/操作
- [ ] 状态/标签/分类筛选下拉，联动刷新
- [ ] 操作列：编辑（跳转）/ 发布或下架 / 删除
- [ ] 批量操作：批量删除 + 批量发布
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #56` + merge

---

## 6. T2.27 — 文章编辑页面

**Issue**: #57 / **估时**: 4h / **依赖**: T2.26（列表页跳转）+ T2.28/T2.29（标签/分类下拉）

### 6.1 页面结构

```
views/cms/posts/
├── index.vue   (T2.26)
└── edit.vue    (T2.27)
```

```vue
<template>
  <div>
    <PageHeader :title="isEdit ? '编辑文章' : '新建文章'">
      <n-space>
        <n-button @click="$router.back()">返回</n-button>
        <n-button type="primary" :loading="saving" @click="handleSave('draft')">保存草稿</n-button>
        <n-button type="success" :loading="saving" @click="handleSave('published')">发布</n-button>
      </n-space>
    </PageHeader>

    <n-form ref="formRef" :model="form" :rules="formRules">
      <n-form-item label="标题" path="title">
        <n-input v-model:value="form.title" placeholder="文章标题" />
      </n-form-item>

      <n-form-item label="Slug" path="slug">
        <n-input v-model:value="form.slug" placeholder="留空则自动生成" />
      </n-form-item>

      <n-form-item label="摘要" path="excerpt">
        <n-input v-model:value="form.excerpt" type="textarea" :rows="2" placeholder="文章摘要，留空则自动从正文提取" />
      </n-form-item>

      <n-form-item label="封面图" path="coverImageUrl">
        <ImageUploader v-model="form.coverImageUrl" />
      </n-form-item>

      <n-form-item label="正文" path="contentMarkdown">
        <MarkdownEditor v-model="form.contentMarkdown" height="500" />
      </n-form-item>

      <div class="flex gap-4">
        <n-form-item label="标签" class="flex-1">
          <n-select
            v-model:value="form.tagIds"
            multiple
            filterable
            tag
            :options="tagOptions"
            placeholder="选择或输入新标签"
          />
        </n-form-item>

        <n-form-item label="分类" class="flex-1">
          <n-select
            v-model:value="form.categoryIds"
            multiple
            :options="categoryOptions"
            placeholder="选择分类"
          />
        </n-form-item>
      </div>
    </n-form>
  </div>
</template>
```

### 6.2 数据加载（编辑模式）

```ts
const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)

const form = reactive({
  title: '',
  slug: '',
  excerpt: '',
  coverImageUrl: '',
  contentMarkdown: '',
  tagIds: [] as number[],
  categoryIds: [] as number[],
})

onMounted(async () => {
  // 加载标签/分类选项
  const [tagsRes, catsRes] = await Promise.all([apiGetTags(), apiGetCategories()])
  tagOptions.value = tagsRes.list.map((t) => ({ label: t.name, value: t.id }))
  categoryOptions.value = catsRes.list.map((c) => ({ label: c.name, value: c.id }))

  if (isEdit.value) {
    const post = await apiGetPost(Number(route.params.id))
    Object.assign(form, {
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      coverImageUrl: post.coverImageUrl || '',
      contentMarkdown: post.contentMarkdown,
      tagIds: post.tags.map((t) => t.id),
      categoryIds: post.categories.map((c) => c.id),
    })
  }
})
```

### 6.3 保存逻辑

```ts
const formRef = ref<FormInst | null>(null)
const saving = ref(false)

async function handleSave(status: 'draft' | 'published') {
  await formRef.value?.validate()
  saving.value = true
  try {
    // tags/categoryIds 转成逗号分隔字符串（兼容旧 API）
    const tagNames = form.tagIds.map((id) => tagOptions.value.find((t) => t.value === id)?.label).filter(Boolean).join(',')
    const categoryNames = form.categoryIds.map((id) => categoryOptions.value.find((c) => c.value === id)?.label).filter(Boolean).join(',')

    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      excerpt: form.excerpt || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      contentMarkdown: form.contentMarkdown,
      status,
      tags: tagNames,
      categories: categoryNames,
    }

    if (isEdit.value) {
      await apiUpdatePost(Number(route.params.id), payload)
      message.success('更新成功')
    } else {
      await apiCreatePost(payload)
      message.success('创建成功')
    }
    router.push('/posts')
  } finally {
    saving.value = false
  }
}
```

**注意**：标签选择器用了 `tag` 属性（允许用户输入新标签），但后端 `apiCreatePost` 的 `tags` 字段是逗号分隔字符串，会自动创建不存在的标签。所以前端不需要额外调用 `apiCreateTag`。

### 6.4 表单校验

```ts
const formRules = {
  title: { required: true, message: '请输入标题', trigger: 'blur' },
  contentMarkdown: { required: true, message: '请输入正文', trigger: 'blur' },
}
```

### 6.5 提交检查清单

- [ ] `views/cms/posts/edit.vue` 页面完整
- [ ] 新建/编辑共用同一组件，通过 `route.params.id` 区分
- [ ] 字段：title/slug/excerpt/coverImageUrl(MarkdownEditor)/contentMarkdown(MarkdownEditor)/tags/categories
- [ ] 标签选择器支持多选 + 输入新标签（n-select tag + filterable）
- [ ] 分类选择器支持多选
- [ ] 保存草稿按钮 → status=draft；发布按钮 → status=published
- [ ] 编辑模式加载现有数据
- [ ] 保存成功后跳回列表页
- [ ] 路由注册（`/posts/new` + `/posts/:id/edit`）+ 菜单显示正常
- [ ] commit + PR + `Closes #57` + merge

---

## 7. T2.31 — 媒体库页面

**Issue**: #61 / **估时**: 1.5h / **依赖**: §5.1.3（ImageUploader 已就绪）

### 7.1 特点

当前系统**没有"已上传文件列表"API**（只有上传接口）。媒体库页面有两种做法：

**方案 A**（MVP）：直接展示 ImageUploader 组件，支持上传 + 预览。不展示历史文件列表。
**方案 B**（完整）：后端新增 `GET /api/v2/admin/cms/uploads` 列表 API，前端展示网格。

**选方案 A**（MVP），因为：
1. 后端没有文件列表 API，新增需要改 server
2. 当前核心需求是文章编辑时能上传图片，ImageUploader 已经满足
3. 媒体库页面可以以后迭代

### 7.2 页面结构

```
views/cms/media/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="媒体库" subtitle="上传和管理图片">
      <n-button type="primary" @click="showUploader = true">上传图片</n-button>
    </PageHeader>

    <n-empty description="媒体库功能待完善，请直接在文章编辑页上传图片" />

    <n-modal v-model:show="showUploader" title="上传图片" preset="card" class="w-[600px]">
      <ImageUploader v-model="uploadedUrls" multiple :max-count="10" />
      <template #footer>
        <n-space>
          <n-button @click="showUploader = false">关闭</n-button>
          <n-button type="primary" @click="copyUrls">复制所有 URL</n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>
```

### 7.3 提交检查清单

- [ ] `views/cms/media/index.vue` 页面完整
- [ ] 上传图片弹窗内嵌 ImageUploader
- [ ] 支持多图上传
- [ ] 复制 URL 按钮（用 `navigator.clipboard.writeText`）
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #61` + merge

---

## 8. T2.32 — 导入导出页面

**Issue**: #62 / **估时**: 2.5h / **依赖**: §5.1.3

### 8.1 页面结构

```
views/cms/backup/
└── index.vue
```

```vue
<template>
  <div>
    <PageHeader title="数据备份" subtitle="导入/导出博客数据" />

    <n-card title="导出数据" class="mb-4">
      <p class="text-gray-500 mb-4">导出全部博客数据（文章、标签、分类、友链）为 JSON 文件。建议定期备份。</p>
      <n-button type="primary" :loading="exporting" @click="handleExport">导出 JSON</n-button>
    </n-card>

    <n-card title="导入数据">
      <p class="text-gray-500 mb-4">从 JSON 文件恢复博客数据。导入会覆盖现有数据，请谨慎操作！</p>
      <n-upload
        accept=".json"
        :max="1"
        :custom-request="handleUpload"
        @before-upload="beforeUpload"
      >
        <n-button>选择 JSON 文件</n-button>
      </n-upload>
      <n-button
        type="error"
        class="mt-4"
        :loading="importing"
        :disabled="!importData"
        @click="handleImport"
      >
        确认导入
      </n-button>
    </n-card>
  </div>
</template>
```

### 8.2 导出逻辑

```ts
const exporting = ref(false)

async function handleExport() {
  exporting.value = true
  try {
    const data = await apiExportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `blog-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  } finally {
    exporting.value = false
  }
}
```

### 8.3 导入逻辑

```ts
const importing = ref(false)
const importData = ref<BackupData | null>(null)

function beforeUpload({ file }: { file: UploadFileInfo }) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      importData.value = JSON.parse(e.target?.result as string)
      message.success('文件解析成功，请确认导入')
    } catch {
      message.error('JSON 格式错误')
    }
  }
  reader.readAsText(file.file as File)
  return false // 阻止自动上传
}

async function handleImport() {
  if (!importData.value) return
  importing.value = true
  try {
    await apiImportData(importData.value)
    message.success('导入成功')
    importData.value = null
  } finally {
    importing.value = false
  }
}
```

### 8.4 提交检查清单

- [ ] `admin/src/api/cms.ts` 包含 Backup 相关 API
- [ ] `views/cms/backup/index.vue` 页面完整
- [ ] 导出按钮 → 调 `apiExportData` → 浏览器下载 JSON 文件
- [ ] 导入：上传 JSON 文件 → 前端解析 → 确认导入 → 调 `apiImportData`
- [ ] 导入前弹二次确认对话框（`useDialog`）
- [ ] 路由注册 + 菜单显示正常
- [ ] commit + PR + `Closes #62` + merge

---

## 9. 给 Claude Code 的快速接入提示

把下面整段贴到 Claude Code 的第一条消息：

```
我在做 ifoxchen.com v2 后台 Phase 2 §5.1.5 CMS 前端页面整片。完整设计文档在：
10-phase2-cms-frontend-plan.md

按文档顺序推进：
T2.28 (标签管理) → T2.29 (分类管理) → T2.30 (友链管理) → T2.26 (文章列表) → T2.27 (文章编辑) → T2.31 (媒体库) → T2.32 (导入导出)

每个任务完成步骤：
- 写代码（按文档的"文件改动"清单）
- 跑冒烟（admin 目录 npm run dev，浏览器验证页面）
- commit message 末行 Closes #<issue>
- gh pr create + gh pr merge --merge --delete-branch

技术栈：Vue 3.5 + TypeScript + Naive UI + Tailwind CSS 4。PageHeader / DataTable / FormDrawer / MarkdownEditor / ImageUploader 已在 §5.1.3 完成。RBAC 前端页面已在 §5.1.4 完成。

重要对齐（与 §5.1.4 实际代码一致）：
1. DataTable 的 prop 是 `:fetch`（不是 `:api`），返回 { list, total }
2. 筛选条件放 DataTable 的 `query` reactive，内部自动 watch deep 刷新
3. DataTable 已 expose { refresh, reset, clearSelection }
4. App.vue 已包 NMessageProvider + NDialogProvider，页面直接用 useMessage() / useDialog()
5. api 层内部做 snake_case 转换，前端传 camelCase
6. 文件引用只用裸文件名，不加 docs/ 前缀

不用每步问我。常用 npm / git / gh 全自动。只有 push --force / 改 main / 装新 npm 包才停下来。

目标：7 个 PR 跑完。中途如果遇到文档里没写到的边界情况，按现有风格选最不破坏现状的方案，提个 TODO 注释，PR 里说明就行。

Phase 2 §5.1.5 全部合并后告诉我，回 Cowork 复盘 + 进 §5.2 验收规划。
```

---

## 10. 后续衔接（不在本文档范围）

- **§5.2 验收**（T2.33 ~ T2.35）：EJS 下线 + 端到端测试 + 文档更新，预计 5h

完成 §5.1.5 后回 Cowork 出 §5.2 验收计划。

---

**写于**：2026-05-05（Phase 2 §5.1.4 完成后立刻推进 §5.1.5）
**作者**：Cowork session 出方案 + Claude Code session 落地

---

## 11. 实施偏离备忘 (P1-P13)

§5.1.5 落地过程中,代码层面与本设计文档存在以下 13 处偏离。每个偏离在对应文件的 `<script setup>` 头部注释里都有 `(P-编号) 简短理由` 标注,与各 PR commit message 同步。

| 标号 | 设计文档说法 | 实际落点 | 涉及 PR |
|---|---|---|---|
| **P1** | DataTable `:query="query"` 直接 v-bind reactive | DataTable 仅暴露 `:fetch` + `#search` slot scope `{ query }`,模板内 `(query as XxxQuery).keyword` 类型断言 | T2.28 / T2.29 / T2.30 / T2.26 |
| **P2** | DataTable `:batchActions` prop | DataTable 仅 `#toolbar` slot scope `{ selectedKeys, clearSelection, refresh }`,内含 v-if 按 selectedKeys.length 显隐 | T2.26 |
| **P3** | 路由 path 用 `/posts`、`/tags` 等(无 cms 前缀) | 统一 `/cms/posts`、`/cms/tags`、`/cms/categories`、`/cms/links`、`/cms/media`、`/cms/backup`,与 menus seed 对齐 | 全部 |
| **P4** | apiUpload 字段名设计文档默认 `'file'` | 后端 `multer.single("image")`,改 `form.append('image', file)`;MarkdownEditor `UPLOAD_FIELD_NAME` 同步改 'image' | T2.27 |
| **P5** | menus seed 缺 `/cms/backup` 节点 | T2.32 PR 在 `rbacSeed.js` MENUS 顶级追加 `{ name: "数据导入导出", path: "/cms/backup", icon: "ArchiveOutline", permission: "cms:export", sort: 6 }`;**生产 DB 因 seed 跳过策略不会自动加,需在 T2.25 菜单管理页手动新增** | T2.32 |
| **P6** | T2.31 媒体库 issue #61 验收"网格 + 搜索 + 操作" | 后端尚无 media 表与 list API,本期为 MVP 方案 A:n-empty + 上传弹窗 + 复制 URL,本次会话内 URL 列表临时方案。后端补 `GET /api/v2/admin/cms/media` 后再接入网格(§5.2 follow-up) | T2.31 |
| **P7** | export/import 路径 `/api/v2/admin/cms/backup/export\|import` | 后端真实路径 `/api/v2/admin/cms/export\|import`(无 backup 中段),`cmsRouter` 直接挂在 `/admin/cms`。`api/cms.ts` 与 view 沿用真实路径 | T2.32 |
| **P8** | list API 返回 `{ list, total }` | 后端真实返回 `{ items, total }`,与 rbac.ts 一致。view 里包一层把 items→list 转给 useTable | T2.28 / T2.29 / T2.30 / T2.26 |
| **P9** | 设计文档未细分 409 错误 | 后端 409 细分 `name_taken` / `slug_taken`,前端 `extractCategoryError` 翻译为友好中文提示 | T2.29 |
| **P10** | issue #60 验收提"拖拽排序" | 沿用设计文档 §4 简化方案:用 `sortOrder` 数字字段排序,拖拽 UI 留待 §5.2 优化(后端 `apiReorderLinks` 接口已就绪,前端先不接) | T2.30 |
| **P11** | 设计文档假设有 `tagId`/`categoryId`/`counts` 聚合 | 后端 `listPosts` 仅支持 `keyword` + `status` 筛选,亦不返回 counts。文章列表本期只接 keyword + status,标签/分类筛选 + 状态卡片留待 §5.2 优化 | T2.26 |
| **P12** | 设计文档假设 bulk 接口 | 后端无批量发布/下架/删除接口,前端用 `Promise.allSettled` 串单接口,显示成功/失败计数 | T2.26 |
| **P13** | "离开页面前提示未保存" 设计文档没明确写 | 编辑页加 `onBeforeRouteLeave` + `beforeunload` 双重拦截,`dirty` 标记由 deep watch 表单管理,`onMounted` 后才解锁 | T2.27 |

### PR 串号

- T2.28 标签 — [#150](https://github.com/ifoxchen-glitch/blog-design-v2.0/pull/150)
- T2.29 分类 — [#151](https://github.com/ifoxchen-glitch/blog-design-v2.0/pull/151)
- T2.30 友链 — [#152](https://github.com/ifoxchen-glitch/blog-design-v2.0/pull/152)
- T2.26 文章列表 — [#153](https://github.com/ifoxchen-glitch/blog-design-v2.0/pull/153)
- T2.27 文章编辑 + apiUpload 修复 — [#154](https://github.com/ifoxchen-glitch/blog-design-v2.0/pull/154)
- T2.31 媒体库 MVP — [#155](https://github.com/ifoxchen-glitch/blog-design-v2.0/pull/155)
- T2.32 数据导入导出 + 文档同步 — 本 PR

### §5.2 验收建议追加项(基于偏离清单)

1. **后端补齐**:`listPosts` 加 `tagId`/`categoryId`/`counts`(P11)、bulk endpoints(P12)、media list API(P6) → 前端二期接入
2. **菜单同步**:生产 DB 在 T2.25 菜单管理页手动新增 `/cms/backup`(P5)
3. **拖拽排序**:友链页接 `apiReorderLinks` + drag-handle UI(P10)
4. **设计文档修订**:把 P1/P2/P4/P7/P8 的实际契约回写到 §0、§5、§6 章节,避免下次基于过时假设落地
