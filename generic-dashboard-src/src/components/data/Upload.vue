<template>
  <div class="w-full">
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      class="hidden"
      @change="handleFileChange"
    />
    
    <!-- Drop Zone -->
    <div
      :class="[
        'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
        isDragging ? 'border-primary bg-primary/10' : 'border-base-300 hover:border-primary',
        disabled && 'opacity-50 cursor-not-allowed',
      ]"
      @click="!disabled && (fileInput as HTMLInputElement).click()"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop.prevent="handleDrop"
    >
      <slot name="default">
        <svg class="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p class="text-sm opacity-70">{{ dragText || '拖拽文件到此处或点击上传' }}</p>
        <p v-if="hint" class="text-xs opacity-50 mt-2">{{ hint }}</p>
      </slot>
    </div>
    
    <!-- File List -->
    <ul v-if="fileList.length > 0" class="mt-4 space-y-2">
      <li
        v-for="(file, index) in fileList"
        :key="index"
        class="flex items-center justify-between p-2 bg-base-200 rounded"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span class="truncate text-sm">{{ file.name }}</span>
          <span class="text-xs opacity-50 flex-shrink-0">{{ formatSize(file.size) }}</span>
        </div>
        <button
          class="btn btn-ghost btn-xs btn-square"
          @click="removeFile(index)"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  modelValue?: File[]
  accept?: string
  multiple?: boolean
  disabled?: boolean
  dragText?: string
  hint?: string
  maxSize?: number
}>(), {
  multiple: false,
})

const emit = defineEmits<{
  'update:modelValue': [files: File[]]
  'change': [files: File[]]
}>()

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const fileList = ref<File[]>(props.modelValue || [])

const handleFileChange = (e: Event) => {
  const files = (e.target as HTMLInputElement).files
  if (files) {
    addFiles(Array.from(files))
  }
}

const handleDrop = (e: DragEvent) => {
  isDragging.value = false
  if (e.dataTransfer?.files) {
    addFiles(Array.from(e.dataTransfer.files))
  }
}

const addFiles = (files: File[]) => {
  if (props.maxSize) {
    files = files.filter(f => f.size <= props.maxSize!)
  }
  
  if (props.multiple) {
    fileList.value = [...fileList.value, ...files]
  } else {
    fileList.value = files.slice(0, 1)
  }
  
  emit('update:modelValue', fileList.value)
  emit('change', fileList.value)
}

const removeFile = (index: number) => {
  fileList.value.splice(index, 1)
  emit('update:modelValue', fileList.value)
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>
