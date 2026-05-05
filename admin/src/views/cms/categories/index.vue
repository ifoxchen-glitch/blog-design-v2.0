<script setup lang="ts">
// 分类管理页 — T2.29
// 设计文档:docs/10-phase2-cms-frontend-plan.md §3
//
// 偏离设计文档之处:
// (P1) DataTable 用 :fetch + #search slot,而非设计文档假设的 :query v-bind
// (P3) 路由用 /cms/categories(带 cms 前缀),与 menus seed 对齐
// (P8) apiGetCategories 返回 { items, total },前端包一层转 { list, total }
// (P9) 后端 409 错误码细分 name_taken / slug_taken,前端做友好提示

import { computed, h, reactive, ref, type VNode } from 'vue'
import axios from 'axios'
import {
  NButton,
  NInput,
  NSpace,
  NPopconfirm,
  NForm,
  NFormItem,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import DataTable from '../../../components/common/DataTable.vue'
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

const fetchCategories = async () => {
  const res = await apiGetCategories()
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

const formRules = computed<FormRules>(() => ({
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
}))

function openCreate() {
  isEdit.value = false
  editingId.value = null
  Object.assign(form, { name: '', slug: '' })
  drawerVisible.value = true
}

function openEdit(row: CategoryItem) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    name: row.name,
    slug: row.slug,
  })
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
    refreshTable()
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
    refreshTable()
  } catch (e: unknown) {
    message.error(extractCategoryError(e, '删除失败'))
  }
}

const columns: DataTableColumns<CategoryItem> = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '名称', key: 'name', width: 160 },
  { title: 'Slug', key: 'slug', width: 200 },
  { title: '文章数', key: 'postCount', width: 100 },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 180,
    render(row: CategoryItem) {
      return formatDateTime(row.createdAt)
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render(row: CategoryItem) {
      const buttons: VNode[] = []
      const canUpdate = permissionStore.hasPermission('category:update')
      const canDelete = permissionStore.hasPermission('category:delete')
      if (canUpdate) {
        buttons.push(
          h(
            NButton,
            { size: 'small', onClick: () => openEdit(row) },
            { default: () => '编辑' },
          ),
        )
      }
      if (canDelete) {
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
              default: () =>
                row.postCount > 0
                  ? `该分类关联了 ${row.postCount} 篇文章,删除将解除关联。确定?`
                  : '确认删除该分类?',
            },
          ),
        )
      }
      if (buttons.length === 0) return h('span', { style: 'color: #999' }, '—')
      return h(NSpace, { size: 4 }, { default: () => buttons })
    },
  },
]
</script>

<template>
  <div>
    <PageHeader title="分类管理" subtitle="管理文章分类">
      <NButton
        v-permission="'category:create'"
        type="primary"
        @click="openCreate"
      >
        新建分类
      </NButton>
    </PageHeader>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchCategories"
      :row-key="(row: CategoryItem) => row.id"
    />

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
