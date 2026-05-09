<template>
  <input
    type="range"
    :min="min"
    :max="max"
    :value="modelValue"
    :step="step"
    :disabled="disabled"
    :class="['range', variantClass, sizeClass]"
    @input="$emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  min?: number
  max?: number
  step?: number
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
}>(), {
  min: 0,
  max: 100,
  step: 1,
  variant: 'primary',
  size: 'md',
})

defineEmits<{
  'update:modelValue': [value: number]
}>()

const variantClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'range-primary',
    secondary: 'range-secondary',
    accent: 'range-accent',
    success: 'range-success',
    warning: 'range-warning',
    error: 'range-error',
    info: 'range-info',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'range-xs',
    sm: 'range-sm',
    md: '',
    lg: 'range-lg',
  }
  return map[props.size]
})
</script>
