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
  // 如果配置了外部地址，直接使用
  if (webUIUrl.value) {
    return webUIUrl.value
  }
  // 否则使用当前 host 的代理
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
  if (isFullscreen.value) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
}

// 监听来自 iframe 的消息（如需要与 Open WebUI 通信）
function handleMessage(event: MessageEvent) {
  // 仅接受来自同源的消�
  if (event.origin !== window.location.origin) return
  // 可扩展：处理 Open WebUI 发来的消息
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

    <div class="relative w-full bg-white rounded-xl border border-base-content/5 overflow-hidden"
      :style="isFullscreen ? 'height: calc(100vh - 60px)' : 'height: calc(100vh - 180px)'"
    >
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-white z-10">
        <NSpin size="large" description="加载工作台..." />
      </div>

      <NAlert v-if="error" type="error" class="absolute top-4 left-4 right-4 z-10">
        {{ error }}
      </NAlert>

      <iframe
        :src="getWorkbenchUrl()"
        class="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads"
        @load="handleLoad"
        @error="handleError"
      />
    </div>
  </div>
</template>
