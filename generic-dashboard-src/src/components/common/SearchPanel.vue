<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <div class="relative">
        <input
          :value="modelValue"
          type="text"
          :placeholder="placeholder"
          class="input input-sm bg-base-100 border-base-content/10 w-48 text-xs"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        />
        <svg class="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  modelValue?: string
  placeholder?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>
