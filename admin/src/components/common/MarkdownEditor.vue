<script setup lang="ts">
/**
 * 通用 Markdown 编辑器(基于 Vditor)。
 *
 * 用法:
 *   <MarkdownEditor v-model="post.content" :height="500" />
 *
 * - 默认分屏模式 (sv)。粘贴/拖拽图片走 /api/v2/admin/cms/upload。
 * - 图片上传带 Bearer token,失败提示来自后端 message 字段。
 * - TODO: Vditor 主题与 NConfigProvider 联动留给业务接入时调,先用 classic。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { tokenStorage } from '../../api/tokenStorage'
import { buildUploadConfig } from './markdownEditorLogic'

interface Props {
  modelValue: string
  placeholder?: string
  height?: number | string
  mode?: 'wysiwyg' | 'sv' | 'ir'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请输入 Markdown 内容...',
  height: 400,
  mode: 'sv',
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
let editor: Vditor | null = null
let isInternalUpdate = false

onMounted(() => {
  if (!containerRef.value) return
  const upload = buildUploadConfig(tokenStorage())

  editor = new Vditor(containerRef.value, {
    height: props.height,
    placeholder: props.placeholder,
    mode: props.mode,
    theme: 'classic',
    cache: { enable: false },
    value: props.modelValue,
    after: () => {
      if (editor && props.modelValue) {
        editor.setValue(props.modelValue)
      }
    },
    input: (value: string) => {
      isInternalUpdate = true
      emit('update:modelValue', value)
    },
    upload: {
      url: upload.url,
      fieldName: upload.fieldName,
      max: upload.max,
      multiple: upload.multiple,
      accept: upload.accept,
      setHeaders: upload.setHeaders,
      format: upload.format,
    },
  })
})

watch(
  () => props.modelValue,
  (next) => {
    if (isInternalUpdate) {
      isInternalUpdate = false
      return
    }
    if (!editor) return
    if (editor.getValue() === next) return
    editor.setValue(next ?? '')
  },
)

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy()
    editor = null
  }
})
</script>

<template>
  <div ref="containerRef" class="markdown-editor"></div>
</template>

<style scoped>
.markdown-editor {
  width: 100%;
}
</style>
