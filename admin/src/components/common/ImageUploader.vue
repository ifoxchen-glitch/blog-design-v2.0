<script setup lang="ts">
/**
 * 通用图片上传组件。
 *
 * - v-model:modelValue 单图为 string,多图为 string[]
 * - 默认 `image-card` 网格布局,支持拖拽
 * - before-upload 校验 MIME / 体积,失败提示
 * - custom-request 调 apiUpload(走统一 axios 拦截器,401 自动续期)
 *
 * @example 单图
 *   <ImageUploader v-model="cover" />
 *
 * @example 多图
 *   <ImageUploader v-model="gallery" multiple :max="6" />
 */
import { computed, ref, watch } from 'vue'
import {
  NUpload,
  NUploadDragger,
  NIcon,
  NText,
  useMessage,
  type UploadCustomRequestOptions,
  type UploadFileInfo,
} from 'naive-ui'
import { CloudUploadOutline } from '@vicons/ionicons5'
import { apiUpload } from '../../api/cms'

interface Props {
  modelValue: string | string[]
  multiple?: boolean
  max?: number
  accept?: string
  maxSize?: number  // MB
  drag?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  multiple: false,
  max: 9,
  accept: 'image/*',
  maxSize: 10,
  drag: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | string[]): void
}>()

const message = useMessage()

// Normalize modelValue → string[] internally; emit shape that matches inbound.
const fileList = ref<UploadFileInfo[]>([])

function urlsFromModel(): string[] {
  if (Array.isArray(props.modelValue)) return [...props.modelValue]
  return props.modelValue ? [props.modelValue] : []
}

function syncFromModel() {
  fileList.value = urlsFromModel().map((url, i) => ({
    id: `seed-${i}-${url}`,
    name: url.split('/').pop() ?? `image-${i}`,
    status: 'finished',
    url,
  } as UploadFileInfo))
}

syncFromModel()

watch(
  () => props.modelValue,
  () => {
    // External resets: reflect into the visible list.
    const incoming = urlsFromModel()
    const current = fileList.value
      .filter((f) => f.status === 'finished' && f.url)
      .map((f) => f.url as string)
    const same =
      incoming.length === current.length &&
      incoming.every((u, i) => u === current[i])
    if (!same) syncFromModel()
  },
)

const showUploadButton = computed(() => {
  if (!props.multiple) {
    return urlsFromModel().length === 0
  }
  return urlsFromModel().length < props.max
})

function emitUrls(urls: string[]) {
  if (props.multiple) {
    emit('update:modelValue', urls)
  } else {
    emit('update:modelValue', urls[0] ?? '')
  }
}

function handleBeforeUpload(data: { file: UploadFileInfo }) {
  const raw = data.file.file
  if (!raw) return false

  if (props.accept && props.accept !== '*') {
    const acceptList = props.accept.split(',').map((s) => s.trim())
    const matched = acceptList.some((rule) => {
      if (rule === 'image/*') return raw.type.startsWith('image/')
      if (rule.endsWith('/*')) return raw.type.startsWith(rule.slice(0, -1))
      return raw.type === rule
    })
    if (!matched) {
      message.error(`不支持的文件类型: ${raw.type || '未知'}`)
      return false
    }
  }

  const sizeMB = raw.size / 1024 / 1024
  if (sizeMB > props.maxSize) {
    message.error(`文件超过 ${props.maxSize}MB 限制`)
    return false
  }
  return true
}

async function handleCustomRequest(opts: UploadCustomRequestOptions) {
  const raw = opts.file.file
  if (!raw) {
    opts.onError()
    return
  }

  try {
    const result = await apiUpload(raw, {
      onProgress: (percent) => opts.onProgress({ percent }),
    })
    // Merge backend url into the file list and emit.
    opts.file.url = result.url
    opts.onFinish()

    const finished = fileList.value
      .filter((f) => f.status === 'finished' && f.url)
      .map((f) => f.url as string)
    if (!finished.includes(result.url)) finished.push(result.url)
    if (!props.multiple) {
      emitUrls([result.url])
    } else {
      emitUrls(finished)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '上传失败'
    message.error(msg)
    opts.onError()
  }
}

function handleRemove(data: { file: UploadFileInfo }) {
  const remaining = fileList.value
    .filter((f) => f.id !== data.file.id && f.status === 'finished' && f.url)
    .map((f) => f.url as string)
  emitUrls(remaining)
  return true
}
</script>

<template>
  <div class="image-uploader">
    <NUpload
      v-model:file-list="fileList"
      :multiple="props.multiple"
      :max="props.max"
      :accept="props.accept"
      list-type="image-card"
      :show-file-list="true"
      :default-upload="true"
      :custom-request="handleCustomRequest"
      @before-upload="handleBeforeUpload"
      @remove="handleRemove"
    >
      <NUploadDragger v-if="props.drag && showUploadButton">
        <div style="margin-bottom: 8px">
          <NIcon size="32" :depth="3"><CloudUploadOutline /></NIcon>
        </div>
        <NText>点击或拖拽图片到此区域上传</NText>
        <div style="font-size: 12px; color: #999; margin-top: 4px">
          支持 {{ props.accept }},单文件不超过 {{ props.maxSize }}MB
        </div>
      </NUploadDragger>
    </NUpload>
  </div>
</template>

<style scoped>
.image-uploader {
  width: 100%;
}
</style>
