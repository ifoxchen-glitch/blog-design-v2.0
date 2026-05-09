<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text">{{ label }}</span>
    </label>
    <div class="relative">
      <input
        v-model="displayValue"
        type="text"
        :class="inputClass"
        :placeholder="placeholder || 'HH:MM:SS'"
        :disabled="disabled"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.enter="showPicker = false"
      />
      <div class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    </div>
    <div v-if="showPicker" class="absolute z-50 mt-1 bg-base-100 rounded-lg shadow-xl border border-base-300 p-3 w-48">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1">
          <select v-model="hour" class="select select-sm select-bordered flex-1" @change="emitTime">
            <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
          </select>
          <span class="font-bold">:</span>
          <select v-model="minute" class="select select-sm select-bordered flex-1" @change="emitTime">
            <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
          </select>
          <span v-if="showSecond" class="font-bold">:</span>
          <select v-if="showSecond" v-model="second" class="select select-sm select-bordered flex-1" @change="emitTime">
            <option v-for="s in seconds" :key="s" :value="s">{{ String(s).padStart(2, '0') }}</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  showSecond?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showSecond: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const showPicker = ref(false)
const hour = ref(0)
const minute = ref(0)
const second = ref(0)

const hours = Array.from({ length: 24 }, (_, i) => i)
const minutes = Array.from({ length: 60 }, (_, i) => i)
const seconds = Array.from({ length: 60 }, (_, i) => i)

const displayValue = computed({
  get: () => props.modelValue || '',
  set: (v) => emit('update:modelValue', v),
})

function emitTime() {
  const parts = [hour.value, minute.value]
  if (props.showSecond) parts.push(second.value)
  emit('update:modelValue', parts.map(n => String(n).padStart(2, '0')).join(':'))
}

function onFocus() {
  showPicker.value = true
}

function onBlur() {
  setTimeout(() => { showPicker.value = false }, 200)
}

watch(() => props.modelValue, (v) => {
  if (!v) return
  const parts = v.split(':')
  if (parts.length >= 2) {
    hour.value = parseInt(parts[0]) || 0
    minute.value = parseInt(parts[1]) || 0
    if (props.showSecond && parts[2]) {
      second.value = parseInt(parts[2]) || 0
    }
  }
}, { immediate: true })

const inputClass = computed(() => [
  'input input-bordered w-full pr-8',
  props.disabled ? 'input-disabled opacity-60' : '',
])
</script>
