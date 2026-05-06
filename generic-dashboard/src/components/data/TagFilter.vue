<template>
  <div class="bg-base-200/30 rounded-xl p-4">
    <div v-if="title" class="mb-3 flex items-center justify-between">
      <h3 class="text-sm font-semibold">{{ title }}</h3>
      <slot name="actions" />
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="(tag, i) in tags"
        :key="i"
        class="rounded-lg px-2.5 py-1 text-xs font-medium transition-all"
        :class="
          modelValue === tag.value
            ? 'bg-primary text-primary-content'
            : 'bg-base-content/5 text-base-content/60 hover:bg-base-content/10'
        "
        @click="$emit('update:modelValue', tag.value)"
      >
        {{ tag.label }}
        <span v-if="tag.count !== undefined" class="ml-1 opacity-60">({{ tag.count }})</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface TagOption {
  label: string
  value: string | number | boolean
  count?: number
}

defineProps<{
  title?: string
  tags: TagOption[]
  modelValue?: string | number | boolean
}>()

defineEmits<{
  'update:modelValue': [value: string | number | boolean]
}>()
</script>
