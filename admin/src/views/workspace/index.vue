<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { NSpin, NAlert } from 'naive-ui'
import PageHeader from '../../components/common/PageHeader.vue'

const loading = ref(true)
const error = ref('')
const isFullscreen = ref(false)
const webUIUrl = ref('')

async function loadSettings() {
  try {
    const res = await fetch('/api/v2/admin/settings')
    const data = await res.json()
    if (data.code === 0 && data.data?.open_webui_url) {
      webUIUrl.value = data.data.open_webui_url
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
  }
}

function getWorkbenchUrl() {
  if (webUIUrl.value) {
    return webUIUrl.value
  }
  const base = window.location.origin
  return `${base}/workbench`
}

function handleLoad() {
  loading.value = false
}

function handleError() {
  loading.value = false
  error.value = '工作台加载失败，请刷新页面重试'
}

function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  document.body.style.overflow = isFullscreen.value ? 'hidden' : ''
}

function handleMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return
}

onMounted(() => {
  loadSettings()
  window.addEventListener('message', handleMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
  document.body.style.overflow = ''
})
</script>

<template>
  <div :class="isFullscreen ? 'fixed inset-0 z-50 bg-white' : ''">
    <PageHeader title="工作台" subtitle="AI 对话与知识库">
      <template #actions>
        <button
          class="text-xs px-3 py-1.5 rounded-lg border border-base-content/10 hover:bg-base-200 transition-colors"
          @click="toggleFullscreen"
        >
          {{ isFullscreen ? '退出全屏' : '全屏' }}
        </button>
      </template>
    </PageHeader>

    <div
      class="relative w-full overflow-hidden rounded-xl border border-base-content/5 bg-white"
      :style="isFullscreen ? 'height: calc(100vh - 60px)' : 'height: calc(100vh - 180px)'"
    >
      <div
        v-if="loading"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white"
      >
        <NSpin size="large" description="加载工作台..." />
      </div>

      <NAlert
        v-if="error"
        type="error"
        class="absolute left-4 right-4 top-4 z-10"
      >
        {{ error }}
      </NAlert>

      <iframe
        :src="getWorkbenchUrl()"
        class="h-full w-full border-0"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
        @load="handleLoad"
        @error="handleError"
      />
    </div>
  </div>
</template>
