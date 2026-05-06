<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <div class="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
      <template v-for="(item, i) in items" :key="i">
        <!-- Label -->
        <div class="text-base-content/40 py-0.5">{{ item.label }}</div>
        <!-- Value -->
        <div
          class="flex items-center gap-1 py-0.5"
          :class="item.highlight ? 'font-semibold' : 'tabular-nums'"
        >
          {{ item.value }}
          <span v-if="item.unit" class="text-base-content/30">{{ item.unit }}</span>
          <span
            v-if="item.change !== undefined"
            class="text-[10px]"
            :class="item.change >= 0 ? 'text-success' : 'text-error'"
          >
            {{ item.change >= 0 ? '+' : '' }}{{ item.change }}%
          </span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface MetricItem {
  label: string
  value: string | number
  unit?: string
  change?: number
  highlight?: boolean
}

defineProps<{
  title?: string
  items: MetricItem[]
}>()
</script>
