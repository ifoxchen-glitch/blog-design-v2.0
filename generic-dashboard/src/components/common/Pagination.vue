<template>
  <div class="flex items-center gap-2">
    <span v-if="showInfo" class="text-xs text-base-content/50 mr-2">
      {{ infoText }}
    </span>
    <button
      class="btn btn-sm btn-ghost"
      :disabled="modelValue <= 1"
      @click="change(modelValue - 1)"
    >
      «
    </button>
    <div class="flex">
      <button
        v-for="p in visiblePages"
        :key="p"
        class="btn btn-sm"
        :class="p === modelValue ? 'btn-active' : 'btn-ghost'"
        @click="change(p)"
      >
        {{ p }}
      </button>
    </div>
    <button
      class="btn btn-sm btn-ghost"
      :disabled="modelValue >= totalPages"
      @click="change(modelValue + 1)"
    >
      »
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: number
  total: number
  pageSize?: number
  maxButtons?: number
  showInfo?: boolean
}>(), {
  pageSize: 10,
  maxButtons: 5,
})

const emit = defineEmits<{
  'update:modelValue': [page: number]
}>()

const totalPages = computed(() => Math.ceil(props.total / props.pageSize))

const infoText = computed(() => {
  const start = (props.modelValue - 1) * props.pageSize + 1
  const end = Math.min(props.modelValue * props.pageSize, props.total)
  return `${start}-${end} / ${props.total}`
})

const visiblePages = computed(() => {
  const total = totalPages.value
  const current = props.modelValue
  const max = props.maxButtons
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1)
  
  let start = current - Math.floor(max / 2)
  if (start < 1) start = 1
  if (start + max - 1 > total) start = total - max + 1
  return Array.from({ length: max }, (_, i) => start + i)
})

const change = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    emit('update:modelValue', page)
  }
}
</script>