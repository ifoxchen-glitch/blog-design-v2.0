<script setup lang="ts">
import { computed, h, reactive, ref, type VNode } from 'vue'
import {
  NButton,
  NInput,
  NSelect,
  NSpace,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { GridOutline, ListOutline } from '@vicons/ionicons5'
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

// ---- DataTable query (resource 筛选) ----
interface PermissionQuery {
  resource: string
}
const initialQuery: PermissionQuery = { resource: '' }

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

// ---- 卡片数据 ----
const cardData = ref<PermissionItem[]>([])
const cardLoading = ref(false)

async function loadCardData() {
  cardLoading.value = true
  try {
    const res = await apiGetPermissions({})
    cardData.value = res.items
  } catch (e: unknown) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    cardLoading.value = false
  }
}
loadCardData()

const cardResourceFilter = ref('')

const filteredCardData = computed(() => {
  if (!cardResourceFilter.value) return cardData.value
  return cardData.value.filter((p) => p.resource === cardResourceFilter.value)
})

// ---- 资源选项 ----
interface ResourceOption {
  label: string
  value: string
}
const resourceOptions = ref<ResourceOption[]>([])
async function loadResourceOptions() {
  const res = await apiGetPermissions({})
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
    loadCardData()
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
      return row.description || h('span', { class: 'text-base-content/30' }, '—')
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 140,
    fixed: 'right',
    render(row: PermissionItem) {
      const canEdit = permissionStore.hasPermission('role:assign')
      if (!canEdit) return h('span', { class: 'text-base-content/30' }, '—')
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
        <div class="relative flex-1 min-w-[180px] max-w-[260px]">
          <NSelect
            v-model:value="cardResourceFilter"
            :options="resourceOptions"
            placeholder="按资源筛选"
            clearable
          />
        </div>
        <span class="text-sm text-base-content/30">共 {{ filteredCardData.length }} 条</span>
      </div>

      <div v-if="filteredCardData.length === 0" class="py-16">
        <NEmpty description="暂无权限" />
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
          <div class="font-medium text-sm font-mono" :class="getColor(idx).text">{{ row.code }}</div>

          <div class="flex items-center gap-2 mt-2">
            <span class="text-[11px] px-1.5 py-0.5 rounded bg-base-content/5 text-base-content/40">{{ row.resource }}</span>
            <span class="text-[11px] px-1.5 py-0.5 rounded bg-base-content/5 text-base-content/40">{{ row.action }}</span>
          </div>

          <div class="mt-2 text-sm text-base-content">{{ row.name }}</div>
          <div class="text-xs text-base-content/40 mt-0.5 line-clamp-2">
            {{ row.description || '—' }}
          </div>

          <div v-if="permissionStore.hasPermission('role:assign')" class="flex items-center gap-1 mt-3 pt-3 border-t border-base-content/5">
            <NButton
              size="tiny"
              quaternary
              :disabled="editingRow !== null"
              @click="startEdit(row)"
            >
              编辑
            </NButton>
          </div>
        </div>
      </div>
    </template>

    <!-- 列表视图 -->
    <template v-else>
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
    </template>
  </div>
</template>
