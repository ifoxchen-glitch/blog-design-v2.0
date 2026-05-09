<template>
  <div class="dropdown" :class="{ 'dropdown-open': isOpen }">
    <div
      ref="triggerRef"
      :class="triggerClass"
      @click="toggle"
      @mouseenter="trigger === 'hover' && open()"
      @mouseleave="trigger === 'hover' && close()"
    >
      <slot name="trigger">
        <button class="btn">{{ label }}</button>
      </slot>
    </div>
    
    <div
      v-show="isOpen"
      ref="contentRef"
      :class="['dropdown-content', placementClass, 'z-50']"
      @mouseenter="trigger === 'hover' && open()"
      @mouseleave="trigger === 'hover' && close()"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = withDefaults(defineProps<{
  label?: string
  trigger?: 'click' | 'hover'
  placement?: 'bottom' | 'top' | 'left' | 'right' | 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
}>(), {
  trigger: 'click',
  placement: 'bottom',
})

const isOpen = ref(false)
const triggerRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()

const triggerClass = computed(() => {
  return props.trigger === 'hover' ? 'cursor-pointer' : ''
})

const placementClass = computed(() => {
  const map: Record<string, string> = {
    'bottom': 'dropdown-bottom',
    'top': 'dropdown-top',
    'left': 'dropdown-left',
    'right': 'dropdown-right',
    'bottom-start': '',
    'bottom-end': 'dropdown-end',
    'top-start': 'dropdown-top',
    'top-end': 'dropdown-top dropdown-end',
  }
  return map[props.placement]
})

const toggle = () => {
  isOpen.value ? close() : open()
}

const open = () => {
  isOpen.value = true
}

const close = () => {
  isOpen.value = false
}

const handleClickOutside = (e: MouseEvent) => {
  if (
    triggerRef.value &&
    contentRef.value &&
    !triggerRef.value.contains(e.target as Node) &&
    !contentRef.value.contains(e.target as Node)
  ) {
    close()
  }
}

onMounted(() => {
  if (props.trigger === 'click') {
    document.addEventListener('click', handleClickOutside)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

defineExpose({ open, close, toggle })
</script>
