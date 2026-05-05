<script setup lang="ts">
// 媒体库 MVP — T2.31
// 设计文档:docs/10-phase2-cms-frontend-plan.md §7
//
// 偏离设计文档之处:
// (P3) 路由用 /cms/media(带 cms 前缀),与 menus seed 对齐
// (P6) MVP 方案 A:仅上传弹窗 + 复制 URL,后端尚无 media 表与 list API,
//      历史网格暂用 n-empty 占位。后端补 GET /api/v2/admin/cms/media 后再接入网格,
//      issue #61 关闭时附 follow-up TODO

import { ref } from 'vue'
import {
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NImage,
  NInput,
  NModal,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { CloudUploadOutline, CopyOutline } from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import ImageUploader from '../../../components/common/ImageUploader.vue'

const message = useMessage()
const showUploadModal = ref(false)
const uploadedUrls = ref<string[]>([])
// ImageUploader v-model:多图模式下绑 string[]
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
  // 把本次新上传的合入"本次会话内"列表(顶部插入,去重)
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
    // Fallback:旧浏览器/非 https
    const input = document.createElement('input')
    input.value = url
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    document.body.removeChild(input)
    message.success('已复制 URL')
  }
}
</script>

<template>
  <div>
    <PageHeader title="媒体库" subtitle="管理上传的图片资源(MVP:本次会话内列表 + 上传 + 复制 URL)">
      <NButton type="primary" @click="openUploader">
        <template #icon>
          <NIcon><CloudUploadOutline /></NIcon>
        </template>
        上传图片
      </NButton>
    </PageHeader>

    <NCard>
      <template v-if="uploadedUrls.length === 0">
        <NEmpty description="暂无图片记录">
          <template #extra>
            <NText depth="3" style="font-size: 12px">
              点击右上角"上传图片"按钮开始。后端 media 列表接口建设中,
              本次会话内上传的 URL 会临时保留在此页便于复制使用。
            </NText>
          </template>
        </NEmpty>
      </template>

      <template v-else>
        <NSpace vertical size="medium">
          <NText depth="2">本次会话上传记录(刷新页面后丢失,后端补 list 接口后切真历史):</NText>
          <NSpace
            v-for="url in uploadedUrls"
            :key="url"
            align="center"
            style="width: 100%"
          >
            <NImage :src="url" width="64" height="64" object-fit="cover" />
            <NInput :value="url" readonly style="width: 480px" />
            <NButton size="small" @click="copyUrl(url)">
              <template #icon>
                <NIcon><CopyOutline /></NIcon>
              </template>
              复制
            </NButton>
          </NSpace>
        </NSpace>
      </template>
    </NCard>

    <NModal
      v-model:show="showUploadModal"
      preset="card"
      title="上传图片"
      style="width: 640px"
      :bordered="false"
    >
      <ImageUploader
        :model-value="tempUrls"
        multiple
        :max="10"
        @update:model-value="handleUploaderChange"
      />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showUploadModal = false">取消</NButton>
          <NButton type="primary" @click="handleConfirm">完成</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
