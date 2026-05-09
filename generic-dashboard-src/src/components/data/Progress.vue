<template>
  <div class="radial-progress" :style="style" :aria-valuenow="percent" role="progressbar">
    <slot>{{ percent }}%</slot>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  percent: number
  size?: string
  thickness?: number
  variant?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
}>(), {
  size: '5rem',
  thickness: 10,
  variant: 'primary',
})

const style = computed(() => {
  const vars: Record<string, string> = {
    '--value': String(props.percent),
    '--size': props.size,
    '--thickness': String(props.thickness),
  }
  
  const colorMap: Record<string, string> = {
    primary: 'oklch(var(--p))',
    secondary: 'oklch(var(--s))',
    accent: 'oklch(var(--a))',
    neutral: 'oklch(var(--n))',
    success: 'oklch(var(--su))',
    warning: 'oklch(var(--wa))',
    error: 'oklch(var(--er))',
    info: 'oklch(var(--in))',
  }
  
  vars['--progress-color'] = colorMap[props.variant]
  
  return vars
})
</script>

<style scoped>
.radial-progress {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
</style>
