<template>
  <div
    class="bg-base-200/30 rounded-xl p-4 transition-all"
    :class="{ 'hover:bg-base-200/50 cursor-pointer': clickable }"
    @click="clickable && $emit('click', $event)"
  >
    <div v-if="title" class="flex items-center justify-between mb-3">
      <span class="font-medium text-sm">{{ title }}</span>
      <slot name="action" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  clickable?: boolean
}>(), {
  clickable: false,
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>