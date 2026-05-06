<template>
  <footer class="flex items-center justify-between px-4 py-3 border-t border-base-300/30 bg-base-200/50 text-sm text-base-content/50">
    <slot name="left">
      <span>{{ leftText }}</span>
    </slot>
    <slot name="right">
      <span>{{ rightText }}</span>
    </slot>
  </footer>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  leftText?: string
  rightText?: string
}>(), {
  leftText: '© 2026',
})
</script>