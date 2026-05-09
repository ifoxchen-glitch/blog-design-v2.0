<template>
  <ul class="timeline">
    <li
      v-for="(item, index) in items"
      :key="index"
      :class="['timeline-item', item.position && 'timeline-' + item.position]"
    >
      <div v-if="item.position !== 'center'" class="timeline-middle">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="6" />
        </svg>
      </div>
      <div :class="['timeline-box', variantClass]">
        <div class="flex items-center gap-2">
          <component v-if="item.icon" :is="item.icon" class="w-5 h-5" />
          <h4 v-if="item.title" class="font-semibold">{{ item.title }}</h4>
        </div>
        <time v-if="item.time" class="text-xs opacity-60">{{ item.time }}</time>
        <p v-if="item.description" class="text-sm opacity-70 mt-1">{{ item.description }}</p>
        <slot :name="'content-' + index" />
      </div>
      <hr v-if="index < items.length - 1" />
    </li>
  </ul>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

interface TimelineItem {
  title?: string
  description?: string
  time?: string
  icon?: Component
  position?: 'start' | 'end' | 'center'
}

const props = withDefaults(defineProps<{
  items: TimelineItem[]
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'error' | 'info'
}>(), {
  variant: 'primary',
})

const variantClass = computed(() => {
  const map: Record<string, string> = {
    primary: 'timeline-primary',
    secondary: 'timeline-secondary',
    accent: 'timeline-accent',
    success: 'timeline-success',
    warning: 'timeline-warning',
    error: 'timeline-error',
    info: 'timeline-info',
  }
  return map[props.variant]
})
</script>

<style scoped>
.timeline {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.timeline-item {
  position: relative;
  display: flex;
  gap: 1rem;
}

.timeline-middle {
  flex-shrink: 0;
  width: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-box {
  flex: 1;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  background: oklch(var(--b2));
  border: 1px solid oklch(var(--b3));
}

hr {
  position: absolute;
  left: 0.625rem;
  top: 2rem;
  width: 2px;
  height: calc(100% - 1rem);
  background: oklch(var(--b3));
  border: none;
}
</style>
