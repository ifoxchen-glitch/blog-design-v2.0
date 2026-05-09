<template>
  <Transition name="back-top">
    <button
      v-show="visible"
      :class="['btn btn-circle btn-primary btn-sm fixed bottom-20 right-4 lg:bottom-8 z-50 shadow-lg', className]"
      @click="scrollToTop"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  visibilityHeight?: number
  className?: string
}>(), {
  visibilityHeight: 200,
})

const visible = ref(false)

const handleScroll = () => {
  visible.value = window.scrollY > props.visibilityHeight
}

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<style scoped>
.back-top-enter-active,
.back-top-leave-active {
  transition: all 0.3s ease;
}

.back-top-enter-from,
.back-top-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
