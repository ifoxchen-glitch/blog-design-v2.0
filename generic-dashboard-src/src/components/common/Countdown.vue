<template>
  <div :class="['font-mono tabular-nums tracking-tight', sizeClass]">
    <span v-if="!finished">{{ displayTime }}</span>
    <span v-else :class="finishedClass">{{ finishedText }}</span>
  </div>
</template>

<script setup lang="ts">
interface Props {
  targetTime: string | number | Date
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  finishedText?: string
  showDays?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  finishedText: '00:00:00',
  showDays: false,
})

const remaining = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

const finished = computed(() => remaining.value <= 0)

const sizeClass = computed(() => ({
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-4xl font-extralight',
}[props.size]))

const finishedClass = computed(() => 'text-error opacity-60')

const displayTime = computed(() => {
  const total = Math.max(0, remaining.value)
  const s = Math.floor(total / 1000)
  const ms = total % 1000

  if (props.showDays) {
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    return `${String(d).padStart(2, '0')}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const msStr = String(ms).padStart(3, '0').slice(0, props.size === 'xl' ? 3 : 0)

  if (props.size === 'xl') {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${msStr}`
  }

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
})

function tick() {
  const target = new Date(props.targetTime).getTime()
  remaining.value = target - Date.now()
  if (remaining.value <= 0) {
    remaining.value = 0
    if (timer) clearInterval(timer)
  }
}

onMounted(() => {
  tick()
  timer = setInterval(tick, props.size === 'xl' ? 50 : 1000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>
