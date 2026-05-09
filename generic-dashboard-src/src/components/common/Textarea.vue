<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text">{{ label }}</span>
      <span v-if="maxLength" class="label-text-alt">{{ modelValue?.length || 0 }}/{{ maxLength }}</span>
    </label>
    <textarea
      v-model="modelValue"
      :class="textareaClass"
      :placeholder="placeholder"
      :rows="rows"
      :disabled="disabled"
      :maxlength="maxLength"
      :readonly="readonly"
      @focus="focused = true"
      @blur="focused = false"
    />
    <label v-if="hint" class="label">
      <span class="label-text-alt text-base-content/60">{{ hint }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string
  label?: string
  placeholder?: string
  hint?: string
  rows?: number
  disabled?: boolean
  readonly?: boolean
  maxLength?: number
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'filled' | 'outline'
}

const props = withDefaults(defineProps<Props>(), {
  rows: 3,
  disabled: false,
  readonly: false,
  size: 'md',
  variant: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const focused = ref(false)

const modelValue = computed({
  get: () => props.modelValue || '',
  set: (v) => emit('update:modelValue', v),
})

const textareaClass = computed(() => {
  const sizeClass = {
    sm: 'textarea-sm',
    md: '',
    lg: 'textarea-lg',
  }[props.size]

  const variantClass = {
    default: 'textarea-bordered',
    filled: 'textarea-ghost',
    outline: 'textarea-bordered',
  }[props.variant]

  return [
    'textarea w-full resize-none',
    sizeClass,
    variantClass,
    props.disabled && 'textarea-disabled opacity-60',
    focused.value && 'focus:ring-2 focus:ring-primary/50',
  ].filter(Boolean)
})
</script>
