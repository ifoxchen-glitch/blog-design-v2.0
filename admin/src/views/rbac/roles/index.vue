<script setup lang="ts">
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
  NEmpty,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { CreateOutline, TrashOutline, GridOutline, ListOutline } from '@vicons/ionicons5'
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

// ---- 视图模式 ----
type ViewMode = 'card' | 'table'
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
const viewMode = ref<ViewMode>(isMobile ? 'card' : 'table')

// ---- 卡片颜色 ----
const CARD_COLORS = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400', badge: 'bg-blue-500/15 text-blue-400' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400', badge: 'bg-emerald-500/15 text-emerald-400' },
  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400', badge: 'bg-purple-500/15 text-purple-400' },
  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400', badge: 'bg-amber-500/15 text-amber-400' },
  { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400', badge: 'bg-rose-500/15 text-rose-400' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', dot: 'bg-cyan-400', badge: 'bg-cyan-500/15 text-cyan-400' },
]

function getColor(index: number) {
  return CARD_COLORS[index % CARD_COLORS.length]
}

// ---- 数据 ----
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

// ---- 卡片数据 ----
const cardData = ref<RoleItem[]>([])
const cardLoading = ref(false)

async function loadCardData() {
  cardLoading.value = true
  try {
    const res = await apiGetRoles()
    cardData.value = res.items
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    cardLoading.value = false
  }
}
loadCardData()

// ---- 抽屉表单 ----
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
    loadCardData()
  } catch (e: unknown) {
    const msg = extractApiError(e, '保存失败')
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: RoleItem) {
  try {
    await apiDeleteRole(row.id)
    message.success('已删除')
    refreshTable()
    loadCardData()
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
        { type: row.status === 'active' ? 'success' : 'default', size: 'small' },
        { default: () => (row.status === 'active' ? '正常' : '禁用') },
      )
    },
  },
  { title: '用户数', key: 'userCount', width: 80 },
  { title: '权限数', key: 'permissionCount', width: 80 },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    fixed: 'right',
    render(row: RoleItem) {
      const buttons: VNode[] = []
      const canAssign = permissionStore.hasPermission('role:assign')
      if (canAssign) {
        buttons.push(
          h(NButton, { size: 'tiny', quaternary: true, title: '编辑', onClick: () => openEdit(row) }, {
            icon: () => h(CreateOutline, { style: 'width:14px;height:14px' }),
          }),
        )
        buttons.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              trigger: () =>
                h(NButton, { size: 'tiny', quaternary: true, type: 'error', title: '删除' }, {
                  icon: () => h(TrashOutline, { style: 'width:14px;height:14px' }),
                }),
              default: () => '确认删除该角色?',
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
    <PageHeader title="角色管理" subtitle="管理系统角色及其权限">
      <NButton v-permission="'role:assign'" type="primary" @click="openCreate">
        新建角色
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
      <NSpin :show="cardLoading">
        <div v-if="cardData.length === 0 && !cardLoading" class="py-16">
          <NEmpty description="暂无角色" />
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="(row, idx) in cardData"
            :key="row.id"
            :class="[
              'rounded-xl border p-4 transition-all duration-300',
              'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
              getColor(idx).border,
              getColor(idx).bg,
            ]"
          >
            <div class="flex items-start justify-between mb-2">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-sm" :class="getColor(idx).text">{{ row.name }}</div>
                <div class="text-xs text-base-content/30 mt-0.5 font-mono">{{ row.code }}</div>
              </div>
              <NTag
                :type="row.status === 'active' ? 'success' : 'default'"
                size="tiny"
                :bordered="false"
              >
                {{ row.status === 'active' ? '正常' : '禁用' }}
              </NTag>
            </div>

            <p v-if="row.description" class="text-xs text-base-content/40 line-clamp-2 mb-3">
              {{ row.description }}
            </p>

            <div class="flex items-center gap-3 text-xs text-base-content/30">
              <span>用户 {{ row.userCount ?? 0 }}</span>
              <span class="text-base-content/10">|</span>
              <span>权限 {{ row.permissionCount ?? 0 }}</span>
            </div>

            <div v-if="permissionStore.hasPermission('role:assign')" class="flex items-center gap-1 mt-3 pt-3 border-t border-base-content/5">
              <NButton size="tiny" quaternary @click="openEdit(row)">
                <CreateOutline class="w-3.5 h-3.5" />
                编辑
              </NButton>
              <NPopconfirm @positive-click="handleDelete(row)">
                <template #trigger>
                  <NButton size="tiny" quaternary type="error">
                    <TrashOutline class="w-3.5 h-3.5" />
                    删除
                  </NButton>
                </template>
                确认删除该角色?
              </NPopconfirm>
            </div>
          </div>
        </div>
      </NSpin>
    </template>

    <!-- 列表视图 -->
    <template v-else>
      <DataTable
        ref="tableRef"
        :columns="columns"
        :fetch="fetchRoles"
        :row-key="(row: RoleItem) => row.id"
      />
    </template>

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
          <NInput v-model:value="form.code" :disabled="isEdit" placeholder="如 content_admin" />
        </NFormItem>
        <NFormItem label="角色名称" path="name">
          <NInput v-model:value="form.name" placeholder="如 内容管理员" />
        </NFormItem>
        <NFormItem label="描述" path="description">
          <NInput v-model:value="form.description" type="textarea" placeholder="可选" :autosize="{ minRows: 2, maxRows: 4 }" />
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
