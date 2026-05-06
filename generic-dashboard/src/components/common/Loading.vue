<template>
  <div class="flex items-center justify-center" :class="containerClass">
    <span
      class="loading loading-spinner"
      :class="[sizeClass, colorClass]"
    />
    <span v-if="text" class="ml-2 text-sm text-base-content/70">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  size?: 'xs' | 'sm' | 'md' | 'lg'
  color?: 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'
  text?: string
  block?: boolean
}>(), {
  size: 'md',
  color: 'primary',
})

const sizeClass = computed(() => `loading-${props.size}`)
const colorClass = computed(() => {
  const map: Record<string, string> = {
    neutral: 'text-neutral',
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
    info: 'text-info',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  }
  return map[props.color]
})
const containerClass = computed(() => props.block ? 'w-full h-full min-h-[100px]' : '')
</script>