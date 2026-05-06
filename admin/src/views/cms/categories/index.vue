<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import axios from 'axios'
import {
  NButton,
  NInput,
  NForm,
  NFormItem,
  NPopconfirm,
  NEmpty,
  useMessage,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { CreateOutline, TrashOutline, SearchOutline, AddOutline } from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetCategories,
  apiCreateCategory,
  apiUpdateCategory,
  apiDeleteCategory,
  type CategoryItem,
} from '../../../api/cms'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'

const message = useMessage()
const permissionStore = usePermissionStore()

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

function extractCategoryError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message === 'name_taken') return '该名称已被占用'
    if (data?.message === 'slug_taken') return '该 slug 已被占用'
    if (data?.message) return data.message
  }
  if (e instanceof Error) return e.message
  return fallback
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
    message.error(extractCategoryError(e, '保存失败'))
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: CategoryItem) {
  try {
    await apiDeleteCategory(row.id)
    message.success('已删除')
    loadCategories()
  } catch (e: unknown) {
    message.error(extractCategoryError(e, '删除失败'))
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

    <!-- 搜索 -->
    <div class="flex items-center gap-3 mb-5">
      <div class="relative flex-1 min-w-[200px] max-w-[360px]">
        <NInput v-model:value="search" placeholder="搜索分类名称 / slug" clearable>
          <template #prefix>
            <SearchOutline class="w-4 h-4 text-base-content/30" />
          </template>
        </NInput>
      </div>
      <span class="text-sm text-base-content/30">共 {{ filteredCategories.length }} 个分类</span>
    </div>

    <!-- 卡片网格 -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <div
        v-for="row in filteredCategories"
        :key="row.id"
        class="group bg-base-100 rounded-xl border border-base-content/5 p-4 hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
      >
        <div class="flex items-start justify-between">
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm text-base-content truncate">{{ row.name }}</div>
            <div class="text-xs text-base-content/30 mt-0.5 truncate">{{ row.slug }}</div>
          </div>
          <span class="shrink-0 ml-2 px-2 py-0.5 rounded-md bg-base-content/5 text-base-content/40 text-[11px] font-medium">
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
              @click="openEdit(row)"
            >
              <CreateOutline class="w-3.5 h-3.5" />
            </NButton>
            <NPopconfirm
              v-if="permissionStore.hasPermission('category:delete')"
              @positive-click="handleDelete(row)"
            >
              <template #trigger>
                <NButton size="tiny" quaternary type="error">
                  <TrashOutline class="w-3.5 h-3.5" />
                </NButton>
              </template>
              {{ row.postCount > 0 ? `该分类关联了 ${row.postCount} 篇文章,删除将解除关联。确定?` : '确认删除该分类?' }}
            </NPopconfirm>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="filteredCategories.length === 0 && !loading" class="py-16">
      <NEmpty description="暂无分类">
        <template #extra>
          <p class="text-sm text-base-content/40 mt-2">点击右上角"新建分类"添加</p>
        </template>
      </NEmpty>
    </div>

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
