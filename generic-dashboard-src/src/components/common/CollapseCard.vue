<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div
      v-if="title"
      class="mb-3 flex cursor-pointer items-center justify-between"
      @click="toggle"
    >
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <svg
        class="h-4 w-4 text-base-content/40 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    </div>
    <div
      v-show="isOpen"
      class="overflow-hidden transition-all duration-200"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  defaultOpen?: boolean
}>(), {
  defaultOpen: true,
})

const isOpen = ref(props.defaultOpen)
const toggle = () => { isOpen.value = !isOpen.value }
</script>
