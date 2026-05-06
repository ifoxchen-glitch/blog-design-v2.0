<template>
  <div class="flex flex-col items-center justify-center py-8 text-center">
    <svg class="w-16 h-16 text-base-content/30 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
      <path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
    </svg>
    <p class="text-base-content/50 mb-2">{{ text || '暂无数据' }}</p>
    <button v-if="$slots.action" class="btn btn-sm btn-ghost mt-2">
      <slot name="action" />
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>