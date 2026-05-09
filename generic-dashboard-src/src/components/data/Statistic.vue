<template>
  <div :class="['stat', directionClass, variantClass && 'bg-' + variantClass, shadow && 'shadow']">
    <div v-if="$slots.figure" class="stat-figure">
      <slot name="figure" />
    </div>
    <div class="stat-title">{{ title }}</div>
    <div class="stat-value">
      <slot>{{ value }}</slot>
    </div>
    <div v-if="description" class="stat-desc">{{ description }}</div>
    <div v-if="$slots.extra" class="stat-extra">
      <slot name="extra" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  title?: string
  value?: string | number
  description?: string
  variant?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'success' | 'warning' | 'error' | 'info'
  direction?: 'horizontal' | 'vertical'
  shadow?: boolean
}>(), {
  direction: 'horizontal',
})

const directionClass = computed(() => {
  return props.direction === 'vertical' ? 'stat-vertical' : ''
})

const variantClass = computed(() => {
  return props.variant || ''
})
</script>

<style scoped>
.stat-vertical {
  flex-direction: column;
  text-align: center;
}

.stat-vertical .stat-value {
  font-size: 2rem;
}

.stat-vertical .stat-figure {
  margin-bottom: 0.5rem;
}
</style>
