<script setup lang="ts">
// 友链管理页 — T2.30
// 设计文档:docs/10-phase2-cms-frontend-plan.md §4
//
// 偏离设计文档之处:
// (P1) DataTable 用 :fetch + #search slot,而非设计文档假设的 :query v-bind
// (P3) 路由用 /cms/links(带 cms 前缀),与 menus seed 对齐
// (P8) apiGetLinks 返回 { items, total },前端包一层转 { list, total }
// (P10) issue #60 验收里写的"拖拽排序"沿用设计文档 §4 简化方案:用 sortOrder 数字字段排序,
//       拖拽 UI 留待 §5.2 优化(后端 reorderLinks 接口已就绪,前端先不接)

import { computed, h, reactive, ref, type VNode } from 'vue'
import axios from 'axios'
import {
  NButton,
  NImage,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NPopconfirm,
  NForm,
  NFormItem,
  NModal,
  useMessage,
  type DataTableColumns,
  type FormInst,
  type FormRules,
} from 'naive-ui'
import PageHeader from '../../../components/common/PageHeader.vue'
import DataTable from '../../../components/common/DataTable.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetLinks,
  apiCreateLink,
  apiUpdateLink,
  apiDeleteLink,
  type LinkItem,
  type LinkIconSize,
} from '../../../api/cms'
import { usePermissionStore } from '../../../stores/permission'
import { formatDateTime } from '../../../utils/format'

const message = useMessage()
const permissionStore = usePermissionStore()

const fetchLinks = async () => {
  const res = await apiGetLinks()
  return { list: res.items, total: res.total }
}

const tableRef = ref<{
  refresh: () => Promise<void>
  reset: () => void
  clearSelection: () => void
} | null>(null)

function refreshTable() {
  tableRef.value?.refresh()
}

const drawerVisible = ref(false)
const isEdit = ref(false)
const editingId = ref<number | null>(null)
const submitting = ref(false)
const formRef = ref<FormInst | null>(null)

interface LinkForm {
  title: string
  url: string
  icon: string
  iconSize: LinkIconSize
  sortOrder: number
}

const ICON_SIZE_OPTIONS: Array<{ label: string; value: LinkIconSize }> = [
  { label: '1×1(普通)', value: '1x1' },
  { label: '2×1(横长)', value: '2x1' },
  { label: '1×2(纵长)', value: '1x2' },
  { label: '2×2(双倍)', value: '2x2' },
]

const form = reactive<LinkForm>({
  title: '',
  url: '',
  icon: '',
  iconSize: '1x1',
  sortOrder: 0,
})

// 与后端 safeUrl 对齐:允许 / 起首相对路径或 http(s):// 绝对地址,icon 额外允许 data:image/...
function isValidUrl(value: string, allowDataImage = false): boolean {
  if (!value) return true
  if (value.startsWith('/')) return true
  if (/^https?:\/\//i.test(value)) return true
  if (allowDataImage && /^data:image\/(png|jpeg|jpg|gif|webp);/i.test(value)) return true
  return false
}

// ========== Icon Picker ==========
const DASHBOARD_ICONS_BASE = 'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main'

const dashboardPresets = [
  'github-dark', 'github-light', 'google-drive', 'nextcloud', 'plex',
  'proxmox', 'qbittorrent', 'syncthing', 'tailscale', 'unraid',
  'vscode', 'portainer', 'docker', 'home-assistant',
]

function resolveDashboardIconUrl(name: string): string {
  const n = String(name || '').trim().toLowerCase()
  // 优先 svg，其次 png
  return `${DASHBOARD_ICONS_BASE}/svg/${encodeURIComponent(n)}.svg`
}

const iconPickerVisible = ref(false)
const iconSearch = ref('')
const iconSearchLoading = ref(false)
const iconGridItems = ref<Array<{ name: string; url: string }>>([])
const selectedIconUrl = ref('')

let iconSearchTimer: ReturnType<typeof setTimeout> | null = null

function runIconSearch(keyword: string) {
  const kw = String(keyword || '').trim().toLowerCase()
  iconSearchLoading.value = true

  let candidates: string[]
  if (!kw) {
    candidates = [...dashboardPresets]
  } else {
    candidates = dashboardPresets.filter((n) => n.includes(kw)).slice(0, 32)
    if (!candidates.includes(kw) && /^[a-z0-9-]{2,64}$/.test(kw)) {
      candidates.unshift(kw)
    }
  }

  iconGridItems.value = candidates.map((name) => ({
    name,
    url: resolveDashboardIconUrl(name),
  }))
  iconSearchLoading.value = false
}

function onIconSearchInput(val: string) {
  if (iconSearchTimer) clearTimeout(iconSearchTimer)
  iconSearchTimer = setTimeout(() => runIconSearch(val), 250)
}

function openIconPicker() {
  iconPickerVisible.value = true
  iconSearch.value = ''
  selectedIconUrl.value = ''
  runIconSearch('')
}

function selectIconItem(url: string) {
  selectedIconUrl.value = url
}

function confirmIcon() {
  if (!selectedIconUrl.value) {
    message.warning('请选择一个图标')
    return
  }
  form.icon = selectedIconUrl.value
  iconPickerVisible.value = false
}

function useFavicon() {
  try {
    const u = new URL(form.url)
    form.icon = `${u.origin}/favicon.ico`
    iconPickerVisible.value = false
  } catch {
    message.warning('请先填写正确的网址')
  }
}

function clearIcon() {
  form.icon = ''
  selectedIconUrl.value = ''
}

const formRules = computed<FormRules>(() => ({
  title: [
    { required: true, message: '请输入友链标题', trigger: 'blur' },
    { max: 50, message: '标题不能超过 50 字', trigger: 'blur' },
  ],
  url: [
    { required: true, message: '请输入友链地址', trigger: 'blur' },
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string) => {
        if (!value) return true
        if (!isValidUrl(value)) {
          return new Error('URL 须以 / 起首或为 http(s):// 绝对地址')
        }
        return true
      },
    },
  ],
  icon: [
    {
      trigger: 'blur',
      validator: (_rule: unknown, value: string) => {
        if (!value) return true
        if (!isValidUrl(value, true)) {
          return new Error('图标须为 / 起首相对路径、http(s) URL,或 data:image/...')
        }
        return true
      },
    },
  ],
}))

function openCreate() {
  isEdit.value = false
  editingId.value = null
  Object.assign(form, {
    title: '',
    url: '',
    icon: '',
    iconSize: '1x1',
    sortOrder: 0,
  })
  drawerVisible.value = true
}

function openEdit(row: LinkItem) {
  isEdit.value = true
  editingId.value = row.id
  Object.assign(form, {
    title: row.title,
    url: row.url,
    icon: row.icon,
    iconSize: row.iconSize,
    sortOrder: row.sortOrder,
  })
  drawerVisible.value = true
}

function extractLinkError(e: unknown, fallback: string): string {
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as { message?: string } | undefined
    if (data?.message === 'invalid_url') return 'URL 格式不合法'
    if (data?.message === 'invalid_icon') return '图标格式不合法'
    if (data?.message) return data.message
  }
  if (e instanceof Error) return e.message
  return fallback
}

async function handleSubmit() {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
  } catch {
    return
  }
  submitting.value = true
  try {
    const payload = {
      title: form.title,
      url: form.url,
      icon: form.icon || undefined,
      iconSize: form.iconSize,
      sortOrder: form.sortOrder,
    }
    if (isEdit.value && editingId.value !== null) {
      await apiUpdateLink(editingId.value, payload)
      message.success('友链已更新')
    } else {
      await apiCreateLink(payload)
      message.success('友链已创建')
    }
    drawerVisible.value = false
    refreshTable()
  } catch (e: unknown) {
    message.error(extractLinkError(e, '保存失败'))
  } finally {
    submitting.value = false
  }
}

async function handleDelete(row: LinkItem) {
  try {
    await apiDeleteLink(row.id)
    message.success('已删除')
    refreshTable()
  } catch (e: unknown) {
    message.error(extractLinkError(e, '删除失败'))
  }
}

const columns: DataTableColumns<LinkItem> = [
  { title: 'ID', key: 'id', width: 70 },
  {
    title: '图标',
    key: 'icon',
    width: 64,
    render(row: LinkItem) {
      if (!row.icon) return h('span', { style: 'color: #999' }, '—')
      return h(NImage, {
        src: row.icon,
        width: 32,
        height: 32,
        objectFit: 'contain',
        previewDisabled: true,
        fallbackSrc:
          'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="%23eee"/></svg>',
      })
    },
  },
  { title: '标题', key: 'title', width: 160 },
  {
    title: 'URL',
    key: 'url',
    ellipsis: { tooltip: true },
    render(row: LinkItem) {
      return h(
        'a',
        { href: row.url, target: '_blank', rel: 'noopener', style: 'color: #2080f0' },
        row.url,
      )
    },
  },
  { title: '尺寸', key: 'iconSize', width: 80 },
  { title: '排序', key: 'sortOrder', width: 80 },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 180,
    render(row: LinkItem) {
      return formatDateTime(row.updatedAt)
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render(row: LinkItem) {
      const buttons: VNode[] = []
      const canUpdate = permissionStore.hasPermission('link:update')
      const canDelete = permissionStore.hasPermission('link:delete')
      if (canUpdate) {
        buttons.push(
          h(
            NButton,
            { size: 'small', onClick: () => openEdit(row) },
            { default: () => '编辑' },
          ),
        )
      }
      if (canDelete) {
        buttons.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              trigger: () =>
                h(
                  NButton,
                  { size: 'small', type: 'error' },
                  { default: () => '删除' },
                ),
              default: () => '确认删除该友链?',
            },
          ),
        )
      }
      if (buttons.length === 0) return h('span', { style: 'color: #999' }, '—')
      return h(NSpace, { size: 4 }, { default: () => buttons })
    },
  },
]
</script>

<template>
  <div>
    <PageHeader title="友链管理" subtitle="维护博客友情链接(按 sortOrder 升序展示)">
      <NButton
        v-permission="'link:create'"
        type="primary"
        @click="openCreate"
      >
        新建友链
      </NButton>
    </PageHeader>

    <DataTable
      ref="tableRef"
      :columns="columns"
      :fetch="fetchLinks"
      :row-key="(row: LinkItem) => row.id"
    />

    <FormDrawer
      v-model:show="drawerVisible"
      :title="isEdit ? '编辑友链' : '新建友链'"
      :loading="submitting"
      :width="560"
      @submit="handleSubmit"
    >
      <NForm
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-placement="left"
        label-width="80"
        require-mark-placement="right-hanging"
      >
        <NFormItem label="标题" path="title">
          <NInput v-model:value="form.title" placeholder="如 张三的博客" />
        </NFormItem>
        <NFormItem label="URL" path="url">
          <NInput v-model:value="form.url" placeholder="https://example.com" />
        </NFormItem>
        <NFormItem label="图标" path="icon">
          <NSpace vertical style="width: 100%">
            <NSpace>
              <NInput
                v-model:value="form.icon"
                placeholder="可选,支持 / 起首相对路径、http(s) URL 或 data:image/..."
                style="width: 340px"
              />
              <NButton type="primary" ghost @click="openIconPicker">
                选择图标
              </NButton>
              <NButton v-if="form.icon" type="error" ghost @click="clearIcon">
                清空
              </NButton>
            </NSpace>
            <div v-if="form.icon" style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; color: #666">预览:</span>
              <NImage
                :src="form.icon"
                width="32"
                height="32"
                object-fit="contain"
                preview-disabled
                :fallback-src="`data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='%23eee'/></svg>`"
              />
            </div>
          </NSpace>
        </NFormItem>
        <NFormItem label="尺寸" path="iconSize">
          <NSelect
            v-model:value="form.iconSize"
            :options="ICON_SIZE_OPTIONS"
            style="max-width: 200px"
          />
        </NFormItem>
        <NFormItem label="排序" path="sortOrder">
          <NInputNumber
            v-model:value="form.sortOrder"
            :min="0"
            :max="9999"
            placeholder="数值越小越靠前"
            style="max-width: 200px"
          />
        </NFormItem>
      </NForm>
    </FormDrawer>

    <!-- Icon Picker Modal -->
    <NModal
      v-model:show="iconPickerVisible"
      title="选择图标"
      preset="card"
      style="width: 560px; max-width: 90vw"
      :bordered="false"
      segmented
    >
      <NSpace vertical size="medium">
        <NInput
          v-model:value="iconSearch"
          placeholder="搜索图标（例如 plex / nextcloud / github-light）"
          clearable
          @input="onIconSearchInput"
          @keydown.enter="runIconSearch(iconSearch)"
        />
        <NSpace>
          <NButton type="primary" ghost @click="useFavicon">
            用当前网址 favicon
          </NButton>
          <NButton ghost @click="clearIcon">
            清空选择
          </NButton>
        </NSpace>

        <div
          v-if="iconSearchLoading"
          style="text-align: center; padding: 24px; color: #999"
        >
          搜索中...
        </div>
        <div
          v-else-if="iconGridItems.length === 0"
          style="text-align: center; padding: 24px; color: #999"
        >
          未找到图标。请确认图标名（kebab-case），或用 favicon。
        </div>
        <div
          v-else
          style="
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
            gap: 8px;
            max-height: 320px;
            overflow-y: auto;
            padding: 4px;
          "
        >
          <div
            v-for="item in iconGridItems"
            :key="item.name"
            :style="{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              borderRadius: '6px',
              cursor: 'pointer',
              border: selectedIconUrl === item.url
                ? '2px solid #2080f0'
                : '2px solid transparent',
              background: selectedIconUrl === item.url
                ? '#f0f7ff'
                : 'transparent',
              transition: 'all 0.2s',
            }"
            :title="item.name"
            @click="selectIconItem(item.url)"
          >
            <img
              :src="item.url"
              :alt="item.name"
              width="32"
              height="32"
              style="object-fit: contain"
              loading="lazy"
            />
          </div>
        </div>

        <NSpace justify="end">
          <NButton @click="iconPickerVisible = false">取消</NButton>
          <NButton type="primary" @click="confirmIcon">确认</NButton>
        </NSpace>
      </NSpace>
    </NModal>
  </div>
</template>
