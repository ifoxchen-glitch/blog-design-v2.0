<template>
  <div :class="['flex items-center', wrapperClass]">
    <div v-if="position === 'left' || position === 'center'" :class="['flex-1 h-px bg-base-300/60', dividerColor]" />
    <div v-if="withText" :class="['px-3 text-xs font-medium uppercase tracking-wider text-base-content/40', textClass]">
      {{ text }}
    </div>
    <div v-if="position === 'right' || position === 'center'" :class="['flex-1 h-px bg-base-300/60', dividerColor]" />
  </div>
</template>

<script setup lang="ts">
interface Props {
  vertical?: boolean
  position?: 'left' | 'center' | 'right'
  withText?: boolean
  text?: string
  color?: 'base' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error'
  dashed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  vertical: false,
  position: 'center',
  withText: false,
  text: '',
  color: 'base',
  dashed: false,
})

const wrapperClass = computed(() => {
  if (props.vertical) return 'flex-col h-full w-px'
  return 'flex-row w-full'
})

const dividerColor = computed(() => {
  if (props.dashed) return 'border-dashed border-t'
  const map: Record<string, string> = {
    base: 'bg-base-300',
    primary: 'bg-primary/30',
    secondary: 'bg-secondary/30',
    accent: 'bg-accent/30',
    success: 'bg-success/30',
    warning: 'bg-warning/30',
    error: 'bg-error/30',
  }
  return map[props.color]
})

const textClass = computed(() => {
  const map: Record<string, string> = {
    base: '',
    primary: 'text-primary/60',
    secondary: 'text-secondary/60',
    accent: 'text-accent/60',
    success: 'text-success/60',
    warning: 'text-warning/60',
    error: 'text-error/60',
  }
  return map[props.color]
})
</script>
