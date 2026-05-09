<template>
  <div :class="spaceClass" :style="spaceStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline'
  direction?: 'horizontal' | 'vertical'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  wrap?: boolean
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
}

const props = withDefaults(defineProps<Props>(), {
  align: 'stretch',
  direction: 'horizontal',
  size: 'md',
  wrap: true,
  justify: 'start',
})

const sizeMap: Record<string, string> = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
}

const spaceStyle = computed(() => ({
  gap: sizeMap[props.size],
}))

const alignMap: Record<string, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}

const justifyMap: Record<string, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
}

const spaceClass = computed(() => [
  'flex',
  props.direction === 'vertical' ? 'flex-col' : 'flex-row',
  alignMap[props.align],
  justifyMap[props.justify],
  props.wrap && 'flex-wrap',
])
</script>
