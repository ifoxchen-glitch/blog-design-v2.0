<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" class="text-sm text-base-content/70">{{ label }}</label>
    <div class="flex items-center gap-2">
      <input
        v-model="start_"
        type="date"
        :disabled="disabled"
        class="input input-bordered input-sm flex-1"
        @input="emit('update:start', ($event.target as HTMLInputElement).value)"
      />
      <span class="text-base-content/50">—</span>
      <input
        v-model="end_"
        type="date"
        :disabled="disabled"
        class="input input-bordered input-sm flex-1"
        @input="emit('update:end', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  start?: string
  end?: string
  label?: string
  disabled?: boolean
}>(), {})

const emit = defineEmits<{
  'update:start': [value: string]
  'update:end': [value: string]
}>()

const start_ = computed({ get: () => props.start, set: (v) => emit('update:start', v) })
const end_ = computed({ get: () => props.end, set: (v) => emit('update:end', v) })
</script>