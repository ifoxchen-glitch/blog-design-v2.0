<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import axios from 'axios'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NSpin,
  useDialog,
  useMessage,
  type FormInst,
  type FormRules,
  type SelectOption,
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import ImageUploader from '../../../components/common/ImageUploader.vue'
import MarkdownEditor from '../../../components/common/MarkdownEditor.vue'
import {
  apiGetPost,
  apiCreatePost,
  apiUpdatePost,
  apiPublishPost,
  apiUnpublishPost,
  apiGetTags,
  apiGetCategories,
  type PostStatus,
} from '../../../api/cms'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const editingId = computed(() => {
  const id = route.params.id
  if (!id) return null
  const n = Number(id)
  return Number.isFinite(n) && n > 0 ? n : null
})
const isEdit = computed(() => editingId.value !== null)

interface PostForm {
  title: string
  slug: string
  excerpt: string
  coverImageUrl: string
  contentMarkdown: string
  tags: string[]
  categories: string[]
}

const initialForm = (): PostForm => ({
  title: '',
  slug: '',
  excerpt: '',
  coverImageUrl: '',
  contentMarkdown: '',
  tags: [],
  categories: [],
})

const form = reactive<PostForm>(initialForm())
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const submitting = ref(false)
const currentStatus = ref<PostStatus>('draft')
const dirty = ref(false)
let suppressDirty = true

watch(
  form,
  () => {
    if (suppressDirty) return
    dirty.value = true
  },
  { deep: true },
)

const formRules = computed<FormRules>(() => ({
  title: [
    { required: true, message: '请输入标题', trigger: 'blur' },
    { max: 200, message: '标题不能超过 200 字', trigger: 'blur' },
  ],
  slug: [
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string) => {
        if (!value) return true
        if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
          return new Error('slug 须以小写字母或数字开头,只含小写字母 / 数字 / 连字符')
        }
        return true
      },
    },
  ],
  excerpt: [{ max: 500, message: '摘要不能超过 500 字', trigger: 'blur' }],
}))

const tagOptions = ref<SelectOption[]>([])
const categoryOptions = ref<SelectOption[]>([])

async function loadOptions() {
  try {
    const [tagsRes, catsRes] = await Promise.all([apiGetTags(), apiGetCategories()])
    tagOptions.value = tagsRes.items.map((t) => ({ label: t.name, value: t.name }))
    categoryOptions.value = catsRes.items.map((c) => ({ label: c.name, value: c.name }))
  } catch {
    // ignore
  }
}

async function loadPost() {
  if (!editingId.value) return
  loading.value = true
  try {
    const detail = await apiGetPost(editingId.value)
    form.title = detail.title
    form.slug = detail.slug
    form.excerpt = detail.excerpt ?? ''
    form.coverImageUrl = detail.coverImageUrl ?? ''
    form.contentMarkdown = detail.contentMarkdown ?? ''
    form.tags = detail.tags.map((t) => t.name)
    form.categories = detail.categories.map((c) => c.name)
    currentStatus.value = detail.status
  } catch (e: unknown) {
    message.error(extractError(e, '加载文章失败'))
  } finally {
    loading.value = false
  }
}

function extractError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message === 'slug_taken') return '该 slug 已被占用'
    if (data?.message) return data.message
  }
  if (e instanceof Error) return e.message
  return fallback
}

async function doSave(targetStatus: PostStatus): Promise<boolean> {
  if (!formRef.value) return false
  try {
    await formRef.value.validate()
  } catch {
    return false
  }
  submitting.value = true
  try {
    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      excerpt: form.excerpt || undefined,
      coverImageUrl: form.coverImageUrl || undefined,
      contentMarkdown: form.contentMarkdown || undefined,
      tags: form.tags,
      categories: form.categories,
    }

    let savedId: number
    if (isEdit.value && editingId.value !== null) {
      const updated = await apiUpdatePost(editingId.value, payload)
      savedId = updated.id
      if (targetStatus === 'published' && currentStatus.value !== 'published') {
        await apiPublishPost(savedId)
        currentStatus.value = 'published'
      } else if (targetStatus === 'draft' && currentStatus.value === 'published') {
        await apiUnpublishPost(savedId)
        currentStatus.value = 'draft'
      } else {
        currentStatus.value = updated.status
      }
    } else {
      const created = await apiCreatePost({ ...payload, status: 'draft' })
      savedId = created.id
      currentStatus.value = created.status
      if (targetStatus === 'published') {
        await apiPublishPost(savedId)
        currentStatus.value = 'published'
      }
    }

    message.success(targetStatus === 'published' ? '已发布' : '草稿已保存')
    dirty.value = false
    return true
  } catch (e: unknown) {
    message.error(extractError(e, '保存失败'))
    return false
  } finally {
    submitting.value = false
  }
}

async function handleSaveDraft() {
  const ok = await doSave('draft')
  if (ok) router.push({ name: 'cms-posts' })
}

async function handlePublish() {
  const ok = await doSave('published')
  if (ok) router.push({ name: 'cms-posts' })
}

function handleCancel() {
  router.push({ name: 'cms-posts' })
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onBeforeRouteLeave((_to, _from, next) => {
  if (!dirty.value) {
    next()
    return
  }
  dialog.warning({
    title: '有未保存的修改',
    content: '当前修改尚未保存,确定要离开吗?',
    positiveText: '离开',
    negativeText: '继续编辑',
    onPositiveClick: () => next(true),
    onNegativeClick: () => next(false),
    onClose: () => next(false),
    onMaskClick: () => next(false),
  })
})

onMounted(async () => {
  window.addEventListener('beforeunload', onBeforeUnload)
  await Promise.all([loadOptions(), loadPost()])
  setTimeout(() => {
    suppressDirty = false
  }, 0)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

const headerTitle = computed(() => (isEdit.value ? '编辑文章' : '新建文章'))
const headerSubtitle = computed(() =>
  isEdit.value
    ? `文章 ID #${editingId.value}(当前${currentStatus.value === 'published' ? '已发布' : '草稿'})`
    : '撰写新文章',
)
</script>

<template>
  <div>
    <PageHeader :title="headerTitle" :subtitle="headerSubtitle">
      <div class="flex items-center gap-2">
        <NButton @click="handleCancel">取消</NButton>
        <NButton :loading="submitting" @click="handleSaveDraft">保存草稿</NButton>
        <NButton type="primary" :loading="submitting" @click="handlePublish">
          {{ currentStatus === 'published' ? '保存并保持发布' : '发布' }}
        </NButton>
      </div>
    </PageHeader>

    <NSpin :show="loading">
      <div class="max-w-4xl">
        <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 md:p-6">
          <NForm
            ref="formRef"
            :model="form"
            :rules="formRules"
            label-placement="left"
            label-width="100"
            require-mark-placement="right-hanging"
          >
            <NFormItem label="标题" path="title">
              <NInput v-model:value="form.title" placeholder="请输入文章标题" />
            </NFormItem>

            <NFormItem label="Slug" path="slug">
              <NInput v-model:value="form.slug" placeholder="可选,留空将由标题自动生成" />
            </NFormItem>

            <NFormItem label="摘要" path="excerpt">
              <NInput
                v-model:value="form.excerpt"
                type="textarea"
                placeholder="可选,显示在列表卡片"
                :autosize="{ minRows: 2, maxRows: 4 }"
              />
            </NFormItem>

            <NFormItem label="封面图" path="coverImageUrl">
              <ImageUploader v-model="form.coverImageUrl" />
            </NFormItem>

            <NFormItem label="标签">
              <NSelect
                v-model:value="form.tags"
                multiple
                tag
                filterable
                :options="tagOptions"
                placeholder="选择已有标签或输入新标签按回车"
              />
            </NFormItem>

            <NFormItem label="分类">
              <NSelect
                v-model:value="form.categories"
                multiple
                tag
                filterable
                :options="categoryOptions"
                placeholder="选择已有分类或输入新分类按回车"
              />
            </NFormItem>

            <NFormItem label="正文" path="contentMarkdown">
              <MarkdownEditor v-model="form.contentMarkdown" :height="500" />
            </NFormItem>
          </NForm>
        </div>
      </div>
    </NSpin>
  </div>
</template>
