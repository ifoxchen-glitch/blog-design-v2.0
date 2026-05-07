<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, type VNode } from 'vue'
import axios from 'axios'
import {
  NButton,
  NInput,
  NInputNumber,
  NSelect,
  NCascader,
  NTag,
  NSpace,
  NPopconfirm,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadioButton,
  NDataTable,
  NSpin,
  NEmpty,
  useMessage,
  useDialog,
  type CascaderOption,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import { CreateOutline, TrashOutline, AddOutline, GridOutline, ListOutline } from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetMenus,
  apiCreateMenu,
  apiUpdateMenu,
  apiDeleteMenu,
  type MenuItem,
} from '../../../api/rbac'
import { usePermissionOptions } from '../../../composables/usePermissionOptions'
import { usePermissionStore } from '../../../stores/permission'

const message = useMessage()
const dialog = useDialog()
const permissionStore = usePermissionStore()
const { permissionOptions, reload: reloadPermissions } = usePermissionOptions(true)

// ---- 视图模式 ----
type ViewMode = 'card' | 'table'
const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
const viewMode = ref<ViewMode>(isMobile ? 'card' : 'table')

// ---- 卡片颜色 ----
const CARD_COLORS = [
  { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400' },
  { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20', dot: 'bg-rose-400' },
  { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20', dot: 'bg-cyan-400' },
]

function getColor(index: number) {
  return CARD_COLORS[index % CARD_COLORS.length]
}

const ROOT_PARENT = 0

const menuTree = ref<MenuItem[]>([])
const tableLoading = ref(false)

async function loadMenus() {
  tableLoading.value = true
  try {
    const res = await apiGetMenus()
    menuTree.value = res.tree
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '加载菜单失败'
    message.error(msg)
  } finally {
    tableLoading.value = false
  }
}

onMounted(loadMenus)

// ---- 扁平化卡片数据 ----
const cardItems = computed(() => {
  function flatten(nodes: MenuItem[], depth: number): (MenuItem & { depth: number })[] {
    const result: (MenuItem & { depth: number })[] = []
    for (const n of nodes) {
      result.push({ ...n, depth })
      if (n.children?.length) {
        result.push(...flatten(n.children, depth + 1))
      }
    }
    return result
  }
  return flatten(menuTree.value, 0)
})

function parentName(node: MenuItem): string {
  if (!node.parentId) return '根菜单'
  function find(nodes: MenuItem[]): MenuItem | null {
    for (const n of nodes) {
      if (n.id === node.parentId) return n
      if (n.children?.length) {
        const found = find(n.children)
        if (found) return found
      }
    }
    return null
  }
  const p = find(menuTree.value)
  return p?.name ?? '—'
}

function collectDescendantIds(node: MenuItem): number[] {
  const ids: number[] = [node.id]
  node.children?.forEach((child) => {
    ids.push(...collectDescendantIds(child))
  })
  return ids
}

const menuCascaderOptions = computed(() => {
  const excluded = new Set<number>()
  if (isEdit.value && editingId.value !== null) {
    function findAndExclude(nodes: MenuItem[]): boolean {
      for (const n of nodes) {
        if (n.id === editingId.value) {
          collectDescendantIds(n).forEach((id) => excluded.add(id))
          return true
        }
        if (n.children && findAndExclude(n.children)) return true
      }
      return false
    }
    findAndExclude(menuTree.value)
  }

  function walk(nodes: MenuItem[]): CascaderOption[] {
    return nodes
      .filter((n) => !excluded.has(n.id))
      .map((n) => {
        const childOpts = n.children?.length ? walk(n.children) : undefined
        return {
          label: n.name,
          value: n.id,
          ...(childOpts && childOpts.length > 0 ? { children: childOpts } : {}),
        }
      })
  }
  return [{ label: '根菜单', value: ROOT_PARENT }, ...walk(menuTree.value)]
})

const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

interface MenuForm {
  parentId: number
  name: string
  path: string
  icon: string
  permissionCode: string | null
  sortOrder: number
  status: 'active' | 'disabled'
}

const form = reactive<MenuForm>({
  parentId: ROOT_PARENT,
  name: '',
  path: '',
  icon: '',
  permissionCode: null,
  sortOrder: 0,
  status: 'active',
})

const formRules = computed<FormRules>(() => ({
  name: { required: true, message: '请输入菜单名称', trigger: 'blur' },
}))

function resetForm() {
  Object.assign(form, {
    parentId: ROOT_PARENT,
    name: '',
    path: '',
    icon: '',
    permissionCode: null,
    sortOrder: 0,
    status: 'active' as const,
  })
}

async function openCreate() {
  isEdit.value = false
  editingId.value = null
  resetForm()
  await reloadPermissions()
  drawerVisible.value = true
}

async function openCreateChild(parent: MenuItem) {
  isEdit.value = false
  editingId.value = null
  resetForm()
  form.parentId = parent.id
  await reloadPermissions()
  drawerVisible.value = true
}

async function openEdit(row: MenuItem) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    parentId: row.parentId ?? ROOT_PARENT,
    name: row.name,
    path: row.path ?? '',
    icon: row.icon ?? '',
    permissionCode: row.permissionCode ?? null,
    sortOrder: row.sortOrder,
    status: row.status,
  })
  await reloadPermissions()
  drawerVisible.value = true
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  const parentId = form.parentId === ROOT_PARENT ? null : form.parentId
  submitting.value = true
  try {
    if (isEdit.value && editingId.value !== null) {
      await apiUpdateMenu(editingId.value, {
        parentId,
        name: form.name,
        path: form.path || null,
        icon: form.icon || null,
        permissionCode: form.permissionCode || null,
        sortOrder: form.sortOrder,
        status: form.status,
      })
      message.success('菜单已更新')
    } else {
      await apiCreateMenu({
        parentId,
        name: form.name,
        path: form.path || null,
        icon: form.icon || null,
        permissionCode: form.permissionCode || null,
        sortOrder: form.sortOrder,
        status: form.status,
      })
      message.success('菜单已创建')
    }
    drawerVisible.value = false
    await loadMenus()
  } catch (e: unknown) {
    const msg = extractApiError(e, '保存失败')
    message.error(msg)
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: MenuItem) {
  try {
    await apiDeleteMenu(row.id, false)
    message.success('已删除')
    await loadMenus()
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      const childCount = row.children?.length ?? 0
      dialog.warning({
        title: '确认级联删除',
        content: childCount
          ? `该菜单有 ${childCount} 个子菜单,确认一并删除吗?此操作不可恢复。`
          : '该菜单有子菜单或被引用,确认级联删除吗?此操作不可恢复。',
        positiveText: '级联删除',
        negativeText: '取消',
        onPositiveClick: async () => {
          try {
            await apiDeleteMenu(row.id, true)
            message.success('已级联删除')
            await loadMenus()
          } catch (e2: unknown) {
            const msg = extractApiError(e2, '级联删除失败')
            message.error(msg)
          }
        },
      })
      return
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

const columns: DataTableColumns<MenuItem> = [
  { title: '名称', key: 'name', width: 240 },
  {
    title: '路径',
    key: 'path',
    width: 200,
    render(row: MenuItem) {
      return row.path || h('span', { class: 'text-base-content/30' }, '—')
    },
  },
  {
    title: '图标',
    key: 'icon',
    width: 140,
    render(row: MenuItem) {
      return row.icon || h('span', { class: 'text-base-content/30' }, '—')
    },
  },
  {
    title: '权限码',
    key: 'permissionCode',
    width: 160,
    render(row: MenuItem) {
      return row.permissionCode || h('span', { class: 'text-base-content/30' }, '—')
    },
  },
  { title: '排序', key: 'sortOrder', width: 80 },
  {
    title: '状态',
    key: 'status',
    width: 90,
    render(row: MenuItem) {
      return h(
        NTag,
        { type: row.status === 'active' ? 'success' : 'default', size: 'small' },
        { default: () => (row.status === 'active' ? '正常' : '禁用') },
      )
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 150,
    fixed: 'right',
    render(row: MenuItem) {
      const canManage = permissionStore.hasPermission('menu:manage')
      if (!canManage) return h('span', { class: 'text-base-content/30' }, '—')
      const buttons: VNode[] = []
      buttons.push(
        h(NButton, { size: 'tiny', quaternary: true, title: '编辑', onClick: () => openEdit(row) }, {
          icon: () => h(CreateOutline, { style: 'width:14px;height:14px' }),
        }),
      )
      buttons.push(
        h(NButton, { size: 'tiny', quaternary: true, title: '添加子菜单', onClick: () => openCreateChild(row) }, {
          icon: () => h(AddOutline, { style: 'width:14px;height:14px' }),
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
            default: () =>
              row.children?.length
                ? `该菜单有 ${row.children.length} 个子菜单,确认删除吗?`
                : '确认删除该菜单?',
          },
        ),
      )
      return h('div', { class: 'action-cell' }, [h(NSpace, { size: 2 }, { default: () => buttons })])
    },
  },
]
</script>

<template>
  <div>
    <PageHeader title="菜单管理" subtitle="管理后台导航菜单(树形结构)">
      <NButton v-permission="'menu:manage'" type="primary" @click="openCreate">
        新建根菜单
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
      <NSpin :show="tableLoading">
        <div v-if="cardItems.length === 0 && !tableLoading" class="py-16">
          <NEmpty description="暂无菜单" />
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div
            v-for="(item, idx) in cardItems"
            :key="item.id"
            :class="[
              'rounded-xl border p-4 transition-all duration-300',
              'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
              getColor(idx).border,
              getColor(idx).bg,
            ]"
          >
            <!-- 层级指示 -->
            <div class="flex items-center gap-1 mb-1">
              <span
                v-for="d in item.depth"
                :key="d"
                class="inline-block w-2 h-2 rounded-full"
                :class="getColor(idx + d * 3).dot || 'bg-base-content/10'"
                style="opacity: 0.3"
              />
              <NTag size="tiny" :bordered="false" class="text-[10px]">
                {{ item.depth === 0 ? '根' : `L${item.depth}` }}
              </NTag>
            </div>

            <!-- 名称 + 状态 -->
            <div class="flex items-start justify-between mb-1">
              <div class="font-medium text-sm" :class="getColor(idx).text">{{ item.name }}</div>
              <NTag
                :type="item.status === 'active' ? 'success' : 'default'"
                size="tiny"
                :bordered="false"
              >
                {{ item.status === 'active' ? '正常' : '禁用' }}
              </NTag>
            </div>

            <!-- 父菜单 -->
            <div class="text-xs text-base-content/30 mb-1">父级：{{ parentName(item) }}</div>

            <!-- 路径 -->
            <div class="text-xs text-base-content/40 truncate mb-1">
              路径：{{ item.path || '—' }}
            </div>

            <!-- 图标 + 权限码 -->
            <div class="text-xs text-base-content/30">
              <div>图标：{{ item.icon || '—' }}</div>
              <div>权限码：{{ item.permissionCode || '—' }}</div>
              <div>排序：{{ item.sortOrder }}</div>
            </div>

            <!-- 子菜单数 -->
            <div v-if="item.children?.length" class="mt-1 text-xs text-base-content/30">
              子菜单：{{ item.children.length }} 项
            </div>

            <!-- 操作 -->
            <div v-if="permissionStore.hasPermission('menu:manage')" class="flex items-center gap-1 mt-3 pt-3 border-t border-base-content/5">
              <NButton size="tiny" quaternary @click="openEdit(item)">
                <CreateOutline class="w-3.5 h-3.5" />
                编辑
              </NButton>
              <NButton size="tiny" quaternary @click="openCreateChild(item)">
                <AddOutline class="w-3.5 h-3.5" />
                子菜单
              </NButton>
              <NPopconfirm @positive-click="handleDelete(item)">
                <template #trigger>
                  <NButton size="tiny" quaternary type="error">
                    <TrashOutline class="w-3.5 h-3.5" />
                    删除
                  </NButton>
                </template>
                {{ item.children?.length ? `该菜单有 ${item.children.length} 个子菜单,确认删除吗?` : '确认删除该菜单?' }}
              </NPopconfirm>
            </div>
          </div>
        </div>
      </NSpin>
    </template>

    <!-- 列表视图 -->
    <template v-else>
      <NSpin :show="tableLoading">
        <div class="bg-base-100 rounded-xl overflow-hidden border border-base-content/5">
          <NDataTable
            :columns="columns"
            :data="menuTree"
            :row-key="(row: MenuItem) => row.id"
            :default-expand-all="true"
            striped
            size="small"
            :scroll-x="1200"
          />
        </div>
      </NSpin>
    </template>

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑菜单' : '新建菜单'"
      :loading="submitting"
      :width="520"
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
        <NFormItem label="父菜单" path="parentId">
          <NCascader
            v-model:value="form.parentId"
            :options="menuCascaderOptions"
            :check-strategy="'child'"
            :show-path="true"
            placeholder="选择父菜单"
            clearable
            expand-trigger="hover"
          />
        </NFormItem>
        <NFormItem label="名称" path="name">
          <NInput v-model:value="form.name" placeholder="如 用户管理" />
        </NFormItem>
        <NFormItem label="路径" path="path">
          <NInput v-model:value="form.path" placeholder="如 /cms/rbac/users(可选)" />
        </NFormItem>
        <NFormItem label="图标" path="icon">
          <NInput v-model:value="form.icon" placeholder="如 PersonOutline(@vicons/ionicons5)" />
        </NFormItem>
        <NFormItem label="权限码" path="permissionCode">
          <NSelect
            v-model:value="form.permissionCode"
            :options="permissionOptions"
            placeholder="关联权限(可选)"
            clearable
            filterable
          />
        </NFormItem>
        <NFormItem label="排序" path="sortOrder">
          <NInputNumber v-model:value="form.sortOrder" :min="0" :step="10" />
        </NFormItem>
        <NFormItem label="状态" path="status">
          <NRadioGroup v-model:value="form.status">
            <NRadioButton value="active">正常</NRadioButton>
            <NRadioButton value="disabled">禁用</NRadioButton>
          </NRadioGroup>
        </NFormItem>
      </NForm>
    </FormDrawer>
  </div>
</template>
