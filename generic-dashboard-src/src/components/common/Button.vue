<template>
  <div class="relative inline-block">
    <button
      :class="[
        'btn',
        variantClass,
        sizeClass,
        block && 'btn-block',
        loading && 'loading',
        iconOnly && 'btn-square',
        noGap && 'gap-0',
      ]"
      :disabled="disabled || loading"
      @click="$emit('click', $event)"
    >
      <slot name="icon-left" />
      <slot>{{ label }}</slot>
      <slot name="icon-right" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  variant?: 'primary' | 'secondary' | 'accent' | 'ghost' | 'outline' | 'error' | 'warning' | 'info' | 'success'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  block?: boolean
  loading?: boolean
  disabled?: boolean
  iconOnly?: boolean
  noGap?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
})

defineEmits<{
  click: [event: MouseEvent]
}>()

const variantClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    accent: 'btn-accent',
    ghost: 'btn-ghost',
    outline: 'btn-outline',
    error: 'btn-error',
    warning: 'btn-warning',
    info: 'btn-info',
    success: 'btn-success',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'btn-xs',
    sm: 'btn-sm',
    md: '',
    lg: 'btn-lg',
  }
  return map[props.size]
})
</script>
