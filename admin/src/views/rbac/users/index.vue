<script setup lang="ts">
// 用户管理页 — T2.22
// 设计文档:docs/09-phase2-rbac-frontend-plan.md §2
//
// 偏离设计文档之处(已在计划中说明):
// (B) 用 :fetch 而非 :api 对齐实际 DataTable 实现
// (C) 把 status / keyword 放进 query reactive,DataTable 内部 useTable 的 watch
//     会在变更时自动 page=1 + refresh,不再需要外部 filterStatus + 手动 fetch
// (D) DataTable 已暴露 refresh / clearSelection,用 slot 的 scoped 参数即可
// (G) apiResetPassword 在 rbac.ts 内部把 newPassword 转 snake_case,这里直接传

import { computed, h, reactive, ref, type VNode } from 'vue'
import {
  NButton,
  NInput,
  NSelect,
  NTag,
  NSpace,
  NPopconfirm,
  NModal,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import DataTable from '../../../components/common/DataTable.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetUsers,
  apiCreateUser,
  apiUpdateUser,
  apiDeleteUser,
  apiResetPassword,
  apiAssignUserRoles,
  type UserItem,
} from '../../../api/rbac'
import { useRoleOptions } from '../../../composables/useRoleOptions'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'

const message = useMessage()
const permissionStore = usePermissionStore()
const { roleOptions, reload: reloadRoles } = useRoleOptions(true)

// ---- DataTable query (keyword + status) ----
interface UserQuery {
  keyword: string
  status: 'active' | 'disabled' | ''
}
const initialQuery: UserQuery = { keyword: '', status: '' }

const statusOptions = [
  { label: '正常', value: 'active' },
  { label: '禁用', value: 'disabled' },
]

const fetchUsers = async (params: UserQuery & { page: number; pageSize: number }) => {
  const res = await apiGetUsers({
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

// ---- 新建 / 编辑抽屉 ----
const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

interface UserForm {
  username: string
  email: string
  displayName: string
  password: string
  status: 'active' | 'disabled'
  roleIds: number[]
}

const form = reactive<UserForm>({
  username: '',
  email: '',
  displayName: '',
  password: '',
  status: 'active',
  roleIds: [],
})

const formRules = computed<FormRules>(() => ({
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '邮箱格式不正确', trigger: ['blur', 'input'] },
  ],
  password: isEdit.value
    ? []
    : [
        { required: true, message: '请输入密码', trigger: 'blur' },
        { min: 6, message: '密码至少 6 位', trigger: 'blur' },
      ],
}))

async function openCreate() {
  isEdit.value = false
  editingId.value = null
  Object.assign(form, {
    username: '',
    email: '',
    displayName: '',
    password: '',
    status: 'active',
    roleIds: [],
  })
  await reloadRoles()
  drawerVisible.value = true
}

async function openEdit(row: UserItem) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    username: row.username,
    email: row.email,
    displayName: row.displayName ?? '',
    password: '',
    status: row.status,
    roleIds: row.roles?.map((r) => r.id) ?? [],
  })
  await reloadRoles()
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
      await apiUpdateUser(editingId.value, {
        username: form.username,
        email: form.email,
        displayName: form.displayName || undefined,
        status: form.status,
      })
      await apiAssignUserRoles(editingId.value, form.roleIds)
      message.success('用户已更新')
    } else {
      const user = await apiCreateUser({
        username: form.username,
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        status: form.status,
      })
      if (form.roleIds.length > 0) {
        await apiAssignUserRoles(user.id, form.roleIds)
      }
      message.success('用户已创建')
    }
    drawerVisible.value = false
    refreshTable()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '保存失败'
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

// ---- 重置密码 ----
const resetModalVisible = ref(false)
const resetTarget = ref<UserItem | null>(null)
const resetting = ref(false)
const newPassword = ref('')

function openReset(row: UserItem) {
  resetTarget.value = row
  newPassword.value = ''
  resetModalVisible.value = true
}

async function confirmReset() {
  if (!resetTarget.value) return
  if (newPassword.value.length < 6) {
    message.error('新密码至少 6 位')
    return
  }
  resetting.value = true
  try {
    await apiResetPassword(resetTarget.value.id, newPassword.value)
    message.success('密码已重置')
    resetModalVisible.value = false
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '重置失败'
    message.error(msg)
  } finally {
    resetting.value = false
  }
}

// ---- 删除 / 批量删除 ----
async function handleDelete(row: UserItem) {
  try {
    await apiDeleteUser(row.id)
    message.success('已删除')
    refreshTable()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '删除失败'
    message.error(msg)
  }
}

async function batchDelete(
  keys: Array<string | number>,
  clearSelection: () => void,
  refresh: () => void,
) {
  if (keys.length === 0) return
  let okCount = 0
  let failCount = 0
  for (const k of keys) {
    try {
      await apiDeleteUser(Number(k))
      okCount += 1
    } catch {
      failCount += 1
    }
  }
  if (failCount === 0) {
    message.success(`已删除 ${okCount} 条`)
  } else {
    message.warning(`成功 ${okCount} 条,失败 ${failCount} 条`)
  }
  clearSelection()
  refresh()
}

// ---- 列定义 ----
const columns: DataTableColumns<UserItem> = [
  { type: 'selection' },
  { title: 'ID', key: 'id', width: 70 },
  { title: '用户名', key: 'username', width: 140 },
  { title: '邮箱', key: 'email', width: 200 },
  { title: '显示名', key: 'displayName', width: 140 },
  {
    title: '角色',
    key: 'roles',
    width: 200,
    render(row: UserItem) {
      if (!row.roles || row.roles.length === 0) return h('span', { style: 'color: #999' }, '—')
      return h(
        NSpace,
        { size: 4 },
        {
          default: () =>
            row.roles.map((r) =>
              h(NTag, { size: 'small', type: 'info' }, { default: () => r.name }),
            ),
        },
      )
    },
  },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row: UserItem) {
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
  {
    title: '最后登录',
    key: 'lastLoginAt',
    width: 160,
    render(row: UserItem) {
      return formatDateTime(row.lastLoginAt)
    },
  },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 160,
    render(row: UserItem) {
      return formatDateTime(row.createdAt)
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 240,
    fixed: 'right',
    render(row: UserItem) {
      const buttons: VNode[] = []
      const canUpdate = permissionStore.hasPermission('user:update')
      const canDelete = permissionStore.hasPermission('user:delete')
      if (canUpdate) {
        buttons.push(
          h(
            NButton,
            { size: 'small', onClick: () => openEdit(row) },
            { default: () => '编辑' },
          ),
        )
        buttons.push(
          h(
            NButton,
            { size: 'small', onClick: () => openReset(row) },
            { default: () => '重置密码' },
          ),
        )
      }
      // 超管不可删
      if (canDelete && !row.isSuperAdmin) {
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
              default: () => '确认删除该用户?',
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
    <PageHeader title="用户管理" subtitle="管理系统后台用户账号">
      <NButton
        v-permission="'user:create'"
        type="primary"
        @click="openCreate"
      >
        新建用户
      </NButton>
    </PageHeader>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchUsers"
      :initial-query="initialQuery"
      :row-key="(row: UserItem) => row.id"
      selectable
    >
      <template #search="{ query }">
        <NSpace :size="8" style="width: 100%">
          <NInput
            v-model:value="(query as UserQuery).keyword"
            placeholder="搜索用户名 / 邮箱"
            clearable
            style="width: 240px"
          />
          <NSelect
            v-model:value="(query as UserQuery).status"
            :options="statusOptions"
            placeholder="状态"
            clearable
            style="width: 120px"
          />
        </NSpace>
      </template>

      <template #toolbar="{ selectedKeys, clearSelection, refresh }">
        <NPopconfirm
          v-if="selectedKeys.length > 0"
          @positive-click="() => batchDelete(selectedKeys, clearSelection, refresh)"
        >
          <template #trigger>
            <NButton
              v-permission="'user:delete'"
              size="small"
              type="error"
            >
              批量删除 ({{ selectedKeys.length }})
            </NButton>
          </template>
          确认批量删除选中的 {{ selectedKeys.length }} 条记录?
        </NPopconfirm>
      </template>
    </DataTable>

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑用户' : '新建用户'"
      :loading="submitting"
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
        <NFormItem label="用户名" path="username">
          <NInput
            v-model:value="form.username"
            :disabled="isEdit"
            placeholder="登录用户名"
          />
        </NFormItem>
        <NFormItem label="邮箱" path="email">
          <NInput v-model:value="form.email" placeholder="user@example.com" />
        </NFormItem>
        <NFormItem label="显示名" path="displayName">
          <NInput v-model:value="form.displayName" placeholder="可选,展示用" />
        </NFormItem>
        <NFormItem v-if="!isEdit" label="密码" path="password">
          <NInput
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="至少 6 位"
          />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <NRadioGroup v-model:value="form.status">
            <NRadioButton value="active">正常</NRadioButton>
            <NRadioButton value="disabled">禁用</NRadioButton>
          </NRadioGroup>
        </NFormItem>
        <NFormItem label="角色" path="roleIds">
          <NSelect
            v-model:value="form.roleIds"
            multiple
            :options="roleOptions"
            placeholder="选择角色"
            clearable
          />
        </NFormItem>
      </NForm>
    </FormDrawer>

    <NModal
      v-model:show="resetModalVisible"
      preset="dialog"
      title="重置密码"
      :positive-text="undefined"
      :negative-text="undefined"
      :show-icon="false"
    >
      <div style="margin-top: 12px">
        <p v-if="resetTarget" style="margin: 0 0 12px; color: #666">
          为用户 <strong>{{ resetTarget.username }}</strong> 设置新密码
        </p>
        <NInput
          v-model:value="newPassword"
          type="password"
          show-password-on="click"
          placeholder="至少 6 位"
        />
      </div>
      <template #action>
        <NSpace>
          <NButton @click="resetModalVisible = false">取消</NButton>
          <NButton type="primary" :loading="resetting" @click="confirmReset">
            确认
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
