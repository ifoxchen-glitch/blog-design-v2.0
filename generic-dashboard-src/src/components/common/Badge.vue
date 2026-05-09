<template>
  <div :class="['badge', variantClass, sizeClass, outline && 'badge-outline', gap && 'gap-' + gap]">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  outline?: boolean
  gap?: 0 | 1 | 2
}>(), {
  variant: 'neutral',
  size: 'md',
})

const variantClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    ghost: 'badge-ghost',
    neutral: 'badge-neutral',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'badge-xs',
    sm: 'badge-sm',
    md: '',
    lg: 'badge-lg',
  }
  return map[props.size]
})
</script>
