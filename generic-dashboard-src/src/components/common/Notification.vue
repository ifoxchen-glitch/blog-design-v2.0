<template>
  <Teleport to="body">
    <Transition name="notif">
      <div v-if="visible" :class="['alert shadow-lg', alertClass]">
        <div class="flex items-start gap-3 w-full">
          <!-- Icon -->
          <div v-if="type !== 'default'" class="flex-shrink-0 mt-0.5">
            <span v-if="type === 'success'" class="text-success">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span v-else-if="type === 'error'" class="text-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span v-else-if="type === 'warning'" class="text-warning">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            <span v-else-if="type === 'info'" class="text-info">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <h4 v-if="title" class="font-semibold text-sm">{{ title }}</h4>
            <p class="text-sm opacity-90 break-words">{{ message }}</p>
          </div>

          <!-- Close -->
          <button class="btn btn-ghost btn-xs btn-square opacity-70 hover:opacity-100" @click="dismiss">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Progress bar -->
        <div v-if="duration > 0" class="absolute bottom-0 left-0 h-0.5 bg-current opacity-30 transition-all" :style="{ width: `${progress}%` }" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  message: string
  title?: string
  type?: 'success' | 'error' | 'warning' | 'info' | 'default'
  duration?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'default',
  duration: 0,
})

const visible = ref(true)
const progress = ref(100)
let timer: ReturnType<typeof setTimeout> | null = null
let intervalId: ReturnType<typeof setInterval> | null = null

const alertClass = computed(() => {
  const map: Record<string, string> = {
    success: 'alert-success',
    error: 'alert-error',
    warning: 'alert-warning',
    info: 'alert-info',
    default: 'bg-base-100 border-base-300',
  }
  return map[props.type] || map.default
})

function dismiss() {
  visible.value = false
}

watch(() => props.duration, (d) => {
  if (d <= 0) return
  progress.value = 100
  const step = 100 / (d / 50)
  intervalId = setInterval(() => {
    progress.value = Math.max(0, progress.value - step)
  }, 50)
  timer = setTimeout(() => {
    dismiss()
  }, d)
}, { immediate: true })

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  if (intervalId) clearInterval(intervalId)
})
</script>

<style scoped>
.notif-enter-active, .notif-leave-active {
  transition: all 0.3s ease;
}
.notif-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.notif-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
