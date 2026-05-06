<script setup lang="ts">
import { ref } from 'vue'
import axios from 'axios'
import {
  NAlert,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NIcon,
  NSpin,
  NUpload,
  useDialog,
  useMessage,
  type UploadCustomRequestOptions,
} from 'naive-ui'
import {
  CloudDownloadOutline,
  CloudUploadOutline,
  WarningOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import { apiExportData, apiImportData, type BackupData } from '../../../api/cms'

const message = useMessage()
const dialog = useDialog()

const exporting = ref(false)
const importing = ref(false)

const previewData = ref<BackupData | null>(null)
const previewFileName = ref('')

async function handleExport() {
  exporting.value = true
  try {
    const data = await apiExportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10)
    a.href = url
    a.download = `blog-backup-${today}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    message.success(
      `导出成功:posts ${data.posts.length}、tags ${data.tags.length}、categories ${data.categories.length}、links ${data.links.length}`,
    )
  } catch (e: unknown) {
    message.error(extractError(e, '导出失败'))
  } finally {
    exporting.value = false
  }
}

function handleImportFile(opts: UploadCustomRequestOptions) {
  const raw = opts.file.file
  if (!raw) {
    opts.onError()
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    try {
      const text = String(ev.target?.result ?? '')
      const parsed = JSON.parse(text) as BackupData
      if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.posts)) {
        message.error('文件格式不合法:必须是 v2 备份 JSON')
        opts.onError()
        return
      }
      previewData.value = parsed
      previewFileName.value = raw.name
      opts.onFinish()
    } catch (e: unknown) {
      message.error(`解析失败:${e instanceof Error ? e.message : '未知错误'}`)
      opts.onError()
    }
  }
  reader.onerror = () => {
    message.error('读取文件失败')
    opts.onError()
  }
  reader.readAsText(raw)
}

function clearPreview() {
  previewData.value = null
  previewFileName.value = ''
}

function handleConfirmImport() {
  if (!previewData.value) return
  dialog.warning({
    title: '确认导入',
    content:
      `本操作将用上传文件覆盖式还原全库数据(原数据会被清空再写入)。\n\n` +
      `将导入:posts ${previewData.value.posts.length}、tags ${previewData.value.tags.length}、` +
      `categories ${previewData.value.categories.length}、links ${previewData.value.links.length}。\n\n` +
      `不可恢复,确定继续?`,
    positiveText: '确定导入',
    negativeText: '取消',
    onPositiveClick: async () => {
      if (!previewData.value) return
      importing.value = true
      try {
        const result = await apiImportData(previewData.value)
        message.success(
          `导入成功:posts ${result.imported.posts}、tags ${result.imported.tags}、` +
            `categories ${result.imported.categories}、links ${result.imported.links}`,
        )
        clearPreview()
      } catch (e: unknown) {
        message.error(extractError(e, '导入失败'))
      } finally {
        importing.value = false
      }
    },
  })
}

function extractError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message?.startsWith('invalid_format')) {
      return `文件格式不合法:${data.message}`
    }
    if (data?.message === 'import_failed') return '导入失败,请检查文件内容'
    if (data?.message) return data.message
  }
  if (e instanceof Error) return e.message
  return fallback
}
</script>

<template>
  <div>
    <PageHeader title="数据导入导出" subtitle="全库 JSON 备份 / 还原(仅超管可用)" />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Export -->
      <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 md:p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <CloudDownloadOutline class="w-5 h-5 text-primary" />
          </div>
          <div>
            <div class="font-medium">导出全库</div>
            <div class="text-xs text-base-content/40">将文章、标签、分类、友链导出为 JSON</div>
          </div>
        </div>
        <p class="text-sm text-base-content/50 mb-5">
          导出文件名格式为 blog-backup-YYYY-MM-DD.json，包含所有内容数据。
        </p>
        <NButton type="primary" :loading="exporting" @click="handleExport">
          <template #icon>
            <NIcon><CloudDownloadOutline /></NIcon>
          </template>
          导出 JSON 备份
        </NButton>
      </div>

      <!-- Import -->
      <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 md:p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center">
            <CloudUploadOutline class="w-5 h-5 text-error" />
          </div>
          <div>
            <div class="font-medium">导入全库</div>
            <div class="text-xs text-base-content/40">覆盖式还原，操作不可恢复</div>
          </div>
        </div>

        <NAlert type="warning" :show-icon="true" class="mb-5">
          <template #icon>
            <NIcon><WarningOutline /></NIcon>
          </template>
          导入会<strong>覆盖式还原</strong>:原有的文章、标签、分类、友链及关联会被清空再写入,操作不可恢复。
        </NAlert>

        <div class="flex flex-col gap-4">
          <NUpload
            :default-upload="true"
            :show-file-list="false"
            accept=".json,application/json"
            :custom-request="handleImportFile"
          >
            <NButton>
              <template #icon>
                <NIcon><CloudUploadOutline /></NIcon>
              </template>
              选择 JSON 备份文件
            </NButton>
          </NUpload>

          <NSpin :show="importing">
            <div
              v-if="previewData"
              class="bg-base-200/50 rounded-xl border border-base-content/5 p-4"
            >
              <div class="text-sm font-medium mb-3">导入预览</div>
              <NDescriptions :column="2" label-placement="left">
                <NDescriptionsItem label="文件名">{{ previewFileName }}</NDescriptionsItem>
                <NDescriptionsItem label="导出时间">{{ previewData.exportedAt }}</NDescriptionsItem>
                <NDescriptionsItem label="文章">{{ previewData.posts.length }}</NDescriptionsItem>
                <NDescriptionsItem label="标签">{{ previewData.tags.length }}</NDescriptionsItem>
                <NDescriptionsItem label="分类">{{ previewData.categories.length }}</NDescriptionsItem>
                <NDescriptionsItem label="友链">{{ previewData.links.length }}</NDescriptionsItem>
              </NDescriptions>

              <div class="flex gap-2 mt-4">
                <NButton
                  type="error"
                  :loading="importing"
                  @click="handleConfirmImport"
                >
                  确认导入(覆盖)
                </NButton>
                <NButton @click="clearPreview">取消</NButton>
              </div>
            </div>
          </NSpin>
        </div>
      </div>
    </div>
  </div>
</template>
