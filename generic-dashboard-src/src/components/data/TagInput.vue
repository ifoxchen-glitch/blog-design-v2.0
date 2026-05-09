<template>
  <div class="form-control w-full">
    <label v-if="label" class="label">
      <span class="label-text">{{ label }}</span>
      <span v-if="maxTags" class="label-text-alt">{{ tags.length }}/{{ maxTags }}</span>
    </label>
    <div
      :class="['input input-bordered flex flex-wrap gap-1.5 min-h-[42px] px-3 py-2 cursor-text', disabled && 'input-disabled opacity-60', focused && 'ring-2 ring-primary/50']"
      @click="focusInput"
    >
      <ColorTag
        v-for="(tag, i) in tags"
        :key="i"
        :label="tag"
        color="primary"
        size="sm"
        pill
      >
        <span>{{ tag }}</span>
        <button v-if="!disabled" class="ml-1 opacity-60 hover:opacity-100" @click.stop="removeTag(i)">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </ColorTag>
      <input
        v-if="!disabled && (!maxTags || tags.length < maxTags)"
        ref="inputRef"
        v-model="inputVal"
        class="outline-none bg-transparent flex-1 min-w-[80px] text-sm"
        :placeholder="tags.length === 0 ? placeholder : ''"
        @focus="focused = true"
        @blur="focused = false; onBlur()"
        @keydown.enter.prevent="addTag"
        @keydown.backspace="onBackspace"
        @keydown.delete="onBackspace"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string[]
  label?: string
  placeholder?: string
  disabled?: boolean
  maxTags?: number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: () => [],
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const inputRef = ref<HTMLInputElement>()
const inputVal = ref('')
const focused = ref(false)

const tags = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

function addTag() {
  const val = inputVal.value.trim()
  if (!val) return
  if (props.maxTags && tags.value.length >= props.maxTags) return
  if (tags.value.includes(val)) return
  tags.value = [...tags.value, val]
  inputVal.value = ''
}

function removeTag(index: number) {
  tags.value = tags.value.filter((_, i) => i !== index)
}

function onBlur() {
  if (inputVal.value.trim()) addTag()
}

function onBackspace() {
  if (inputVal.value !== '') return
  if (tags.value.length > 0) {
    removeTag(tags.value.length - 1)
  }
}

function focusInput() {
  inputRef.value?.focus()
}
</script>
