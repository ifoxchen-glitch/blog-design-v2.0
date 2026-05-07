<script setup lang="ts">
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
  NEmpty,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { CreateOutline, TrashOutline, KeyOutline, GridOutline, ListOutline } from '@vicons/ionicons5'
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

// ---- 视图模式 ----
type ViewMode = 'card' | 'table'
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
const viewMode = ref<ViewMode>(isMobile ? 'card' : 'table')

// ---- 卡片颜色 ----
const CARD_COLORS = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
  { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
]

function getColor(index: number) {
  return CARD_COLORS[index % CARD_COLORS.length]
}

// ---- 列表搜索 ----
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

// ---- 卡片数据 ----
const cardKeyword = ref('')
const cardData = ref<UserItem[]>([])
const cardLoading = ref(false)

async function loadCardData() {
  cardLoading.value = true
  try {
    const res = await apiGetUsers({ page: 1, pageSize: 999 })
    cardData.value = res.items
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    cardLoading.value = false
  }
}
loadCardData()

const filteredCardData = computed(() => {
  if (!cardKeyword.value) return cardData.value
  const kw = cardKeyword.value.toLowerCase()
  return cardData.value.filter(
    (u) =>
      u.username.toLowerCase().includes(kw) ||
      u.email.toLowerCase().includes(kw) ||
      (u.displayName ?? '').toLowerCase().includes(kw),
  )
})

// ---- 抽屉表单 ----
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
    loadCardData()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '保存失败'
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

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

async function handleDelete(row: UserItem) {
  try {
    await apiDeleteUser(row.id)
    message.success('已删除')
    refreshTable()
    loadCardData()
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
      if (!row.roles || row.roles.length === 0) return h('span', { class: 'text-base-content/30' }, '—')
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
    width: 140,
    fixed: 'right',
    render(row: UserItem) {
      const buttons: VNode[] = []
      const canUpdate = permissionStore.hasPermission('user:update')
      const canDelete = permissionStore.hasPermission('user:delete')
      if (canUpdate) {
        buttons.push(
          h(NButton, { size: 'tiny', quaternary: true, title: '编辑', onClick: () => openEdit(row) }, {
            icon: () => h(CreateOutline, { style: 'width:14px;height:14px' }),
          }),
        )
        buttons.push(
          h(NButton, { size: 'tiny', quaternary: true, title: '重置密码', onClick: () => openReset(row) }, {
            icon: () => h(KeyOutline, { style: 'width:14px;height:14px' }),
          }),
        )
      }
      if (canDelete && !row.isSuperAdmin) {
        buttons.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              trigger: () =>
                h(NButton, { size: 'tiny', quaternary: true, type: 'error', title: '删除' }, {
                  icon: () => h(TrashOutline, { style: 'width:14px;height:14px' }),
                }),
              default: () => '确认删除该用户?',
            },
          ),
        )
      }
      if (buttons.length === 0) return h('span', { class: 'text-base-content/30' }, '—')
      return h('div', { class: 'action-cell' }, [h(NSpace, { size: 2 }, { default: () => buttons })])
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

    <!-- 视图切换 -->
    <div class="flex items-center justify-end mb-4">
      <div class="flex items-center gap-1 bg-base-200 rounded-lg p-0.5 border border-base-content/10">
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
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <NInput
          v-model:value="cardKeyword"
          placeholder="搜索用户名 / 邮箱"
          clearable
          style="width: 260px"
        />
        <span class="text-sm text-base-content/30">共 {{ filteredCardData.length }} 个用户</span>
      </div>

      <div v-if="filteredCardData.length === 0" class="py-16">
        <NEmpty description="暂无用户" />
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div
          v-for="(row, idx) in filteredCardData"
          :key="row.id"
          :class="[
            'rounded-xl border p-4 transition-all duration-300',
            'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
            getColor(idx).border,
            getColor(idx).bg,
          ]"
        >
          <!-- 头部：用户名 + 状态 -->
          <div class="flex items-start justify-between mb-2">
            <div class="min-w-0 flex-1">
              <div class="font-medium text-sm" :class="getColor(idx).text">{{ row.username }}</div>
              <div class="text-xs text-base-content/30 mt-0.5 truncate">{{ row.email }}</div>
            </div>
            <NTag
              :type="row.status === 'active' ? 'success' : 'default'"
              size="tiny"
              :bordered="false"
            >
              {{ row.status === 'active' ? '正常' : '禁用' }}
            </NTag>
          </div>

          <!-- 显示名 -->
          <div v-if="row.displayName" class="text-xs text-base-content/40 mb-2">
            显示名：{{ row.displayName }}
          </div>

          <!-- 角色标签 -->
          <div v-if="row.roles && row.roles.length > 0" class="flex flex-wrap gap-1 mb-2">
            <NTag
              v-for="r in row.roles"
              :key="r.id"
              size="tiny"
              type="info"
              :bordered="false"
            >
              {{ r.name }}
            </NTag>
          </div>

          <!-- 时间 -->
          <div class="text-[11px] text-base-content/20">
            <div>最后登录：{{ formatDateTime(row.lastLoginAt) }}</div>
            <div>创建时间：{{ formatDateTime(row.createdAt) }}</div>
          </div>

          <!-- 操作按钮 -->
          <div class="flex items-center gap-1 mt-3 pt-3 border-t border-base-content/5">
            <template v-if="permissionStore.hasPermission('user:update')">
              <NButton size="tiny" quaternary @click="openEdit(row)">
                <CreateOutline class="w-3.5 h-3.5" />
                编辑
              </NButton>
              <NButton size="tiny" quaternary @click="openReset(row)">
                <KeyOutline class="w-3.5 h-3.5" />
                重置
              </NButton>
            </template>
            <NPopconfirm
              v-if="permissionStore.hasPermission('user:delete') && !row.isSuperAdmin"
              @positive-click="handleDelete(row)"
            >
              <template #trigger>
                <NButton size="tiny" quaternary type="error">
                  <TrashOutline class="w-3.5 h-3.5" />
                  删除
                </NButton>
              </template>
              确认删除该用户?
            </NPopconfirm>
          </div>
        </div>
      </div>
    </template>

    <!-- 列表视图 -->
    <template v-else>
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
    </template>

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
      <div class="mt-3">
        <p v-if="resetTarget" class="mb-3 text-base-content/60">
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
