<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" :for="inputId" class="text-sm text-base-content/70">{{ label }}</label>
    <input
      :id="inputId"
      v-model="modelValue_"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :class="[
        'input input-bordered w-full',
        error && 'input-error',
        sizeClass,
        $attrs.class,
      ]"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span v-if="error" class="text-xs text-error">{{ error }}</span>
    <span v-else-if="hint" class="text-xs text-base-content/50">{{ hint }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed, useId } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string | number
  type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url' | 'search'
  label?: string
  placeholder?: string
  error?: string
  hint?: string
  disabled?: boolean
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), {
  type: 'text',
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = useId()
const modelValue_ = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const sizeClass = computed(() => {
  const map: Record<string, string> = { sm: 'input-sm', md: '', lg: 'input-lg' }
  return map[props.size]
})
</script>