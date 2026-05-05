<script setup lang="ts" generic="TQuery extends object = Record<string, unknown>">
import { ref, watch } from 'vue'
import {
  NDataTable,
  NPagination,
  NSpace,
  NInput,
  NButton,
  NIcon,
  NEmpty,
  type DataTableColumns,
  type DataTableRowKey,
} from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { useTable } from '../../composables/useTable'

interface Props {
  columns: DataTableColumns<any>
  fetch: (
    params: TQuery & { page: number; pageSize: number },
  ) => Promise<{ list: any[]; total: number }>
  initialQuery?: TQuery
  pageSize?: number
  rowKey?: (row: any) => DataTableRowKey
  selectable?: boolean
  searchPlaceholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  initialQuery: undefined,
  pageSize: 20,
  rowKey: undefined,
  selectable: false,
  searchPlaceholder: '搜索关键字',
})

const emit = defineEmits<{
  (e: 'update:selectedRowKeys', keys: DataTableRowKey[]): void
}>()

const table = useTable<any, TQuery>({
  fetch: props.fetch,
  initialQuery: props.initialQuery,
  pageSize: props.pageSize,
})

const selectedRowKeys = ref<DataTableRowKey[]>([])

function handleSelectionChange(keys: DataTableRowKey[]) {
  selectedRowKeys.value = keys
  emit('update:selectedRowKeys', keys)
}

function clearSelection() {
  selectedRowKeys.value = []
  emit('update:selectedRowKeys', [])
}

// 数据变化时清空选中状态，避免旧 key 在新数据中不存在导致 NDataTable 内部出错
watch(
  () => table.data.value,
  () => {
    selectedRowKeys.value = []
    emit('update:selectedRowKeys', [])
  },
)

defineExpose({
  refresh: table.refresh,
  reset: table.reset,
  clearSelection,
})

const queryAsRecord = table.query as Record<string, unknown>
</script>

<template>
  <div class="data-table-wrap">
    <div
      class="data-table-toolbar"
      style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      "
    >
      <div style="flex: 1; min-width: 240px; max-width: 480px">
        <slot name="search" :query="table.query" :refresh="table.refresh">
          <NInput
            v-model:value="(queryAsRecord.keyword as string)"
            :placeholder="props.searchPlaceholder"
            clearable
          />
        </slot>
      </div>
      <NSpace>
        <NButton
          quaternary
          circle
          :loading="table.loading.value"
          @click="table.refresh()"
        >
          <NIcon><RefreshOutline /></NIcon>
        </NButton>
        <slot
          name="toolbar"
          :selected-keys="selectedRowKeys"
          :clear-selection="clearSelection"
          :refresh="table.refresh"
        />
      </NSpace>
    </div>

    <NDataTable
      :columns="props.columns"
      :data="table.data.value"
      :loading="table.loading.value"
      :row-key="props.rowKey"
      :checked-row-keys="selectedRowKeys"
      :pagination="false"
      :bordered="false"
      :scroll-x="1800"
      remote
      @update:checked-row-keys="handleSelectionChange"
    >
      <template #empty>
        <slot name="empty">
          <NEmpty description="暂无数据" />
        </slot>
      </template>
    </NDataTable>

    <div
      class="data-table-pagination"
      style="
        margin-top: 16px;
        display: flex;
        justify-content: flex-end;
      "
    >
      <NPagination
        :page="table.page.value"
        :page-size="table.pageSize.value"
        :item-count="table.total.value"
        :page-sizes="[10, 20, 50, 100]"
        show-size-picker
        @update:page="table.handlePageChange"
        @update:page-size="table.handlePageSizeChange"
      />
    </div>
  </div>
</template>

<style scoped>
.data-table-wrap {
  width: 100%;
}
</style>
