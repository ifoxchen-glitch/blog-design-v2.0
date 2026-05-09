<template>
  <div class="watermark fixed inset-0 pointer-events-none z-[9999]">
    <div
      v-for="index in count"
      :key="index"
      class="absolute select-none"
      :style="getWatermarkStyle(index)"
    >
      {{ content }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  content: string
  fontSize?: number
  color?: string
  rotate?: number
  gap?: number
  opacity?: number
}>(), {
  fontSize: 16,
  color: '#000000',
  rotate: -22,
  gap: 100,
  opacity: 0.15,
})

const count = computed(() => {
  const width = window.innerWidth
  const height = window.innerHeight
  const cols = Math.ceil(width / props.gap)
  const rows = Math.ceil(height / props.gap)
  return cols * rows
})

const getWatermarkStyle = (index: number) => {
  const cols = Math.ceil(window.innerWidth / props.gap)
  const row = Math.floor(index / cols)
  const col = index % cols
  
  return {
    fontSize: `${props.fontSize}px`,
    color: props.color,
    opacity: props.opacity,
    transform: `rotate(${props.rotate}deg)`,
    left: `${col * props.gap + props.gap / 2}px`,
    top: `${row * props.gap + props.gap / 2}px`,
    whiteSpace: 'nowrap',
  }
}
</script>
