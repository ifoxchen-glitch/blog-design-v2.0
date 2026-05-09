<template>
  <div class="avatar" :class="[sizeClass, online && 'online']">
    <div class="w-full rounded-full bg-base-200 flex items-center justify-center overflow-hidden">
      <img v-if="src" :src="src" :alt="alt" class="w-full h-full object-cover" />
      <span v-else-if="fallback" class="text-lg font-medium">{{ fallback }}</span>
      <svg v-else class="w-1/2 h-1/2 opacity-50" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  src?: string
  alt?: string
  fallback?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  online?: boolean
}>(), {
  size: 'md',
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }
  return map[props.size]
})
</script>