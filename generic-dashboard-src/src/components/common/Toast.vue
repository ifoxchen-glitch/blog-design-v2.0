<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', 'toast-' + toast.type, 'shadow-lg']"
        >
          <div class="flex items-center gap-2">
            <!-- Icon -->
            <svg v-if="toast.type === 'success'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <svg v-else-if="toast.type === 'error'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <svg v-else-if="toast.type === 'warning'" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ toast.message }}</span>
          </div>
          <button
            v-if="toast.closable !== false"
            class="btn btn-ghost btn-xs btn-square"
            @click="remove(toast.id)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  closable?: boolean
}

const toasts = ref<Toast[]>([])
let idCounter = 0

const show = (message: string, type: Toast['type'] = 'info', options: { duration?: number; closable?: boolean } = {}) => {
  const id = idCounter++
  const toast: Toast = { id, message, type, ...options }
  toasts.value.push(toast)
  
  if (options.duration !== 0) {
    setTimeout(() => remove(id), options.duration || 3000)
  }
  
  return id
}

const remove = (id: number) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) toasts.value.splice(index, 1)
}

const success = (message: string, options?: { duration?: number; closable?: boolean }) => show(message, 'success', options)
const error = (message: string, options?: { duration?: number; closable?: boolean }) => show(message, 'error', options)
const warning = (message: string, options?: { duration?: number; closable?: boolean }) => show(message, 'warning', options)
const info = (message: string, options?: { duration?: number; closable?: boolean }) => show(message, 'info', options)

defineExpose({ show, remove, success, error, warning, info })
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1rem;
  right: 1rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.toast {
  min-width: 280px;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.toast-success { background-color: oklch(var(--s)); color: oklch(var(--sc)); }
.toast-error { background-color: oklch(var(--er)); color: oklch(var(--erc)); }
.toast-warning { background-color: oklch(var(--wa)); color: oklch(var(--wac)); }
.toast-info { background-color: oklch(var(--in)); color: oklch(var(--inc)); }

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
