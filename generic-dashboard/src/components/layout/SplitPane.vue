<template>
  <div class="flex h-full">
    <div
      ref="leftPanel"
      class="overflow-hidden transition-all duration-300"
      :style="{ width: collapsed ? '0px' : leftWidth + 'px' }"
    >
      <slot name="left" />
    </div>
    <div
      v-if="resizable"
      class="w-1 cursor-col-resize hover:bg-primary/50 transition-colors"
      @mousedown="startResize"
    />
    <div class="flex-1 overflow-auto">
      <slot />
    </div>
    <div
      v-if="$slots.right"
      ref="rightPanel"
      class="overflow-hidden transition-all duration-300"
      :style="{ width: collapsedRight ? '0px' : rightWidth + 'px' }"
    >
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

withDefaults(defineProps<{
  leftWidth?: number
  rightWidth?: number
  resizable?: boolean
  collapsed?: boolean
  collapsedRight?: boolean
}>(), {
  leftWidth: 300,
  rightWidth: 300,
  resizable: false,
  collapsed: false,
  collapsedRight: false,
})

defineSlots<{
  left?: any
  right?: any
}>()

const leftPanel = ref<HTMLElement>()
const rightPanel = ref<HTMLElement>()

const startResize = (e: MouseEvent) => {
  e.preventDefault()
  // Simple resize logic - can be expanded
}
</script>