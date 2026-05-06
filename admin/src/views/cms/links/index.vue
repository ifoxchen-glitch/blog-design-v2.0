<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
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
  type FormInst,
  type FormRules,
} from 'naive-ui'
import {
  CreateOutline,
  TrashOutline,
  GridOutline,
  AddOutline,
  LinkOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../../components/common/PageHeader.vue'
import FormDrawer from '../../../components/common/FormDrawer.vue'
import {
  apiGetLinks,
  apiCreateLink,
  apiUpdateLink,
  apiDeleteLink,
  apiReorderLinks,
  type LinkItem,
  type LinkIconSize,
} from '../../../api/cms'
import { usePermissionStore } from '../../../stores/permission'

const message = useMessage()
const permissionStore = usePermissionStore()

const links = ref<LinkItem[]>([])
const loading = ref(false)

async function loadLinks() {
  loading.value = true
  try {
    const res = await apiGetLinks()
    links.value = [...res.items]
  } catch (e: unknown) {
    message.error(extractLinkError(e, '加载友链失败'))
  } finally {
    loading.value = false
  }
}

loadLinks()

// ---- 新建 / 编辑抽屉 ----
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
    loadLinks()
  } catch (e: unknown) {
    message.error(extractLinkError(e, '保存失败'))
  } finally {
    submitting.value = false
  }
}

// ========== Drag Sort ==========
const sortModalVisible = ref(false)
const sortList = ref<LinkItem[]>([])
const dragSrcIndex = ref<number | null>(null)

async function openSort() {
  try {
    const res = await apiGetLinks()
    sortList.value = [...res.items]
    sortModalVisible.value = true
  } catch (e: unknown) {
    message.error(extractLinkError(e, '加载友链失败'))
  }
}

function onDragStart(idx: number) {
  dragSrcIndex.value = idx
}

function onDragOver(e: DragEvent, _idx: number) {
  e.preventDefault()
}

function onDrop(e: DragEvent, targetIdx: number) {
  e.preventDefault()
  const src = dragSrcIndex.value
  if (src === null || src === targetIdx) return
  const item = sortList.value.splice(src, 1)[0]
  sortList.value.splice(targetIdx, 0, item)
  dragSrcIndex.value = null
}

async function saveSort() {
  try {
    const items = sortList.value.map((item, idx) => ({ id: item.id, sortOrder: idx }))
    await apiReorderLinks(items)
    message.success('排序已保存')
    sortModalVisible.value = false
    loadLinks()
  } catch (e: unknown) {
    message.error(extractLinkError(e, '保存排序失败'))
  }
}

async function handleDelete(row: LinkItem) {
  try {
    await apiDeleteLink(row.id)
    message.success('已删除')
    loadLinks()
  } catch (e: unknown) {
    message.error(extractLinkError(e, '删除失败'))
  }
}
</script>

<template>
  <div>
    <PageHeader title="友链管理" subtitle="维护博客友情链接">
      <NSpace>
        <NButton v-permission="'link:update'" @click="openSort">
          <GridOutline class="w-4 h-4 mr-1" />
          拖拽排序
        </NButton>
        <NButton v-permission="'link:create'" type="primary" @click="openCreate">
          <template #icon>
            <AddOutline class="w-4 h-4" />
          </template>
          新建友链
        </NButton>
      </NSpace>
    </PageHeader>

    <!-- 卡片网格 -->
    <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3">
      <div
        v-for="row in links"
        :key="row.id"
        class="group bg-base-100 rounded-xl border border-base-content/5 overflow-hidden hover:border-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
      >
        <!-- 图标区域 -->
        <div class="relative bg-base-200/50 flex items-center justify-center p-3 aspect-square">
          <img
            v-if="row.icon"
            :src="row.icon"
            class="max-w-full max-h-full object-contain"
            loading="lazy"
          />
          <LinkOutline v-else class="w-8 h-8 text-base-content/10" />
        </div>

        <!-- 内容 -->
        <div class="p-2.5">
          <div class="font-medium text-xs text-base-content truncate">{{ row.title }}</div>
          <a
            :href="row.url"
            target="_blank"
            rel="noopener"
            class="text-[10px] text-base-content/30 truncate block hover:text-primary transition-colors mt-0.5"
          >
            {{ row.url }}
          </a>

          <div class="flex items-center justify-between mt-2">
            <span class="text-[10px] text-base-content/20 px-1.5 py-0.5 rounded bg-base-content/5">
              {{ row.iconSize }}
            </span>
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <NButton
                v-if="permissionStore.hasPermission('link:update')"
                size="tiny"
                quaternary
                @click="openEdit(row)"
              >
                <CreateOutline class="w-3 h-3" />
              </NButton>
              <NPopconfirm
                v-if="permissionStore.hasPermission('link:delete')"
                @positive-click="handleDelete(row)"
              >
                <template #trigger>
                  <NButton size="tiny" quaternary type="error">
                    <TrashOutline class="w-3 h-3" />
                  </NButton>
                </template>
                确认删除该友链?
              </NPopconfirm>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="links.length === 0 && !loading" class="py-16">
      <NEmpty description="暂无友链">
        <template #extra>
          <p class="text-sm text-base-content/40 mt-2">点击右上角"新建友链"添加</p>
        </template>
      </NEmpty>
    </div>

    <!-- FormDrawer -->
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
            <div v-if="form.icon" class="flex items-center gap-2">
              <span class="text-xs text-base-content/60">预览:</span>
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

    <!-- Sort Modal -->
    <NModal
      v-model:show="sortModalVisible"
      title="拖拽排序"
      preset="card"
      style="width: 480px; max-width: 90vw"
      :bordered="false"
      segmented
    >
      <NSpace vertical size="medium">
        <div
          class="max-h-[400px] overflow-y-auto rounded-md p-1 border border-base-content/10"
        >
          <div
            v-for="(item, idx) in sortList"
            :key="item.id"
            draggable="true"
            class="flex items-center gap-2.5 px-3 py-2 rounded cursor-move hover:bg-base-content/5 transition-colors"
            @dragstart="onDragStart(idx)"
            @dragover="onDragOver($event, idx)"
            @drop="onDrop($event, idx)"
          >
            <span class="text-base-content/40 text-sm select-none">☰</span>
            <img
              v-if="item.icon"
              :src="item.icon"
              width="24"
              height="24"
              style="object-fit: contain; flex-shrink: 0"
              loading="lazy"
            />
            <span v-else class="w-6 flex-shrink-0"></span>
            <span class="text-sm">{{ item.title }}</span>
          </div>
        </div>

        <NSpace justify="end">
          <NButton @click="sortModalVisible = false">取消</NButton>
          <NButton type="primary" @click="saveSort">保存</NButton>
        </NSpace>
      </NSpace>
    </NModal>

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
          class="text-center py-6 text-base-content/40"
        >
          搜索中...
        </div>
        <div
          v-else-if="iconGridItems.length === 0"
          class="text-center py-6 text-base-content/40"
        >
          未找到图标。请确认图标名（kebab-case），或用 favicon。
        </div>
        <div
          v-else
          class="grid gap-2 max-h-[320px] overflow-y-auto p-1"
          style="grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));"
        >
          <div
            v-for="item in iconGridItems"
            :key="item.name"
            class="flex items-center justify-center p-1.5 rounded-md cursor-pointer transition-all"
            :class="selectedIconUrl === item.url ? 'border-2 border-primary bg-primary/10' : 'border-2 border-transparent'"
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
