<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="badgeClass"
  >
    <span
      class="inline-block h-1.5 w-1.5 rounded-full"
      :class="dotClass"
      :style="{ backgroundColor: dotColor }"
    />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral'
  label?: string
  dotColor?: string
}>(), {
  status: 'neutral',
})

const badgeClass = computed(() => ({
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
  info: 'bg-info/15 text-info',
  neutral: 'bg-base-content/10 text-base-content/70',
}[props.status]))

const dotClass = computed(() => ({
  success: '',
  warning: '',
  error: '',
  info: '',
  neutral: 'bg-base-content/50',
}[props.status]))
</script>
