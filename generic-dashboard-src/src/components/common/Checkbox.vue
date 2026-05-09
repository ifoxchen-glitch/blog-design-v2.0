<template>
  <label :class="['label cursor-pointer gap-2', disabled && 'cursor-not-allowed opacity-50']">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :class="['checkbox', variantClass, sizeClass]"
      @change="$emit('update:modelValue', !modelValue)"
    />
    <span class="label-text">{{ label }}</span>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  label?: string
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
})

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const variantClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'checkbox-primary',
    secondary: 'checkbox-secondary',
    accent: 'checkbox-accent',
    success: 'checkbox-success',
    warning: 'checkbox-warning',
    error: 'checkbox-error',
    info: 'checkbox-info',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'checkbox-xs',
    sm: 'checkbox-sm',
    md: '',
    lg: 'checkbox-lg',
  }
  return map[props.size]
})
</script>
