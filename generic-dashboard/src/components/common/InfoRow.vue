<template>
  <div class="bg-base-200/30 flex items-center gap-3 rounded-xl p-4">
    <div
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
      :class="iconBgClass"
    >
      <slot name="icon">
        <svg class="h-5 w-5" :class="iconColorClass" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </slot>
    </div>
    <div class="flex-1 min-w-0">
      <div class="text-base-content/50 text-xs">{{ label }}</div>
      <div class="text-base font-medium truncate">
        <slot>{{ value }}</slot>
      </div>
    </div>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  label: string
  value?: string
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
}>(), {
  variant: 'default',
})

const iconBgClass = computed(() => ({
  default: 'bg-base-content/5',
  primary: 'bg-primary/15',
  success: 'bg-success/15',
  warning: 'bg-warning/15',
  error: 'bg-error/15',
  info: 'bg-info/15',
}[props.variant]))

const iconColorClass = computed(() => ({
  default: 'text-base-content/60',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
  info: 'text-info',
}[props.variant]))
</script>
