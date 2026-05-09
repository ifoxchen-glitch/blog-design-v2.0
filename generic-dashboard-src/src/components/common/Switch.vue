<template>
  <label :class="['swap', disabled && 'swap-disabled', sizeClass]">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      @change="$emit('update:modelValue', !modelValue)"
    />
    <div :class="['swap-on', variantClassOn]">
      <slot name="on">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </slot>
    </div>
    <div :class="['swap-off', variantClassOff]">
      <slot name="off">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </slot>
    </div>
  </label>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
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

const variantClassOn = computed(() => {
  const map: Record<string, string> = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    info: 'text-info',
  }
  return map[props.variant]
})

const variantClassOff = computed(() => {
  const map: Record<string, string> = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    info: 'text-info',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'swap-xs',
    sm: 'swap-sm',
    md: '',
    lg: 'swap-lg',
  }
  return map[props.size]
})
</script>
