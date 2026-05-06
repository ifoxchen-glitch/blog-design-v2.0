<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" :for="inputId" class="text-sm text-base-content/70">{{ label }}</label>
    <div class="join w-full">
      <input
        :id="inputId"
        v-model="modelValue_"
        type="number"
        :placeholder="placeholder"
        :disabled="disabled"
        :min="min"
        :max="max"
        :step="step"
        class="join-item input input-bordered flex-1"
        :class="[error && 'input-error', sizeClass]"
        @input="handleInput"
      />
      <span v-if="suffix" class="join-item btn btn-ghost">{{ suffix }}</span>
    </div>
    <span v-if="error" class="text-xs text-error">{{ error }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: number
  label?: string
  placeholder?: string
  error?: string
  disabled?: boolean
  min?: number
  max?: number
  step?: number
  suffix?: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  step: 1,
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const inputId = useId()
const modelValue_ = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v as number),
})

const sizeClass = computed(() => {
  const map: Record<string, string> = { sm: 'input-sm', md: '', lg: 'input-lg' }
  return map[props.size]
})

const handleInput = (e: Event) => {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (!isNaN(v)) {
    let clamped = v
    if (props.min !== undefined && v < props.min) clamped = props.min
    if (props.max !== undefined && v > props.max) clamped = props.max
    emit('update:modelValue', clamped)
  }
}
</script>