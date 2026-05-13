<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NInput, NButton, NCard, NForm, NFormItem, NSpace, NAlert } from 'naive-ui'
import PageHeader from '../../components/common/PageHeader.vue'

const openWebUIUrl = ref('')
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error'>('success')

async function loadSettings() {
  loading.value = true
  try {
    const res = await fetch('/api/v2/admin/settings')
    const data = await res.json()
    if (data.code === 0) {
      openWebUIUrl.value = data.data?.open_webui_url || ''
    }
  } catch (err) {
    console.error('Failed to load settings:', err)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  message.value = ''
  try {
    const res = await fetch('/api/v2/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ open_webui_url: openWebUIUrl.value }),
    })
    const data = await res.json()
    if (data.code === 0) {
      message.value = '设置已保存'
      messageType.value = 'success'
    } else {
      message.value = data.message || '保存失败'
      messageType.value = 'error'
    }
  } catch (err) {
    message.value = '保存失败: ' + (err as Error).message
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}

function testConnection() {
  const url = openWebUIUrl.value.trim()
  if (!url) {
    message.value = '请先输入 Open WebUI 地址'
    messageType.value = 'error'
    return
  }
  window.open(url, '_blank')
}

onMounted(() => {
  loadSettings()
})
</script>

<template>
  <div>
    <PageHeader title="系统设置" subtitle="配置外部服务连接" />

    <NCard class="max-w-2xl">
      <NAlert v-if="message" :type="messageType" class="mb-4">
        {{ message }}
      </NAlert>

      <NForm label-placement="left" label-width="160px">
        <NFormItem label="Open WebUI 地址">
          <NInput
            v-model:value="openWebUIUrl"
            placeholder="http://192.168.3.100:8080"
            :loading="loading"
          />
        </NFormItem>

        <NFormItem>
          <template #label>
            <span class="text-gray-500">说明</span>
          </template>
          <div class="text-sm text-gray-500">
            <p>设置外部 Open WebUI 服务的地址，用于在工作台中嵌入 AI 对话界面。</p>
            <p class="mt-1">留空则使用默认地址（http://127.0.0.1:8080）。</p>
          </div>
        </NFormItem>

        <NSpace>
          <NButton type="primary" :loading="saving" @click="saveSettings">
            保存设置
          </NButton>
          <NButton @click="testConnection">
            测试连接
          </NButton>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>
