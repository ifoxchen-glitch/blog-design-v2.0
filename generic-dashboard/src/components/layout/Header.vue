<template>
  <header class="flex items-center justify-between px-4 py-3 border-b border-base-300/30 bg-base-200/50">
    <div class="flex items-center gap-3">
      <slot name="left" />
    </div>
    <div class="flex items-center gap-2">
      <slot name="right" />
    </div>
  </header>
</template>

<script setup lang="ts">
defineSlots<{
  left?: any
  right?: any
}>()
</script>