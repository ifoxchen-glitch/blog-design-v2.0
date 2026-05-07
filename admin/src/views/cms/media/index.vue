<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  NButton,
  NEmpty,
  NImage,
  NInput,
  NModal,
  NPopconfirm,
  useMessage,
} from 'naive-ui'
import { CloudUploadOutline, CopyOutline, TrashOutline } from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import ImageUploader from '../../../components/common/ImageUploader.vue'
import { apiDeleteMedia } from '../../../api/cms'
import { usePermissionStore } from '../../../stores/permission'

const message = useMessage()
const permissionStore = usePermissionStore()
const showUploadModal = ref(false)

const STORAGE_KEY = 'media:session-urls'
function loadUrls(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
const uploadedUrls = ref<string[]>(loadUrls())
watch(
  uploadedUrls,
  (urls) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(urls))
  },
  { deep: true },
)

const tempUrls = ref<string[]>([])

function openUploader() {
  tempUrls.value = []
  showUploadModal.value = true
}

function handleUploaderChange(value: string | string[]) {
  if (Array.isArray(value)) {
    tempUrls.value = value
  } else {
    tempUrls.value = value ? [value] : []
  }
}

function handleConfirm() {
  const merged = [...tempUrls.value]
  for (const u of uploadedUrls.value) {
    if (!merged.includes(u)) merged.push(u)
  }
  uploadedUrls.value = merged
  showUploadModal.value = false
  if (tempUrls.value.length > 0) {
    message.success(`成功上传 ${tempUrls.value.length} 张图片`)
  }
}

async function copyUrl(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    message.success('已复制 URL')
  } catch {
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    message.success('已复制 URL')
  }
}

async function handleDeleteMedia(url: string) {
  try {
    await apiDeleteMedia(url)
    uploadedUrls.value = uploadedUrls.value.filter((u) => u !== url)
    message.success('已删除')
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : '删除失败'
    message.error(msg)
  }
}
</script>

<template>
  <div>
    <PageHeader title="媒体库" subtitle="管理上传的图片资源">
      <NButton type="primary" @click="openUploader">
        <template #icon>
          <CloudUploadOutline class="w-4 h-4" />
        </template>
        上传图片
      </NButton>
    </PageHeader>

    <div v-if="uploadedUrls.length === 0" class="py-16">
      <NEmpty description="暂无图片">
        <template #extra>
          <p class="text-sm text-base-content/40 mt-2">
            点击右上角"上传图片"按钮开始上传
          </p>
        </template>
      </NEmpty>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      <div
        v-for="url in uploadedUrls"
        :key="url"
        class="group bg-base-100 rounded-xl border border-base-content/5 overflow-hidden hover:border-base-content/10 transition-all"
      >
        <div class="aspect-square overflow-hidden bg-base-300/30">
          <NImage
            :src="url"
            class="w-full h-full object-cover"
            preview-disabled
            :fallback-src="`data:image/svg+xml;utf8,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; width=&quot;100&quot; height=&quot;100&quot;><rect width=&quot;100&quot; height=&quot;100&quot; fill=&quot;%232a323c&quot;/></svg>`"
          />
        </div>
        <div class="p-2">
          <NInput :value="url" readonly size="small" class="text-xs" />
          <div class="flex justify-end mt-1.5 gap-1">
            <NButton size="tiny" quaternary @click="copyUrl(url)">
              <template #icon>
                <CopyOutline class="w-3.5 h-3.5" />
              </template>
              复制
            </NButton>
            <NPopconfirm
              v-if="permissionStore.hasPermission('media:delete')"
              @positive-click="handleDeleteMedia(url)"
            >
              <template #trigger>
                <NButton size="tiny" quaternary type="error">
                  <template #icon>
                    <TrashOutline class="w-3.5 h-3.5" />
                  </template>
                  删除
                </NButton>
              </template>
              确认删除该图片?此操作不可恢复
            </NPopconfirm>
          </div>
        </div>
      </div>
    </div>

    <NModal
      v-model:show="showUploadModal"
      preset="card"
      title="上传图片"
      style="width: 720px; max-width: 90vw;"
      :bordered="false"
    >
      <ImageUploader
        :model-value="tempUrls"
        multiple
        :max="10"
        @update:model-value="handleUploaderChange"
      />
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showUploadModal = false">取消</NButton>
          <NButton type="primary" @click="handleConfirm">完成</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
