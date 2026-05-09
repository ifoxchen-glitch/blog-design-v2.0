<template>
  <div class="popover relative inline-block">
    <div
      ref="triggerRef"
      @mouseenter="trigger === 'hover' && show()"
      @mouseleave="trigger === 'hover' && hide()"
      @click="trigger === 'click' && toggle()"
    >
      <slot name="trigger" />
    </div>
    
    <Teleport to="body">
      <Transition name="popover">
        <div
          v-if="visible"
          ref="contentRef"
          :class="['popover-content card bg-base-100 shadow-xl', placementClass]"
          :style="contentStyle"
          @mouseenter="trigger === 'hover' && show()"
          @mouseleave="trigger === 'hover' && hide()"
        >
          <slot />
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  trigger?: 'click' | 'hover'
  placement?: 'top' | 'bottom' | 'left' | 'right'
  offset?: number
}>(), {
  trigger: 'hover',
  placement: 'top',
  offset: 8,
})

const visible = ref(false)
const triggerRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()
const contentStyle = ref<Record<string, string>>({})

const placementClass = computed(() => {
  return `popover-${props.placement}`
})

const updatePosition = async () => {
  if (!triggerRef.value || !contentRef.value || !visible.value) return
  
  await nextTick()
  
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const contentRect = contentRef.value.getBoundingClientRect()
  
  const positions: Record<string, () => Record<string, string>> = {
    top: () => ({
      left: `${triggerRect.left + triggerRect.width / 2 - contentRect.width / 2}px`,
      top: `${triggerRect.top - contentRect.height - props.offset}px`,
    }),
    bottom: () => ({
      left: `${triggerRect.left + triggerRect.width / 2 - contentRect.width / 2}px`,
      top: `${triggerRect.bottom + props.offset}px`,
    }),
    left: () => ({
      left: `${triggerRect.left - contentRect.width - props.offset}px`,
      top: `${triggerRect.top + triggerRect.height / 2 - contentRect.height / 2}px`,
    }),
    right: () => ({
      left: `${triggerRect.right + props.offset}px`,
      top: `${triggerRect.top + triggerRect.height / 2 - contentRect.height / 2}px`,
    }),
  }
  
  contentStyle.value = positions[props.placement]()
}

const show = () => {
  visible.value = true
  nextTick(updatePosition)
}

const hide = () => {
  visible.value = false
}

const toggle = () => {
  visible.value ? hide() : show()
}

const handleClickOutside = (e: MouseEvent) => {
  if (
    triggerRef.value &&
    contentRef.value &&
    !triggerRef.value.contains(e.target as Node) &&
    !contentRef.value.contains(e.target as Node)
  ) {
    hide()
  }
}

watch(visible, (val) => {
  if (val && props.trigger === 'click') {
    setTimeout(() => document.addEventListener('click', handleClickOutside), 0)
  } else {
    document.removeEventListener('click', handleClickOutside)
  }
})

onMounted(() => {
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
  document.removeEventListener('click', handleClickOutside)
})

defineExpose({ show, hide, toggle })
</script>

<style scoped>
.popover-content {
  position: fixed;
  z-index: 9999;
  min-width: 150px;
  max-width: 400px;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
}

.popover-enter-active,
.popover-leave-active {
  transition: all 0.2s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
