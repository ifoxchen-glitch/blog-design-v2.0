<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <!-- Table -->
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-base-content/5">
            <th
              v-for="(col, i) in columns"
              :key="i"
              class="whitespace-nowrap px-3 py-2 font-medium text-base-content/40"
              :class="col.class"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, ri) in data"
            :key="ri"
            class="cursor-pointer border-b border-base-content/[0.03] transition-colors hover:bg-base-content/[0.03]"
            @click="$emit('rowClick', row, ri)"
          >
            <td
              v-for="(col, ci) in columns"
              :key="ci"
              class="whitespace-nowrap px-3 py-2.5"
              :class="col.cellClass"
            >
              <slot
                v-if="$slots[`cell-${col.key}`]"
                :name="`cell-${col.key}`"
                :value="row[col.key]"
                :row="row"
                :index="ri"
              />
              <template v-else>{{ row[col.key] }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="showPagination" class="mt-3 flex items-center justify-between">
      <span class="text-xs text-base-content/30">共 {{ total }} 条</span>
      <div class="flex gap-1">
        <button
          class="btn btn-xs btn-ghost"
          :disabled="page <= 1"
          @click="$emit('update:page', page - 1)"
        >上一页</button>
        <button
          class="btn btn-xs btn-ghost"
          :disabled="page * pageSize >= total"
          @click="$emit('update:page', page + 1)"
        >下一页</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface Column {
  key: string
  label: string
  class?: string
  cellClass?: string
}

withDefaults(defineProps<{
  title?: string
  columns: Column[]
  data: any[]
  showPagination?: boolean
  total?: number
  page?: number
  pageSize?: number
}>(), {
  showPagination: false,
  total: 0,
  page: 1,
  pageSize: 20,
})

defineEmits<{
  'update:page': [value: number]
  rowClick: [row: any, index: number]
}>()
</script>
