<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <div class="flex gap-1">
        <button
          v-for="(tab, i) in tabs"
          :key="i"
          class="rounded-lg px-3 py-1 text-xs font-medium transition-colors"
          :class="activeTab === i ? 'bg-primary text-primary-content' : 'text-base-content/50 hover:bg-base-content/5'"
          @click="$emit('update:activeTab', i)"
        >
          {{ tab }}
        </button>
      </div>
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string
  tabs: string[]
  activeTab: number
}>()

defineEmits<{
  'update:activeTab': [value: number]
}>()
</script>
