<template>
  <div class="tabs tabs-boxed bg-base-200/50 p-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      :class="[
        'tab transition-all duration-200',
        modelValue === tab.value
          ? 'tab-active bg-base-100 shadow-sm font-semibold'
          : 'hover:bg-base-200 opacity-80'
      ]"
      @click="emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
interface Tab {
  label: string
  value: string | number
}

interface Props {
  modelValue: string | number
  tabs: Tab[]
  variant?: 'box' | 'lift' | 'pills' | 'bordered'
}

withDefaults(defineProps<Props>(), {
  variant: 'box',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()
</script>
