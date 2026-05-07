<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import axios from 'axios'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSwitch,
  NModal,
  NSpin,
  useMessage,
} from 'naive-ui'
import {
  apiPreviewDocument,
  apiPublishDocument,
  apiListDocumentPosts,
  type KbDocumentPost,
  type PublishBody,
} from '../../../api/kb'
import {
  apiGetTags,
  apiGetCategories,
} from '../../../api/cms'

const props = defineProps<{
  show: boolean
  documentId: number
  documentTitle: string
  documentSlug: string
  documentExcerpt: string | null
  documentTags: string[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  published: []
}>()

const message = useMessage()

const previewHtml = ref('')
const previewLoading = ref(false)
const publishing = ref(false)
const existingMapping = ref<KbDocumentPost | null>(null)

const form = ref<PublishBody>({
  title: '',
  slug: '',
  excerpt: '',
  coverImageUrl: '',
  tags: [],
  categories: [],
  publishNow: true,
  syncEnabled: false,
})

const tagOptions = ref<Array<{ label: string; value: string }>>([])
const categoryOptions = ref<Array<{ label: string; value: string }>>([])

const hasMapping = computed(() => existingMapping.value !== null)

async function loadOptions() {
  try {
    const [tagsRes, catsRes] = await Promise.all([apiGetTags(), apiGetCategories()])
    tagOptions.value = tagsRes.items.map((t: { name: string }) => ({ label: t.name, value: t.name }))
    categoryOptions.value = catsRes.items.map((c: { name: string }) => ({ label: c.name, value: c.name }))
  } catch { /* ignore */ }
}

async function loadPreview() {
  previewLoading.value = true
  try {
    const result = await apiPreviewDocument(props.documentId)
    previewHtml.value = result.html
  } catch {
    previewHtml.value = '<p class="text-red-500">加载预览失败</p>'
  } finally {
    previewLoading.value = false
  }
}

async function checkExistingMapping() {
  try {
    const res = await apiListDocumentPosts({ page: 1, pageSize: 100 })
    existingMapping.value = res.items.find((m) => m.document_id === props.documentId) ?? null
  } catch {
    existingMapping.value = null
  }
}

watch(
  () => props.show,
  (val) => {
    if (!val) return
    // Reset form
    form.value = {
      title: props.documentTitle,
      slug: 'kb-' + props.documentSlug,
      excerpt: props.documentExcerpt ?? '',
      coverImageUrl: '',
      tags: props.documentTags ?? [],
      categories: [],
      publishNow: true,
      syncEnabled: false,
    }
    loadOptions()
    loadPreview()
    checkExistingMapping()
  },
)

function handleCancel() {
  emit('update:show', false)
}

async function handlePublish() {
  publishing.value = true
  try {
    await apiPublishDocument(props.documentId, {
      ...form.value,
      tags: form.value.tags?.length ? form.value.tags : undefined,
      categories: form.value.categories?.length ? form.value.categories : undefined,
    })
    message.success(hasMapping.value ? '文章已更新' : '已发布到博客')
    emit('published')
    emit('update:show', false)
  } catch (e: unknown) {
    if (axios.isAxiosError(e)) {
      const data = e.response?.data as { message?: string } | undefined
      if (data?.message === 'slug_taken') {
        message.error('该 slug 已被占用，请修改')
        return
      }
    }
    message.error('发布失败')
  } finally {
    publishing.value = false
  }
}

</script>

<template>
  <NModal
    :show="show"
    :on-update:show="(val: boolean) => emit('update:show', val)"
    preset="card"
    title="发布到博客"
    style="max-width: 900px; width: 90vw;"
    :mask-closable="false"
  >
    <div class="flex flex-col lg:flex-row gap-4" style="min-height: 50vh; max-height: 65vh;">
      <!-- 预览区 -->
      <div class="flex-1 min-w-0 overflow-auto rounded-lg border border-base-content/10 bg-base-200/50 p-4">
        <NSpin :show="previewLoading">
          <div v-if="previewHtml" v-html="previewHtml" class="prose prose-sm max-w-none" />
          <div v-else class="text-base-content/30 text-sm text-center py-8">加载预览中...</div>
        </NSpin>
      </div>

      <!-- 发布设置 -->
      <div class="w-full lg:w-72 shrink-0 overflow-auto">
        <div v-if="hasMapping" class="mb-4 px-3 py-2 rounded-lg bg-success/10 border border-success/20 text-sm text-success">
          已关联文章，发布将更新该文章
        </div>

        <NForm label-placement="top" size="small">
          <NFormItem label="文章标题">
            <NInput v-model:value="form.title" placeholder="文章标题" />
          </NFormItem>
          <NFormItem label="Slug">
            <NInput v-model:value="form.slug" placeholder="kb-doc-slug" />
          </NFormItem>
          <NFormItem label="摘要">
            <NInput v-model:value="form.excerpt" type="textarea" placeholder="可选摘要" :autosize="{ minRows: 2, maxRows: 3 }" />
          </NFormItem>
          <NFormItem label="封面图 URL">
            <NInput v-model:value="form.coverImageUrl" placeholder="可选" />
          </NFormItem>
          <NFormItem label="标签">
            <NSelect
              v-model:value="form.tags"
              multiple
              tag
              filterable
              :options="tagOptions"
              placeholder="选择或输入标签"
            />
          </NFormItem>
          <NFormItem label="分类">
            <NSelect
              v-model:value="form.categories"
              multiple
              tag
              filterable
              :options="categoryOptions"
              placeholder="选择或输入分类"
            />
          </NFormItem>
          <NFormItem label="立即发布">
            <NSwitch v-model:value="form.publishNow" />
          </NFormItem>
          <NFormItem label="自动同步">
            <NSwitch v-model:value="form.syncEnabled" />
            <span class="text-xs text-base-content/40 ml-2">文档更新时自动同步到文章</span>
          </NFormItem>
        </NForm>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-2">
        <NButton @click="handleCancel">取消</NButton>
        <NButton type="primary" :loading="publishing" @click="handlePublish">
          {{ hasMapping ? '更新文章' : '发布文章' }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>
