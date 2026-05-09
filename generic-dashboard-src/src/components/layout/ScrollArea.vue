<template>
  <div
    ref="container"
    class="overflow-auto"
    :class="{ 'overflow-x-hidden': hideX, 'overflow-y-hidden': hideY }"
    @scroll="onScroll"
  >
    <div :style="{ width: hideX ? '100%' : 'fit-content', height: hideY ? '100%' : 'fit-content' }">
      <slot />
    </div>
    <!-- Scrollbar track -->
    <div
      v-if="showBar"
      class="absolute bottom-1 right-1 h-1.5 bg-base-300/30 rounded-full overflow-hidden"
      :style="{ left: hideX ? 'auto' : scrollX + 'px', width: hideX ? '100%' : barWidth + 'px' }"
    >
      <div
        class="h-full bg-primary/50 rounded-full transition-all"
        :style="{ width: thumbWidth + 'px', transform: `translateX(${(scrollX / (container?.scrollWidth || 1)) * (barWidth - thumbWidth)}px)` }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  hideX?: boolean
  hideY?: boolean
  showBar?: boolean
}>(), {
  hideX: false,
  hideY: false,
  showBar: false,
})

const container = ref<HTMLElement>()
const scrollX = ref(0)

const barWidth = computed(() => container.value?.clientWidth || 100)
const thumbWidth = computed(() => Math.max(20, (container.value?.clientWidth || 100) ** 2 / (container.value?.scrollWidth || 100)))

const onScroll = (e: Event) => {
  const target = e.target as HTMLElement
  scrollX.value = target.scrollLeft
}
</script>