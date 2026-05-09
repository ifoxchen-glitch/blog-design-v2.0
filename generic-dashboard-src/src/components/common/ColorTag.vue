<template>
  <span :class="tagClass" :style="customStyle">
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
interface Props {
  label?: string
  color?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'ghost'
  bg?: string
  text?: string
  size?: 'xs' | 'sm' | 'md'
  outline?: boolean
  pill?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  outline: false,
  pill: false,
})

const tagClass = computed(() => {
  const sizeClass = {
    xs: 'badge-xs',
    sm: 'badge-sm',
    md: '',
  }[props.size]

  const colorMap: Record<string, string> = {
    primary: props.outline ? 'badge-outline' : 'badge-primary',
    secondary: props.outline ? 'badge-outline badge-secondary' : 'badge-secondary',
    accent: props.outline ? 'badge-outline badge-accent' : 'badge-accent',
    success: props.outline ? 'badge-outline badge-success' : 'badge-success',
    warning: props.outline ? 'badge-outline badge-warning' : 'badge-warning',
    error: props.outline ? 'badge-outline badge-error' : 'badge-error',
    info: props.outline ? 'badge-outline badge-info' : 'badge-info',
    ghost: 'badge-ghost',
  }

  return [
    'badge font-medium',
    sizeClass,
    props.color ? colorMap[props.color] : 'badge-primary',
    props.pill && 'badge-lg',
  ].filter(Boolean)
})

const customStyle = computed(() => {
  if (!props.bg && !props.text) return ''
  const style: Record<string, string> = {}
  if (props.bg) style.backgroundColor = props.bg
  if (props.text) style.color = props.text
  return style
})
</script>
