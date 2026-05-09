<template>
  <div ref="affixRef" :style="affixStyle">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  offsetTop?: number
  offsetBottom?: number
}>(), {
  offsetTop: 0,
})

const affixRef = ref<HTMLElement>()
const isFixed = ref(false)
const originalTop = ref(0)

const affixStyle = computed(() => {
  if (!isFixed.value) return {}
  
  return {
    position: 'fixed',
    top: props.offsetBottom ? undefined : `${props.offsetTop}px`,
    bottom: props.offsetBottom ? `${props.offsetBottom}px` : undefined,
    left: '0',
    right: '0',
    zIndex: '100',
  }
})

const handleScroll = () => {
  if (!affixRef.value) return
  
  const rect = affixRef.value.getBoundingClientRect()
  
  if (props.offsetBottom !== undefined) {
    isFixed.value = rect.bottom > window.innerHeight - props.offsetBottom
  } else {
    isFixed.value = rect.top <= props.offsetTop
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
  handleScroll()
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>
