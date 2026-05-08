<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
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
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import MarkdownEditor from '../../../components/common/MarkdownEditor.vue'
import PublishDialog from '../../../components/kb/publish/PublishDialog.vue'
import {
  apiGetKbDocument,
  apiCreateKbDocument,
  apiUpdateKbDocument,
} from '../../../api/kb'

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

interface DocForm {
  title: string
  slug: string
  excerpt: string
  content_markdown: string
  tags: string[]
  category: string
  doc_type: string
  connections: string[]
  sources: string[]
  doc_date: string
  review_status: string
}

const initialForm = (): DocForm => ({
  title: '',
  slug: '',
  excerpt: '',
  content_markdown: '',
  tags: [],
  category: '',
  doc_type: '',
  connections: [],
  sources: [],
  doc_date: '',
  review_status: '',
})

const form = reactive<DocForm>(initialForm())
const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const submitting = ref(false)
const dirty = ref(false)
const showPublishDialog = ref(false)
let suppressDirty = true

watch(form, () => {
  if (suppressDirty) return
  dirty.value = true
}, { deep: true })

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

// ---- YAML front matter helpers ----

/**
 * Parse YAML front matter from markdown content (frontend lightweight parser).
 */
function parseYamlFrontMatter(content: string): { attributes: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { attributes: {}, body: content }

  const yamlStr = match[1]
  const body = content.slice(match[0].length)
  const attrs: Record<string, unknown> = {}

  for (const line of yamlStr.split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    let val: unknown = line.slice(colonIdx + 1).trim()

    if (typeof val === 'string' && val.startsWith('[') && val.endsWith(']')) {
      val = val.slice(1, -1).split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    } else if (typeof val === 'string' && (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    } else if (typeof val === 'string' && val.length === 0) {
      continue
    }

    attrs[key] = val
  }

  return { attributes: attrs, body }
}

/**
 * Build YAML front matter string from attributes object.
 */
function buildYamlFrontMatter(attrs: Record<string, unknown>): string {
  const keys = ['title', 'type', 'tags', 'connections', 'sources', 'last_updated', 'status']
  const lines: string[] = []
  for (const k of keys) {
    const v = attrs[k]
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    if (Array.isArray(v)) {
      const items = v.map((i: unknown) => typeof i === 'string' && i.includes(' ') ? `"${i}"` : String(i)).join(', ')
      lines.push(`${k}: [${items}]`)
    } else if (typeof v === 'string' && /[:\-\[\]]/.test(v)) {
      lines.push(`${k}: "${v}"`)
    } else {
      lines.push(`${k}: ${v}`)
    }
  }
  if (lines.length === 0) return ''
  return `---\n${lines.join('\n')}\n---\n`
}

async function loadDocument() {
  if (!editingId.value) return
  loading.value = true
  try {
    const detail = await apiGetKbDocument(editingId.value)
    const rawContent = detail.content_markdown ?? ''
    const { attributes: yaml, body } = parseYamlFrontMatter(rawContent)

    // Populate form fields: YAML attributes take precedence over DB values
    form.title = String(yaml.title ?? detail.title ?? '')
    form.slug = detail.slug
    form.excerpt = detail.excerpt ?? ''
    form.tags = Array.isArray(yaml.tags) ? yaml.tags as string[] : (detail.tags ?? [])
    form.category = yaml.category as string ?? detail.category ?? ''
    form.doc_type = yaml.type as string ?? detail.doc_type ?? ''
    form.connections = Array.isArray(yaml.connections) ? yaml.connections as string[] : (detail.connections ?? [])
    form.sources = Array.isArray(yaml.sources) ? yaml.sources as string[] : (detail.sources ?? [])
    form.doc_date = yaml.last_updated as string ?? detail.doc_date ?? ''
    form.review_status = yaml.status as string ?? detail.review_status ?? ''

    // Editor shows only body (YAML front matter stripped)
    form.content_markdown = body
  } catch (e: unknown) {
    message.error(extractError(e, '加载文档失败'))
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

async function doSave(): Promise<boolean> {
  if (!formRef.value) return false
  try {
    await formRef.value.validate()
  } catch {
    return false
  }
  submitting.value = true
  try {
    // Reconstruct YAML front matter from form fields + body
    const yamlStr = buildYamlFrontMatter({
      title: form.title || undefined,
      type: form.doc_type || undefined,
      tags: form.tags,
      connections: form.connections,
      sources: form.sources,
      last_updated: form.doc_date || undefined,
      status: form.review_status || undefined,
    })
    const fullContent = yamlStr + form.content_markdown

    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      excerpt: form.excerpt || undefined,
      content_markdown: fullContent || undefined,
      tags: form.tags,
      category: form.category || undefined,
      doc_type: form.doc_type || undefined,
      connections: form.connections,
      sources: form.sources,
      doc_date: form.doc_date || undefined,
      review_status: form.review_status || undefined,
    }

    if (isEdit.value && editingId.value !== null) {
      await apiUpdateKbDocument(editingId.value, payload)
    } else {
      const created = await apiCreateKbDocument(payload)
      // Navigate to edit mode so we have the right ID for publishing
      router.replace({ name: 'kb-document-edit', params: { id: String(created.id) } })
    }

    message.success('文档已保存')
    dirty.value = false
    return true
  } catch (e: unknown) {
    message.error(extractError(e, '保存失败'))
    return false
  } finally {
    submitting.value = false
  }
}

async function handleSave() {
  const ok = await doSave()
  if (ok) router.push({ name: 'kb-documents' })
}

async function handleSaveAndPublish() {
  const ok = await doSave()
  if (ok) showPublishDialog.value = true
}

function handleCancel() {
  router.push({ name: 'kb-documents' })
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}

onBeforeRouteLeave((_to, _from, next) => {
  if (!dirty.value) { next(); return }
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
  await loadDocument()
  setTimeout(() => { suppressDirty = false }, 0)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
})

const headerTitle = computed(() => isEdit.value ? '编辑文档' : '新建文档')
const headerSubtitle = computed(() => isEdit.value ? `文档 ID #${editingId.value}` : '创建新知识库文档')
</script>

<template>
  <div>
    <PageHeader :title="headerTitle" :subtitle="headerSubtitle">
      <div class="flex items-center gap-2">
        <NButton @click="handleCancel">取消</NButton>
        <NButton :loading="submitting" @click="handleSave">保存</NButton>
        <NButton v-if="isEdit" v-permission="'kb:publish'" type="primary" :loading="submitting" @click="handleSaveAndPublish">发布到博客</NButton>
      </div>
    </PageHeader>

    <NSpin :show="loading">
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
            <NInput v-model:value="form.title" placeholder="请输入文档标题" />
          </NFormItem>

          <NFormItem label="Slug" path="slug">
            <NInput v-model:value="form.slug" placeholder="可选,留空将由标题自动生成" />
          </NFormItem>

          <NFormItem label="摘要" path="excerpt">
            <NInput
              v-model:value="form.excerpt"
              type="textarea"
              placeholder="可选,文档摘要描述"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>

          <NFormItem label="标签">
            <NSelect
              v-model:value="form.tags"
              multiple
              tag
              filterable
              placeholder="输入标签回车添加"
            />
          </NFormItem>

          <NFormItem label="分类">
            <NInput v-model:value="form.category" placeholder="文档分类（如: notes, concepts）" />
          </NFormItem>

          <NFormItem label="文档类型">
            <NSelect
              v-model:value="form.doc_type"
              clearable
              placeholder="选择类型"
              :options="[
                { label: '实体 (entity)', value: 'entity' },
                { label: '概念 (concept)', value: 'concept' },
                { label: '来源 (source)', value: 'source' },
                { label: '综合 (synthesis)', value: 'synthesis' },
              ]"
            />
          </NFormItem>

          <NFormItem label="关联页面">
            <NSelect
              v-model:value="form.connections"
              multiple
              tag
              filterable
              placeholder="输入关联页面名回车添加"
            />
          </NFormItem>

          <NFormItem label="来源文件">
            <NSelect
              v-model:value="form.sources"
              multiple
              tag
              filterable
              placeholder="输入源文件名回车添加"
            />
          </NFormItem>

          <NFormItem label="文档日期">
            <NInput v-model:value="form.doc_date" placeholder="YYYY-MM-DD" />
          </NFormItem>

          <NFormItem label="成熟度">
            <NSelect
              v-model:value="form.review_status"
              clearable
              placeholder="选择状态"
              :options="[
                { label: '草稿 (seed)', value: 'seed' },
                { label: '完善中 (developing)', value: 'developing' },
                { label: '成熟 (mature)', value: 'mature' },
              ]"
            />
          </NFormItem>

          <NFormItem label="正文" path="content_markdown">
            <MarkdownEditor v-model="form.content_markdown" :height="500" />
          </NFormItem>
        </NForm>
      </div>
    </NSpin>

    <PublishDialog
      v-if="isEdit && editingId"
      :show="showPublishDialog"
      :document-id="editingId"
      :document-title="form.title"
      :document-slug="form.slug"
      :document-excerpt="form.excerpt || null"
      :document-tags="form.tags"
      @update:show="showPublishDialog = $event"
      @published="dirty = false"
    />
  </div>
</template>
