<template>
  <div :class="['skeleton', variantClass, sizeClass, animate && 'animate-pulse']" :style="style" />
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  width?: string | number
  height?: string | number
  variant?: 'text' | 'circular' | 'rectangular'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  animate?: boolean
}>(), {
  variant: 'text',
  size: 'md',
  animate: true,
})

const variantClass = computed(() => {
  const map: Record<string, string> = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  }
  return map[props.variant]
})

const sizeClass = computed(() => {
  const map: Record<string, string> = {
    xs: 'h-3',
    sm: 'h-4',
    md: 'h-5',
    lg: 'h-6',
    xl: 'h-8',
  }
  return map[props.size]
})

const style = computed(() => {
  const s: Record<string, string> = {}
  if (props.width) {
    s.width = typeof props.width === 'number' ? `${props.width}px` : props.width
  }
  if (props.height) {
    s.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }
  return s
})
</script>
