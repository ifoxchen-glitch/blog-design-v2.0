<script setup lang="ts">
// 菜单管理页 — T2.25
// 设计文档:docs/09-phase2-rbac-frontend-plan.md §5
//
// 偏离设计文档之处:
// (M) 不用通用 DataTable 组件,直接用 NDataTable 树形模式(tree-mode 通过 children-key + row-key)
// (N) FIXME(cascader-null): n-cascader 的 value 不接受 null,用 0 作为"根菜单"的 sentinel,
//     提交前把 0 转回 null。后端的 parent_id 0 会被当成有效 id 找不到记录,所以一定要在前端转。
// (O) 编辑时把当前菜单及其后代从 cascader 选项里裁掉,防止形成环(后端也校验,前端做体验更好)
// (P) 删除:先试 cascade=false,捕到 409 弹 dialog 二次确认 cascade=true 再调一次
// (Q) 拖拽排序留 TODO,MVP 用 NInputNumber 调 sort_order
//
// TODO(menu-drag): 树形拖拽排序,需引入 vuedraggable / sortablejs,
// 拖拽后批量调 apiReorderMenus({ items: [{ id, parentId, sortOrder }, ...] })

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
  useMessage,
  useDialog,
  type CascaderOption,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
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

// "根菜单" sentinel(0 不是合法 menu id)
const ROOT_PARENT = 0

// ---- 数据 ----
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

// ---- 收集所有菜单(用于环检测) ----
function collectDescendantIds(node: MenuItem): number[] {
  const ids: number[] = [node.id]
  node.children?.forEach((child) => {
    ids.push(...collectDescendantIds(child))
  })
  return ids
}

// ---- 父菜单 cascader 选项 ----
const menuCascaderOptions = computed(() => {
  const excluded = new Set<number>()
  if (isEdit.value && editingId.value !== null) {
    // 编辑模式:把自己 + 后代节点排除
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

// ---- 新建 / 编辑抽屉 ----
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
  // sentinel → null
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

// ---- 删除(带级联兜底) ----
async function handleDelete(row: MenuItem) {
  try {
    await apiDeleteMenu(row.id, false)
    message.success('已删除')
    await loadMenus()
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 409) {
      // 后端提示有子菜单 / 被引用,弹二次确认
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

// ---- 列定义 ----
const columns: DataTableColumns<MenuItem> = [
  { title: '名称', key: 'name', width: 240 },
  {
    title: '路径',
    key: 'path',
    width: 200,
    render(row: MenuItem) {
      return row.path || h('span', { style: 'color: #999' }, '—')
    },
  },
  {
    title: '图标',
    key: 'icon',
    width: 140,
    render(row: MenuItem) {
      return row.icon || h('span', { style: 'color: #999' }, '—')
    },
  },
  {
    title: '权限码',
    key: 'permissionCode',
    width: 160,
    render(row: MenuItem) {
      return row.permissionCode || h('span', { style: 'color: #999' }, '—')
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
        {
          type: row.status === 'active' ? 'success' : 'default',
          size: 'small',
        },
        { default: () => (row.status === 'active' ? '正常' : '禁用') },
      )
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 240,
    fixed: 'right',
    render(row: MenuItem) {
      const canManage = permissionStore.hasPermission('menu:manage')
      if (!canManage) return h('span', { style: 'color: #999' }, '—')
      const buttons: VNode[] = []
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
          { size: 'small', onClick: () => openCreateChild(row) },
          { default: () => '添加子菜单' },
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
            default: () =>
              row.children?.length
                ? `该菜单有 ${row.children.length} 个子菜单,确认删除吗?`
                : '确认删除该菜单?',
          },
        ),
      )
      return h(NSpace, { size: 4 }, { default: () => buttons })
    },
  },
]
</script>

<template>
  <div>
    <PageHeader title="菜单管理" subtitle="管理后台导航菜单(树形结构)">
      <NButton
        v-permission="'menu:manage'"
        type="primary"
        @click="openCreate"
      >
        新建根菜单
      </NButton>
    </PageHeader>

    <NSpin :show="tableLoading">
      <NDataTable
        :columns="columns"
        :data="menuTree"
        :row-key="(row: MenuItem) => row.id"
        :default-expand-all="true"
        striped
        size="small"
        :scroll-x="1200"
      />
    </NSpin>

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
          <NInput
            v-model:value="form.icon"
            placeholder="如 PersonOutline(@vicons/ionicons5)"
          />
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
