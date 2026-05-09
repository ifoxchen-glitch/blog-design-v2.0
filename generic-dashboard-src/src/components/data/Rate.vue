<template>
  <div class="flex items-center gap-1">
    <button
      v-for="i in count"
      :key="i"
      :class="['btn btn-ghost btn-sm btn-square', i <= modelValue && 'text-warning']"
      :disabled="disabled"
      @click="$emit('update:modelValue', i)"
      @mouseenter="hovered = i"
      @mouseleave="hovered = 0"
    >
      <svg
        class="w-5 h-5"
        :fill="i <= (hovered || modelValue) ? 'currentColor' : 'none'"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
        />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  count?: number
  disabled?: boolean
}>(), {
  count: 5,
})

defineEmits<{
  'update:modelValue': [value: number]
}>()

const hovered = ref(0)
</script>
