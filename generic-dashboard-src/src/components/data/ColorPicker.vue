<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" class="text-sm text-base-content/70">{{ label }}</label>
    <div class="flex items-center gap-2">
      <input
        v-model="modelValue_"
        type="color"
        class="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <input
        v-model="modelValue_"
        type="text"
        :placeholder="placeholder"
        class="input input-bordered input-sm flex-1 font-mono uppercase"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: string
  label?: string
  placeholder?: string
}>(), {
  modelValue: '#64d2ff',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const modelValue_ = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})
</script>