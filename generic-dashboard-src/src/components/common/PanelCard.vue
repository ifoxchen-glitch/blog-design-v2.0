<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title || $slots.header" class="mb-3 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <h3 v-if="title" class="text-sm font-semibold">{{ title }}</h3>
        <slot name="header" />
      </div>
      <slot name="actions" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
}>()
</script>
