<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" class="text-sm text-base-content/70">{{ label }}</label>
    <div class="dropdown relative" :class="open ? 'dropdown-open' : ''">
      <label
        tabindex="0"
        class="btn btn-bordered w-full justify-between"
        :class="[sizeClass, open ? 'btn-active' : '']"
        @click="open = !open"
      >
        <span class="truncate">{{ selectedLabel || placeholder || '请选择' }}</span>
        <svg class="h-4 w-4 transition-transform" :class="open && 'rotate-180'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </label>
      <ul tabindex="0" class="dropdown-content menu p-2 shadow-lg bg-base-200 rounded-box w-full mt-1 z-50 max-h-60 overflow-y-auto" @click="open = false">
        <li v-for="option in options" :key="option.value">
          <a
            :class="{ 'menu-active': option.value === modelValue }"
            @click="select(option.value)"
          >
            {{ option.label }}
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Option {
  label: string
  value: string | number
}

const props = withDefaults(defineProps<{
  modelValue?: string | number
  options: Option[]
  placeholder?: string
  label?: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  size: 'md',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const open = ref(false)
const selectedLabel = computed(() => props.options.find(o => o.value === props.modelValue)?.label)

const sizeClass = computed(() => {
  const map: Record<string, string> = { sm: 'btn-sm', md: '', lg: 'btn-lg' }
  return map[props.size]
})

const select = (value: string | number) => {
  emit('update:modelValue', value)
}
</script>