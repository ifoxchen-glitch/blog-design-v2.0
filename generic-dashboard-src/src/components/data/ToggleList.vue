<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <div
      v-for="(item, i) in items"
      :key="i"
      class="flex cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-base-content/[0.03]"
      @click="$emit('toggle', item, i)"
    >
      <!-- Toggle -->
      <input
        type="checkbox"
        :checked="item.enabled ?? true"
        class="toggle toggle-xs toggle-primary"
        @click.stop="$emit('toggle', item, i)"
      />

      <div class="flex-1 min-w-0">
        <div class="truncate text-sm">{{ item.label || item.name }}</div>
        <div v-if="item.desc" class="truncate text-xs text-base-content/40">{{ item.desc }}</div>
      </div>

      <slot name="right" :item="item" :index="i" />
    </div>
  </div>
</template>

<script setup lang="ts">
export interface ToggleItem {
  label?: string
  name?: string
  desc?: string
  enabled?: boolean
  [key: string]: any
}

defineProps<{
  title?: string
  items: ToggleItem[]
}>()

defineEmits<{
  toggle: [item: ToggleItem, index: number]
}>()
</script>
