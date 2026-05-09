<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <!-- Empty state -->
    <div v-if="!items.length" class="flex flex-col items-center justify-center py-8 text-base-content/30">
      <svg class="mb-2 h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25m-2.25 2.25l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
      <p class="text-xs">暂无数据</p>
    </div>

    <!-- List -->
    <div v-else class="divide-y divide-base-content/5">
      <div
        v-for="(item, i) in items"
        :key="i"
        class="flex cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-base-content/[0.03]"
        @click="$emit('select', item, i)"
      >
        <slot name="item" :item="item" :index="i">
          <div class="flex-1 min-w-0">
            <div class="truncate text-sm">{{ item[labelKey] ?? item }}</div>
            <div v-if="subKey && item[subKey]" class="truncate text-xs text-base-content/40">
              {{ item[subKey] }}
            </div>
          </div>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  items: any[]
  labelKey?: string
  subKey?: string
}>(), {
  labelKey: 'name',
})

defineEmits<{
  select: [item: any, index: number]
}>()
</script>
