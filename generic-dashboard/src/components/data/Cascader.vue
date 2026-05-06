<template>
  <div class="flex flex-col gap-2">
    <label v-if="label" class="text-sm text-base-content/70">{{ label }}</label>
    <div class="dropdown relative" :class="open ? 'dropdown-open' : ''">
      <label
        tabindex="0"
        class="btn btn-bordered w-full justify-between"
        @click="open = !open"
      >
        <span class="truncate">{{ selectedLabels || placeholder || '请选择' }}</span>
        <svg class="h-4 w-4 transition-transform" :class="open && 'rotate-180'" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </label>
      <ul tabindex="0" class="dropdown-content shadow-lg bg-base-200 rounded-box w-full mt-1 z-50 p-2" @click="open = false">
        <li v-for="option in options" :key="option.value">
          <div class="flex items-center gap-2 p-2 hover:bg-base-300/30 rounded cursor-pointer" @click="select(option)">
            <span class="flex-1">{{ option.label }}</span>
            <svg v-if="option.children" class="w-4 h-4 opacity-50" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Option {
  label: string
  value: string
  children?: Option[]
}

const props = withDefaults(defineProps<{
  modelValue?: string | string[]
  options: Option[]
  placeholder?: string
  label?: string
  multiple?: boolean
}>(), {
  multiple: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | string[]]
}>()

const open = ref(false)

const selectedLabels = computed(() => {
  if (!props.modelValue) return ''
  const findLabel = (opts: Option[], val: string): string => {
    for (const o of opts) {
      if (o.value === val) return o.label
      if (o.children) {
        const found = findLabel(o.children, val)
        if (found) return found
      }
    }
    return ''
  }
  if (Array.isArray(props.modelValue)) {
    return props.modelValue.map(v => findLabel(props.options, v)).join(' / ')
  }
  return findLabel(props.options, props.modelValue as string)
})

const select = (option: Option) => {
  if (props.multiple) {
    const current = (props.modelValue as string[]) || []
    if (current.includes(option.value)) {
      emit('update:modelValue', current.filter(v => v !== option.value))
    } else {
      emit('update:modelValue', [...current, option.value])
    }
  } else {
    emit('update:modelValue', option.value)
  }
}
</script>