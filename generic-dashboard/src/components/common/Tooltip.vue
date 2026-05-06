<template>
  <div class="tooltip" :class="positionClass">
    <div ref="triggerRef" class="inline-block">
      <slot />
    </div>
    <div
      v-if="visible"
      class="tooltip-content"
      :class="[themeClass, !visible && 'hidden']"
    >
      <slot name="content">{{ content }}</slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  content?: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  theme?: 'neutral' | 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error'
  alwaysShow?: boolean
}>(), {
  position: 'top',
  theme: 'neutral',
})

const visible = ref(props.alwaysShow || false)
const triggerRef = ref<HTMLElement>()

const positionClass = computed(() => `tooltip-${props.position}`)

const themeClass = computed(() => {
  const map: Record<string, string> = {
    neutral: 'tooltip-neutral',
    primary: 'tooltip-primary',
    secondary: 'tooltip-secondary',
    accent: 'tooltip-accent',
    info: 'tooltip-info',
    success: 'tooltip-success',
    warning: 'tooltip-warning',
    error: 'tooltip-error',
  }
  return map[props.theme]
})

const show = () => { if (!props.alwaysShow) visible.value = true }
const hide = () => { if (!props.alwaysShow) visible.value = false }

defineExpose({ show, hide })
</script>