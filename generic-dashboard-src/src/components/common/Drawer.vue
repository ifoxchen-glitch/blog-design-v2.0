<template>
  <Teleport to="body">
    <Transition name="drawer">
      <!-- Overlay -->
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/50 z-40"
        @click="closeOnOverlay && $emit('update:modelValue', false)"
      />
    </Transition>
    
    <Transition :name="'drawer-slide-' + placement">
      <!-- Drawer Panel -->
      <div
        v-if="modelValue"
        :class="[
          'fixed z-50 bg-base-100 shadow-2xl',
          placementClass,
          sizeClass,
        ]"
      >
        <!-- Header -->
        <div v-if="title || $slots.header" class="p-4 border-b border-base-300">
          <slot name="header">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">{{ title }}</h3>
              <button
                v-if="closable"
                class="btn btn-ghost btn-sm btn-square"
                @click="$emit('update:modelValue', false)"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </slot>
        </div>
        
        <!-- Body -->
        <div class="p-4 overflow-y-auto" :style="{ maxHeight: bodyMaxHeight }">
          <slot />
        </div>
        
        <!-- Footer -->
        <div v-if="$slots.footer" class="p-4 border-t border-base-300">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: boolean
  title?: string
  placement?: 'left' | 'right' | 'top' | 'bottom'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
}>(), {
  placement: 'right',
  size: 'md',
  closable: true,
  closeOnOverlay: true,
})

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const placementClass = computed(() => {
  const map: Record<string, string> = {
    left: 'left-0 top-0 bottom-0',
    right: 'right-0 top-0 bottom-0',
    top: 'top-0 left-0 right-0',
    bottom: 'bottom-0 left-0 right-0',
  }
  return map[props.placement]
})

const sizeClass = computed(() => {
  const horizontalSizes: Record<string, string> = {
    xs: 'w-64',
    sm: 'w-80',
    md: 'w-96',
    lg: 'w-[32rem]',
    xl: 'w-[40rem]',
    full: 'w-full',
  }
  const verticalSizes: Record<string, string> = {
    xs: 'h-48',
    sm: 'h-64',
    md: 'h-96',
    lg: 'h-[28rem]',
    xl: 'h-[36rem]',
    full: 'h-full',
  }
  
  const isVertical = props.placement === 'top' || props.placement === 'bottom'
  return isVertical ? verticalSizes[props.size] : horizontalSizes[props.size]
})

const bodyMaxHeight = computed(() => {
  if (props.placement === 'top' || props.placement === 'bottom') return undefined
  return 'calc(100vh - 120px)'
})
</script>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.3s ease;
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}

.drawer-slide-left-enter-active,
.drawer-slide-left-leave-active,
.drawer-slide-right-enter-active,
.drawer-slide-right-leave-active {
  transition: transform 0.3s ease;
}

.drawer-slide-left-enter-from,
.drawer-slide-left-leave-to {
  transform: translateX(-100%);
}

.drawer-slide-right-enter-from,
.drawer-slide-right-leave-to {
  transform: translateX(100%);
}

.drawer-slide-top-enter-active,
.drawer-slide-top-leave-active,
.drawer-slide-bottom-enter-active,
.drawer-slide-bottom-leave-active {
  transition: transform 0.3s ease;
}

.drawer-slide-top-enter-from,
.drawer-slide-top-leave-to {
  transform: translateY(-100%);
}

.drawer-slide-bottom-enter-from,
.drawer-slide-bottom-leave-to {
  transform: translateY(100%);
}
</style>
