<script setup lang="ts">
// 角色管理页 — T2.23
// 设计文档:docs/09-phase2-rbac-frontend-plan.md §3
//
// 偏离设计文档之处:
// (B) 用 :fetch 而非 :api(对齐实际 DataTable 实现)
// (H) apiGetRoles 不分页,这里包一层把 { items, total } 转 { list, total } 喂给 useTable
// (I) NTree 用 cascade 模式,叶子是 permission.id;父节点 key 是 `group-${resource}` 字符串,
//     不会出现在 checked-keys 里(cascade 只返回叶子)
// (J) 删除错误码 409 → "角色被引用"、403 → "内置角色不可删";其它统一弹后端 message

import { computed, h, reactive, ref, type VNode } from 'vue'
import axios from 'axios'
import {
  NButton,
  NInput,
  NTag,
  NSpace,
  NPopconfirm,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  NTree,
  NSpin,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import DataTable from '../../../components/common/DataTable.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetRoles,
  apiGetRole,
  apiCreateRole,
  apiUpdateRole,
  apiDeleteRole,
  apiAssignRolePermissions,
  type RoleItem,
} from '../../../api/rbac'
import { usePermissionOptions } from '../../../composables/usePermissionOptions'
import { usePermissionStore } from '../../../stores/permission'

const message = useMessage()
const permissionStore = usePermissionStore()
const { permissionTree, loading: permissionsLoading, reload: reloadPermissions } =
  usePermissionOptions(true)

// ---- DataTable fetch(后端不分页,前端包一层适配 useTable) ----
const fetchRoles = async () => {
  const res = await apiGetRoles()
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

// ---- 新建 / 编辑抽屉 ----
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const detailLoading = ref(false)
const formRef = ref<FormInst | null>(null)

interface RoleForm {
  code: string
  name: string
  description: string
  status: 'active' | 'disabled'
  permissionIds: number[]
}

const form = reactive<RoleForm>({
  code: '',
  name: '',
  description: '',
  status: 'active',
  permissionIds: [],
})

const formRules = computed<FormRules>(() => ({
  code: isEdit.value
    ? []
    : [
        { required: true, message: '请输入角色编码', trigger: 'blur' },
        {
          pattern: /^[a-z][a-z0-9_]*$/,
          message: '编码须以小写字母开头,只含小写字母 / 数字 / 下划线',
          trigger: 'blur',
        },
      ],
  name: { required: true, message: '请输入角色名称', trigger: 'blur' },
}))

async function openCreate() {
  isEdit.value = false
  editingId.value = null
  Object.assign(form, {
    code: '',
    name: '',
    description: '',
    status: 'active',
    permissionIds: [],
  })
  await reloadPermissions()
  drawerVisible.value = true
}

async function openEdit(row: RoleItem) {
  isEdit.value = true
  editingId.value = row.id
  // 先打开抽屉再拉详情(避免空白等待)
  Object.assign(form, {
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    status: row.status,
    permissionIds: [],
  })
  drawerVisible.value = true
  detailLoading.value = true
  try {
    const [detail] = await Promise.all([apiGetRole(row.id), reloadPermissions()])
    form.permissionIds = detail.permissions.map((p) => p.id)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '加载角色详情失败'
    message.error(msg)
  } finally {
    detailLoading.value = false
  }
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
      await apiUpdateRole(editingId.value, {
        name: form.name,
        description: form.description || undefined,
        status: form.status,
      })
      await apiAssignRolePermissions(editingId.value, form.permissionIds)
      message.success('角色已更新')
    } else {
      const role = await apiCreateRole({
        code: form.code,
        name: form.name,
        description: form.description || undefined,
        status: form.status,
      })
      if (form.permissionIds.length > 0) {
        await apiAssignRolePermissions(role.id, form.permissionIds)
      }
      message.success('角色已创建')
    }
    drawerVisible.value = false
    refreshTable()
  } catch (e: unknown) {
    const msg = extractApiError(e, '保存失败')
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

// ---- 删除 ----
async function handleDelete(row: RoleItem) {
  try {
    await apiDeleteRole(row.id)
    message.success('已删除')
    refreshTable()
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      const status = e.response?.status
      if (status === 409) {
        message.error('该角色被用户引用,先移除关联')
        return
      }
      if (status === 403) {
        message.error('内置角色不可删除')
        return
      }
    }
    const msg = extractApiError(e, '删除失败')
    message.error(msg)
  }
}

function extractApiError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message) return data.message
  }
  if (e instanceof Error) return e.message
  return fallback
}

// ---- 列定义 ----
const columns: DataTableColumns<RoleItem> = [
  { title: 'ID', key: 'id', width: 70 },
  { title: '编码', key: 'code', width: 160 },
  { title: '名称', key: 'name', width: 140 },
  { title: '描述', key: 'description', ellipsis: { tooltip: true } },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row: RoleItem) {
      return h(
        NTag,
        {
          type: row.status === 'active' ? 'success' : 'default',
          size: 'small',
        },
        { default: () => (row.status === 'active' ? '正常' : '禁用') },
      )
    },
  },
  { title: '用户数', key: 'userCount', width: 80 },
  { title: '权限数', key: 'permissionCount', width: 80 },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render(row: RoleItem) {
      const buttons: VNode[] = []
      const canAssign = permissionStore.hasPermission('role:assign')
      if (canAssign) {
        buttons.push(
          h(
            NButton,
            { size: 'small', onClick: () => openEdit(row) },
            { default: () => '编辑' },
          ),
        )
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
              default: () => '确认删除该角色?',
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
    <PageHeader title="角色管理" subtitle="管理系统角色及其权限">
      <NButton
        v-permission="'role:assign'"
        type="primary"
        @click="openCreate"
      >
        新建角色
      </NButton>
    </PageHeader>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchRoles"
      :row-key="(row: RoleItem) => row.id"
    />

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑角色' : '新建角色'"
      :loading="submitting"
      :width="560"
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
        <NFormItem label="角色编码" path="code">
          <NInput
            v-model:value="form.code"
            :disabled="isEdit"
            placeholder="如 content_admin"
          />
        </NFormItem>
        <NFormItem label="角色名称" path="name">
          <NInput v-model:value="form.name" placeholder="如 内容管理员" />
        </NFormItem>
        <NFormItem label="描述" path="description">
          <NInput
            v-model:value="form.description"
            type="textarea"
            placeholder="可选"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <NRadioGroup v-model:value="form.status">
            <NRadioButton value="active">正常</NRadioButton>
            <NRadioButton value="disabled">禁用</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="权限">
          <NSpin :show="detailLoading || permissionsLoading" style="width: 100%">
            <NTree
              v-model:checked-keys="form.permissionIds"
              :data="permissionTree"
              checkable
              cascade
              block-line
              expand-on-click
              :default-expand-all="false"
              style="max-height: 360px; overflow: auto"
            />
          </NSpin>
        </NFormItem>
      </NForm>
    </FormDrawer>
  </div>
</template>
