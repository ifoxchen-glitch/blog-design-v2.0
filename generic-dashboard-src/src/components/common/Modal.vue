<template>
  <dialog :class="['modal', open && 'modal-open']">
    <div class="modal-box relative" :class="sizeClass">
      <button v-if="closable" class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="close">✕</button>
      <h3 v-if="title" class="font-bold text-lg mb-4">{{ title }}</h3>
      <slot />
      <div v-if="$slots.action" class="modal-action">
        <slot name="action" />
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close" />
  </dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  closable?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>(), {
  closable: true,
  size: 'md',
})

const emit = defineEmits<{
  close: []
}>()

const sizeClass = computed(() => {
  const map: Record<string, string> = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }
  return map[props.size]
})

const close = () => emit('close')
</script>