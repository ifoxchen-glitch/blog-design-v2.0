<template>
  <span
    :class="[
      'badge badge-sm',
      latencyClass
    ]"
  >
    <span v-if="testing" class="loading loading-xs"></span>
    <span v-else-if="latency === 0">-</span>
    <span v-else>{{ latency }}ms</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  latency: number
  testing?: boolean
}>()

const latencyClass = computed(() => {
  if (props.testing) return 'bg-base-300/50'
  if (props.latency === 0) return 'bg-base-300/50'
  if (props.latency < 100) return 'bg-success/20 text-success'
  if (props.latency < 200) return 'bg-warning/20 text-warning'
  return 'bg-error/20 text-error'
})
</script>
