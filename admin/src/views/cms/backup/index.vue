<script setup lang="ts">
// 数据导入导出页 — T2.32
// 设计文档:docs/10-phase2-cms-frontend-plan.md §8
//
// 偏离设计文档之处:
// (P3) 路由用 /cms/backup(带 cms 前缀),与本期其他 cms 页保持一致
// (P5) menus seed 没有 /cms/backup 节点,本 PR 在 server/src/seeds/rbacSeed.js
//      MENUS 顶级追加"数据导入导出"节点,permission: cms:export,
//      生产 DB 因 seed 跳过策略不会自动加,需在菜单管理页手动新增
// (P7) 设计文档 §0.1 写 export/import 在 /backup/export、/backup/import,
//      后端真实路径是 /export、/import(无 backup 中段),api/cms.ts 已对齐

import { ref } from 'vue'
import axios from 'axios'
import {
  NAlert,
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NIcon,
  NSpace,
  NSpin,
  NText,
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

// 导入预览
const previewData = ref<BackupData | null>(null)
const previewFileName = ref<string>('')

// ---- 导出 ----
async function handleExport() {
  exporting.value = true
  try {
    const data = await apiExportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
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

// ---- 导入预览 ----
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

    <NSpace vertical size="large">
      <NCard title="导出全库">
        <NSpace vertical size="medium">
          <NText depth="2">
            将文章、标签、分类、友链及关联表导出为 JSON 文件,文件名
            <NText code>blog-backup-YYYY-MM-DD.json</NText>。
          </NText>
          <NButton type="primary" :loading="exporting" @click="handleExport">
            <template #icon>
              <NIcon><CloudDownloadOutline /></NIcon>
            </template>
            导出 JSON 备份
          </NButton>
        </NSpace>
      </NCard>

      <NCard title="导入全库">
        <NAlert type="warning" :show-icon="true" style="margin-bottom: 16px">
          <template #icon>
            <NIcon><WarningOutline /></NIcon>
          </template>
          导入会<NText strong>覆盖式还原</NText>:原有的文章、标签、分类、友链及关联会被清空再写入,操作不可恢复。
        </NAlert>

        <NSpace vertical size="medium">
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
            <NCard
              v-if="previewData"
              size="small"
              embedded
              :bordered="false"
              style="background: #f7f7f7"
            >
              <NDescriptions
                :column="2"
                label-placement="left"
                title="导入预览"
              >
                <NDescriptionsItem label="文件名">
                  {{ previewFileName }}
                </NDescriptionsItem>
                <NDescriptionsItem label="导出时间">
                  {{ previewData.exportedAt }}
                </NDescriptionsItem>
                <NDescriptionsItem label="文章 (posts)">
                  {{ previewData.posts.length }}
                </NDescriptionsItem>
                <NDescriptionsItem label="标签 (tags)">
                  {{ previewData.tags.length }}
                </NDescriptionsItem>
                <NDescriptionsItem label="分类 (categories)">
                  {{ previewData.categories.length }}
                </NDescriptionsItem>
                <NDescriptionsItem label="友链 (links)">
                  {{ previewData.links.length }}
                </NDescriptionsItem>
              </NDescriptions>

              <NSpace style="margin-top: 16px">
                <NButton
                  type="error"
                  :loading="importing"
                  @click="handleConfirmImport"
                >
                  确认导入(覆盖)
                </NButton>
                <NButton @click="clearPreview">取消</NButton>
              </NSpace>
            </NCard>
          </NSpin>
        </NSpace>
      </NCard>
    </NSpace>
  </div>
</template>
