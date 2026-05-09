<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" class="text-sm text-base-content/70">{{ label }}</label>
    <input
      v-model="modelValue_"
      type="date"
      :placeholder="placeholder"
      :disabled="disabled"
      class="input input-bordered w-full"
      :class="sizeClass"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const modelValue_ = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const sizeClass = computed(() => ({ sm: 'input-sm', md: '', lg: 'input-lg' })[props.size])
</script>