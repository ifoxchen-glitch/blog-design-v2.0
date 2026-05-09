<template>
  <div class="carousel relative overflow-hidden rounded-box" :style="{ width, height }">
    <div
      class="carousel-inner flex transition-transform duration-500"
      :style="{ transform: `translateX(-${currentIndex * 100}%)` }"
    >
      <div
        v-for="(item, index) in items"
        :key="index"
        class="carousel-item flex-shrink-0 w-full h-full"
      >
        <slot :item="item" :index="index">
          <img v-if="typeof item === 'string'" :src="item" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span>{{ item }}</span>
          </div>
        </slot>
      </div>
    </div>
    
    <!-- Navigation Arrows -->
    <button
      v-if="showArrows"
      class="carousel-prev btn btn-circle btn-sm btn-ghost absolute left-2 top-1/2 -translate-y-1/2"
      @click="prev"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    
    <button
      v-if="showArrows"
      class="carousel-next btn btn-circle btn-sm btn-ghost absolute right-2 top-1/2 -translate-y-1/2"
      @click="next"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
    
    <!-- Indicators -->
    <div v-if="showIndicators" class="carousel-indicators absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
      <button
        v-for="(_, index) in items"
        :key="index"
        :class="[
          'w-2 h-2 rounded-full transition-all',
          index === currentIndex ? 'bg-primary w-6' : 'bg-base-content/30 hover:bg-base-content/50',
        ]"
        @click="goTo(index)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  items: any[]
  width?: string
  height?: string
  showArrows?: boolean
  showIndicators?: boolean
  autoplay?: boolean
  interval?: number
}>(), {
  width: '100%',
  height: '16rem',
  showArrows: true,
  showIndicators: true,
  autoplay: false,
  interval: 3000,
})

const currentIndex = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const next = () => {
  currentIndex.value = (currentIndex.value + 1) % props.items.length
}

const prev = () => {
  currentIndex.value = currentIndex.value === 0 ? props.items.length - 1 : currentIndex.value - 1
}

const goTo = (index: number) => {
  currentIndex.value = index
}

const startAutoplay = () => {
  if (props.autoplay) {
    timer = setInterval(next, props.interval)
  }
}

const stopAutoplay = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

onMounted(startAutoplay)
onBeforeUnmount(stopAutoplay)

defineExpose({ next, prev, goTo })
</script>
