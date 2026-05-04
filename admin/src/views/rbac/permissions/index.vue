<script setup lang="ts">
// 权限管理页 — T2.24
// 设计文档:docs/09-phase2-rbac-frontend-plan.md §4
//
// 偏离设计文档之处:
// (B) 用 :fetch 而非 :api(对齐实际 DataTable 实现)
// (C) resource 筛选放进 query reactive,DataTable 内部 useTable 的 watch 自动 reset+refresh
//     不再需要外部 filterResource ref + 手动调 fetch
// (K) 后端不分页(返回所有 items),前端包一层把 { items, total } 转 { list, total }
// (L) 后端 listPermissions / updatePermission 都是 role:assign 权限码,故路由 meta 用 role:assign

import { computed, h, reactive, ref, type VNode } from 'vue'
import {
  NButton,
  NInput,
  NSelect,
  NSpace,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import DataTable from '../../../components/common/DataTable.vue'
import {
  apiGetPermissions,
  apiUpdatePermission,
  type PermissionItem,
} from '../../../api/rbac'
import { usePermissionStore } from '../../../stores/permission'

const message = useMessage()
const permissionStore = usePermissionStore()

// ---- DataTable query (resource 筛选) ----
interface PermissionQuery {
  resource: string
}
const initialQuery: PermissionQuery = { resource: '' }

// 后端不分页,前端包一层把 { items, total } 转 { list, total }
const fetchPermissions = async (
  params: PermissionQuery & { page: number; pageSize: number },
) => {
  const res = await apiGetPermissions({
    resource: params.resource || undefined,
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

// ---- 资源选项(从全量权限去重)----
const resourceOptions = ref<Array<{ label: string; value: string }>>([])
async function loadResourceOptions() {
  const res = await apiGetPermissions()
  const set = new Set<string>()
  res.items.forEach((p) => set.add(p.resource))
  resourceOptions.value = Array.from(set).map((r) => ({ label: r, value: r }))
}
loadResourceOptions()

// ---- 行内编辑 ----
const editingRow = ref<number | null>(null)
const saving = ref(false)
const editingForm = reactive({
  name: '',
  description: '',
})

function startEdit(row: PermissionItem) {
  editingRow.value = row.id
  editingForm.name = row.name
  editingForm.description = row.description ?? ''
}

function cancelEdit() {
  editingRow.value = null
  editingForm.name = ''
  editingForm.description = ''
}

async function saveEdit(row: PermissionItem) {
  if (!editingForm.name.trim()) {
    message.error('名称不能为空')
    return
  }
  saving.value = true
  try {
    await apiUpdatePermission(row.id, {
      name: editingForm.name.trim(),
      description: editingForm.description.trim() || undefined,
    })
    message.success('已保存')
    editingRow.value = null
    refreshTable()
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '保存失败'
    message.error(msg)
  } finally {
    saving.value = false
  }
}

// ---- 列定义 ----
const columns = computed<DataTableColumns<PermissionItem>>(() => [
  { title: 'ID', key: 'id', width: 70 },
  { title: '编码', key: 'code', width: 180 },
  { title: '资源', key: 'resource', width: 120 },
  { title: '动作', key: 'action', width: 120 },
  {
    title: '名称',
    key: 'name',
    width: 200,
    render(row: PermissionItem) {
      if (editingRow.value === row.id) {
        return h(NInput, {
          value: editingForm.name,
          'onUpdate:value': (v: string) => {
            editingForm.name = v
          },
          placeholder: '权限名称',
          size: 'small',
        })
      }
      return row.name
    },
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
    render(row: PermissionItem) {
      if (editingRow.value === row.id) {
        return h(NInput, {
          value: editingForm.description,
          'onUpdate:value': (v: string) => {
            editingForm.description = v
          },
          placeholder: '可选',
          size: 'small',
        })
      }
      return row.description || h('span', { style: 'color: #999' }, '—')
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row: PermissionItem) {
      const canEdit = permissionStore.hasPermission('role:assign')
      if (!canEdit) return h('span', { style: 'color: #999' }, '—')
      const buttons: VNode[] = []
      if (editingRow.value === row.id) {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              loading: saving.value,
              onClick: () => saveEdit(row),
            },
            { default: () => '保存' },
          ),
        )
        buttons.push(
          h(
            NButton,
            { size: 'small', disabled: saving.value, onClick: cancelEdit },
            { default: () => '取消' },
          ),
        )
      } else {
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              disabled: editingRow.value !== null,
              onClick: () => startEdit(row),
            },
            { default: () => '编辑' },
          ),
        )
      }
      return h(NSpace, { size: 4 }, { default: () => buttons })
    },
  },
])
</script>

<template>
  <div>
    <PageHeader title="权限管理" subtitle="查看并编辑权限的名称与描述(系统级,seed 维护)" />

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchPermissions"
      :initial-query="initialQuery"
      :row-key="(row: PermissionItem) => row.id"
    >
      <template #search="{ query }">
        <NSelect
          :value="(query as PermissionQuery).resource"
          :options="resourceOptions"
          placeholder="资源筛选"
          clearable
          style="width: 180px"
          @update:value="(v: string | null) => ((query as PermissionQuery).resource = v ?? '')"
        />
      </template>
    </DataTable>
  </div>
</template>
