<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <div class="space-y-2">
      <div v-for="(item, i) in items" :key="i" class="flex flex-col gap-1.5">
        <!-- Label row -->
        <div class="flex items-center justify-between text-xs">
          <span class="text-base-content/60">{{ item.label }}</span>
          <span class="font-medium tabular-nums">{{ item.value }}{{ item.unit }}</span>
        </div>
        <!-- Progress bar -->
        <div class="h-1.5 w-full overflow-hidden rounded-full bg-base-content/5">
          <div
            class="h-full rounded-full transition-all duration-500"
            :class="barColorClass(item)"
            :style="{ width: Math.min(100, item.percent) + '%' }"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ProgressBar {
  label: string
  value: number
  unit?: string
  percent: number
  color?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
}

defineProps<{
  title?: string
  items: ProgressBar[]
}>()

const barColorClass = (item: ProgressBar) => ({
  default: 'bg-base-content/30',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
}[item.color || 'default'])
</script>
