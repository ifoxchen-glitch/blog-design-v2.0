<script setup lang="ts">
import { computed, h, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NInput,
  NForm,
  NFormItem,
  NPopconfirm,
  NEmpty,
  NDataTable,
  NSpin,
  NPagination,
  NSelect,
  NTag,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { CreateOutline, TrashOutline, SearchOutline, AddOutline, GridOutline, ListOutline } from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetCategories,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  apiGetPosts,
  type CategoryItem,
  type PostListItem,
} from '../../../api/cms'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'

const router = useRouter()
const message = useMessage()
const permissionStore = usePermissionStore()

// ---- 视图模式 ----
type ViewMode = 'card' | 'table'
const viewMode = ref<ViewMode>('card')

// ---- 排序 ----
type SortField = 'name' | 'postCount_desc' | 'postCount_asc'
const sortBy = ref<SortField>('postCount_desc')

const SORT_OPTIONS = [
  { label: '按名称排序', value: 'name' as const },
  { label: '按文章数从多到少', value: 'postCount_desc' as const },
  { label: '按文章数从少到多', value: 'postCount_asc' as const },
]

// ---- 彩色卡片调色板 ----
const CARD_COLORS = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', badge: 'bg-blue-500/15 text-blue-400' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', badge: 'bg-emerald-500/15 text-emerald-400' },
  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', badge: 'bg-purple-500/15 text-purple-400' },
  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', badge: 'bg-amber-500/15 text-amber-400' },
  { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', badge: 'bg-rose-500/15 text-rose-400' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', badge: 'bg-cyan-500/15 text-cyan-400' },
  { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20', badge: 'bg-orange-500/15 text-orange-400' },
  { bg: 'bg-pink-500/10', text: 'text-pink-400', border: 'border-pink-500/20', badge: 'bg-pink-500/15 text-pink-400' },
]

function getColor(index: number) {
  return CARD_COLORS[index % CARD_COLORS.length]
}

// ---- 数据加载 ----
const categories = ref<CategoryItem[]>([])
const loading = ref(false)
const search = ref('')

async function loadCategories() {
  loading.value = true
  try {
    const res = await apiGetCategories()
    categories.value = res.items
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}
loadCategories()

const filteredCategories = computed(() => {
  if (!search.value) return categories.value
  const kw = search.value.toLowerCase()
  return categories.value.filter(
    (c) =>
      c.name.toLowerCase().includes(kw) ||
      c.slug.toLowerCase().includes(kw),
  )
})

const sortedCategories = computed(() => {
  const list = [...filteredCategories.value]
  switch (sortBy.value) {
    case 'name':
      list.sort((a, b) => a.name.localeCompare(b.name))
      break
    case 'postCount_desc':
      list.sort((a, b) => b.postCount - a.postCount)
      break
    case 'postCount_asc':
      list.sort((a, b) => a.postCount - b.postCount)
      break
  }
  return list
})

// ---- DataTable 列定义 ----
const tableColumns = computed(() => [
  { title: '名称', key: 'name' as const, width: 160 },
  { title: 'Slug', key: 'slug' as const, width: 160, ellipsis: { tooltip: true } },
  {
    title: '文章数',
    key: 'postCount' as const,
    width: 80,
    sorter: (a: CategoryItem, b: CategoryItem) => a.postCount - b.postCount,
  },
  {
    title: '创建时间',
    key: 'createdAt' as const,
    width: 160,
    render(row: CategoryItem) {
      return formatDateTime(row.createdAt)
    },
  },
  {
    title: '操作',
    key: 'actions' as const,
    width: 120,
    render(row: CategoryItem) {
      return h('div', { class: 'action-cell flex items-center gap-1' }, [
        h(NButton, {
          size: 'tiny',
          quaternary: true,
          style: permissionStore.hasPermission('category:update') ? {} : { display: 'none' },
          onClick: () => openEdit(row),
        }, () => h(CreateOutline, { style: { width: '14px', height: '14px' } })),
        h(NPopconfirm, {
          'onPositive-click': () => handleDelete(row),
        }, {
          trigger: () => permissionStore.hasPermission('category:delete')
            ? h(NButton, { size: 'tiny', quaternary: true, type: 'error' }, () => h(TrashOutline, { style: { width: '14px', height: '14px' } }))
            : null,
          default: () => row.postCount > 0
            ? `该分类关联了 ${row.postCount} 篇文章,删除将解除关联。确定?`
            : '确认删除该分类?',
        }),
      ])
    },
  },
])

// ---- 点击卡片 → 展示文章列表 ----
const selectedSlug = ref<string | null>(null)
const selectedName = ref<string | null>(null)
const categoryPosts = ref<PostListItem[]>([])
const categoryPostsLoading = ref(false)
const categoryPostsPage = ref(1)
const categoryPostsTotal = ref(0)
const CATEGORY_POSTS_PAGE_SIZE = 10

async function loadCategoryPosts(slug: string, page: number = 1) {
  categoryPostsLoading.value = true
  try {
    const res = await apiGetPosts({
      category: slug,
      page,
      pageSize: CATEGORY_POSTS_PAGE_SIZE,
    })
    categoryPosts.value = res.items
    categoryPostsTotal.value = res.total
    categoryPostsPage.value = page
  } catch {
    categoryPosts.value = []
    categoryPostsTotal.value = 0
  } finally {
    categoryPostsLoading.value = false
  }
}

function selectCategory(slug: string, name: string) {
  if (selectedSlug.value === slug) {
    selectedSlug.value = null
    selectedName.value = null
    categoryPosts.value = []
    return
  }
  selectedSlug.value = slug
  selectedName.value = name
  loadCategoryPosts(slug)
}

function handleCategoryPageChange(page: number) {
  if (selectedSlug.value) {
    loadCategoryPosts(selectedSlug.value, page)
  }
}

// ---- 新建 / 编辑抽屉 ----
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

interface CategoryForm {
  name: string
  slug: string
}

const form = reactive<CategoryForm>({
  name: '',
  slug: '',
})

const formRules: FormRules = {
  name: [
    { required: true, message: '请输入分类名称', trigger: 'blur' },
    { max: 50, message: '名称不能超过 50 字', trigger: 'blur' },
  ],
  slug: [
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string) => {
        if (!value) return true
        if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
          return new Error('slug 须以小写字母或数字开头,只含小写字母 / 数字 / 连字符')
        }
        return true
      },
    },
  ],
}

function openCreate() {
  isEdit.value = false
  editingId.value = null
  Object.assign(form, { name: '', slug: '' })
  drawerVisible.value = true
}

function openEdit(row: CategoryItem) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, { name: row.name, slug: row.slug })
  drawerVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    if (isEdit.value && editingId.value !== null) {
      await apiUpdateCategory(editingId.value, {
        name: form.name,
        slug: form.slug || undefined,
      })
      message.success('分类已更新')
    } else {
      await apiCreateCategory({
        name: form.name,
        slug: form.slug || undefined,
      })
      message.success('分类已创建')
    }
    drawerVisible.value = false
    loadCategories()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '保存失败'
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: CategoryItem) {
  try {
    await apiDeleteCategory(row.id)
    message.success('已删除')
    if (selectedSlug.value === row.slug) {
      selectedSlug.value = null
      selectedName.value = null
      categoryPosts.value = []
    }
    loadCategories()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '删除失败'
    message.error(msg)
  }
}
</script>

<template>
  <div>
    <PageHeader title="分类管理" subtitle="管理文章分类">
      <NButton v-permission="'category:create'" type="primary" @click="openCreate">
        <template #icon>
          <AddOutline class="w-4 h-4" />
        </template>
        新建分类
      </NButton>
    </PageHeader>

    <!-- 搜索 + 排序 + 视图切换 -->
    <div class="flex flex-wrap items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-[180px] max-w-[300px]">
        <NInput v-model:value="search" placeholder="搜索分类名称 / slug" clearable>
          <template #prefix>
            <SearchOutline class="w-4 h-4 text-base-content/30" />
          </template>
        </NInput>
      </div>
      <NSelect
        v-model:value="sortBy"
        :options="SORT_OPTIONS"
        style="width: 170px"
      />
      <span class="text-sm text-base-content/30">共 {{ sortedCategories.length }} 个分类</span>
      <div class="ml-auto flex items-center gap-1 bg-base-200 rounded-lg p-0.5 border border-base-content/10">
        <NButton
          size="tiny"
          :type="viewMode === 'card' ? 'primary' : 'default'"
          quaternary
          @click="viewMode = 'card'"
          title="卡片视图"
        >
          <GridOutline class="w-4 h-4" />
        </NButton>
        <NButton
          size="tiny"
          :type="viewMode === 'table' ? 'primary' : 'default'"
          quaternary
          @click="viewMode = 'table'"
          title="列表视图"
        >
          <ListOutline class="w-4 h-4" />
        </NButton>
      </div>
    </div>

    <!-- 卡片视图 -->
    <template v-if="viewMode === 'card'">
      <div v-if="sortedCategories.length === 0 && !loading" class="py-16">
        <NEmpty description="暂无分类">
          <template #extra>
            <p class="text-sm text-base-content/40 mt-2">点击右上角"新建分类"添加</p>
          </template>
        </NEmpty>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        <div
          v-for="(row, idx) in sortedCategories"
          :key="row.id"
          :class="[
            'group rounded-xl border p-4 transition-all duration-300 cursor-pointer',
            selectedSlug === row.slug
              ? 'ring-2 ring-primary/40 scale-[1.02]'
              : 'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
            getColor(idx).border,
            getColor(idx).bg,
          ]"
          @click="selectCategory(row.slug, row.name)"
        >
          <div class="flex items-start justify-between">
            <div class="min-w-0 flex-1">
              <div class="font-medium text-sm" :class="getColor(idx).text">{{ row.name }}</div>
              <div class="text-xs text-base-content/30 mt-0.5 truncate">{{ row.slug }}</div>
            </div>
            <span
              class="shrink-0 ml-2 px-2 py-0.5 rounded-md text-[11px] font-medium"
              :class="getColor(idx).badge"
            >
              {{ row.postCount }} 篇
            </span>
          </div>

          <div class="flex items-center justify-between mt-3 pt-3 border-t border-base-content/5">
            <span class="text-[11px] text-base-content/20">{{ formatDateTime(row.createdAt) }}</span>
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <NButton
                v-if="permissionStore.hasPermission('category:update')"
                size="tiny"
                quaternary
                @click.stop="openEdit(row)"
              >
                <CreateOutline class="w-3.5 h-3.5" />
              </NButton>
              <NPopconfirm
                v-if="permissionStore.hasPermission('category:delete')"
                @positive-click="handleDelete(row)"
              >
                <template #trigger>
                  <NButton size="tiny" quaternary type="error" @click.stop>
                    <TrashOutline class="w-3.5 h-3.5" />
                  </NButton>
                </template>
                {{ row.postCount > 0 ? `该分类关联了 ${row.postCount} 篇文章,删除将解除关联。确定?` : '确认删除该分类?' }}
              </NPopconfirm>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 列表视图 -->
    <template v-else>
      <div v-if="sortedCategories.length === 0 && !loading" class="py-16">
        <NEmpty description="暂无分类">
          <template #extra>
            <p class="text-sm text-base-content/40 mt-2">点击右上角"新建分类"添加</p>
          </template>
        </NEmpty>
      </div>
      <NDataTable
        v-else
        :columns="tableColumns"
        :data="sortedCategories"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        striped
        size="small"
        class="rounded-xl overflow-hidden"
      />
    </template>

    <!-- 选中分类后的文章列表 -->
    <div v-if="selectedSlug" class="mt-8">
      <div class="flex items-center gap-2 mb-4">
        <div class="w-1 h-5 rounded-full bg-primary"></div>
        <h3 class="text-sm font-medium text-base-content">
          分类「{{ selectedName }}」下的文章
          <span class="text-base-content/30 font-normal">({{ categoryPostsTotal }} 篇)</span>
        </h3>
        <div class="flex-1" />
        <NButton size="tiny" quaternary @click="selectedSlug = null; categoryPosts = []">
          关闭
        </NButton>
      </div>

      <NSpin :show="categoryPostsLoading">
        <div v-if="categoryPosts.length === 0 && !categoryPostsLoading" class="py-8">
          <NEmpty description="暂无文章" />
        </div>

        <div v-else class="space-y-2">
          <div
            v-for="post in categoryPosts"
            :key="post.id"
            class="flex items-center gap-3 px-4 py-3 rounded-xl bg-base-100 border border-base-content/5 hover:border-primary/20 transition-colors cursor-pointer"
            @click="router.push({ name: 'cms-post-edit', params: { id: String(post.id) } })"
          >
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-base-content truncate">{{ post.title }}</div>
              <div class="text-xs text-base-content/30 mt-0.5 truncate">{{ post.slug }}</div>
            </div>
            <NTag
              :type="post.status === 'published' ? 'success' : 'default'"
              size="tiny"
              :bordered="false"
            >
              {{ post.status === 'published' ? '已发布' : '草稿' }}
            </NTag>
            <span class="text-xs text-base-content/20 shrink-0">{{ formatDateTime(post.updatedAt) }}</span>
          </div>
        </div>

        <div v-if="categoryPostsTotal > CATEGORY_POSTS_PAGE_SIZE" class="mt-4 flex justify-center">
          <NPagination
            :page="categoryPostsPage"
            :page-size="CATEGORY_POSTS_PAGE_SIZE"
            :item-count="categoryPostsTotal"
            @update:page="handleCategoryPageChange"
          />
        </div>
      </NSpin>
    </div>

    <!-- FormDrawer -->
    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑分类' : '新建分类'"
      :loading="submitting"
      :width="480"
      @submit="handleSubmit"
    >
      <NForm
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-placement="left"
        label-width="80"
        require-mark-placement="right-hanging"
      >
        <NFormItem label="名称" path="name">
          <NInput v-model:value="form.name" placeholder="如 前端架构" />
        </NFormItem>
        <NFormItem label="Slug" path="slug">
          <NInput
            v-model:value="form.slug"
            :placeholder="isEdit ? '' : '可选,留空将由名称自动生成'"
          />
        </NFormItem>
      </NForm>
    </FormDrawer>
  </div>
</template>
