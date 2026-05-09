<template>
  <div ref="wrapRef" :class="['overflow', thumbClass]" :style="wrapStyle">
    <div ref="contentRef" :class="['scroll-content', alwaysShow && 'always-show']">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  direction?: 'vertical' | 'horizontal' | 'both'
  thumbColor?: string
  thumbRadius?: boolean
  alwaysShow?: boolean
  minThumbLength?: number
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'vertical',
  thumbColor: 'primary',
  thumbRadius: true,
  alwaysShow: false,
  minThumbLength: 20,
})

const wrapRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()

const thumbClass = computed(() => [
  'relative',
  props.direction === 'vertical' && 'overflow-y-scroll',
  props.direction === 'horizontal' && 'overflow-x-scroll',
  props.direction === 'both' && 'overflow-auto',
])

const wrapStyle = computed(() => ({
  scrollbarWidth: props.direction === 'horizontal' ? 'thin' : 'thin',
  scrollbarColor: `${props.thumbColor} transparent`,
}))

onMounted(() => {
  if (!wrapRef.value) return
  // Use CSS custom properties for scrollbar styling
  wrapRef.value.style.setProperty('--scrollbar-thumb-color', `var(--${props.thumbColor}, #888)`)
})
</script>

<style scoped>
.overflow::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.overflow::-webkit-scrollbar-track {
  background: transparent;
}
.overflow::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb-color, #888);
  border-radius: 3px;
}
.overflow::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-color, #666);
}
.scroll-content {
  min-height: min-content;
}
</style>
