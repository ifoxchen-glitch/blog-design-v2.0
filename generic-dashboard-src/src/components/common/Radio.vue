<template>
  <div class="form-control">
    <label
      v-for="option in options"
      :key="option.value"
      :class="['label cursor-pointer gap-2', disabled && 'cursor-not-allowed opacity-50']"
    >
      <input
        type="radio"
        :name="name"
        :value="option.value"
        :checked="modelValue === option.value"
        :disabled="disabled"
        :class="['radio', variantClass, sizeClass]"
        @change="$emit('update:modelValue', option.value)"
      />
      <span class="label-text">{{ option.label }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Option {
  label: string
  value: string | number
}

const props = withDefaults(defineProps<{
  modelValue: string | number
  options: Option[]
  name: string
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  disabled?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
})

defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const variantClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'radio-primary',
    secondary: 'radio-secondary',
    accent: 'radio-accent',
    success: 'radio-success',
    warning: 'radio-warning',
    error: 'radio-error',
    info: 'radio-info',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'radio-xs',
    sm: 'radio-sm',
    md: '',
    lg: 'radio-lg',
  }
  return map[props.size]
})
</script>
