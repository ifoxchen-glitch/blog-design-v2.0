<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NInput, NButton, NCard, NForm, NFormItem, NSpace, NAlert } from 'naive-ui'
import PageHeader from '../../components/common/PageHeader.vue'

const openWebUIUrl = ref('')
const openWebUIApiKey = ref('')
const iotApiBaseUrl = ref('')
const iotAppId = ref('')
const iotAppSecret = ref('')
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
      openWebUIApiKey.value = data.data?.open_webui_api_key || ''
      iotApiBaseUrl.value = data.data?.iot_api_base_url || ''
      iotAppId.value = data.data?.iot_app_id || ''
      iotAppSecret.value = data.data?.iot_app_secret || ''
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
      body: JSON.stringify({
        open_webui_url: openWebUIUrl.value,
        open_webui_api_key: openWebUIApiKey.value,
        iot_api_base_url: iotApiBaseUrl.value,
        iot_app_id: iotAppId.value,
        iot_app_secret: iotAppSecret.value,
      }),
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
    <PageHeader title="系统设置" />

    <NCard class="max-w-2xl mb-4">
      <NAlert v-if="message" :type="messageType" class="mb-4">
        {{ message }}
      </NAlert>

      <NForm label-placement="left" label-width="160px">
        <div class="text-sm font-medium mb-2 text-gray-500">Open WebUI</div>
        <NFormItem label="Open WebUI 地址">
          <NInput
            v-model:value="openWebUIUrl"
            placeholder="http://192.168.3.100:8080"
            :loading="loading"
          />
        </NFormItem>

        <NFormItem label="Open WebUI API Key">
          <NInput
            v-model:value="openWebUIApiKey"
            placeholder="JWT Token 或 API Key（用于知识库同步）"
            type="password"
            show-password-on="click"
            :loading="loading"
          />
          <template #feedback>
            <div class="text-xs text-gray-400 mt-1">
              在 Open WebUI 页面按 F12 → Console → 输入 <code class="bg-gray-100 px-1 rounded">localStorage.getItem('token')</code> 获取 JWT Token
            </div>
          </template>
        </NFormItem>

        <NFormItem>
          <template #label>
            <span class="text-gray-500">说明</span>
          </template>
          <div class="text-sm text-gray-500">
            <p>设置外部 Open WebUI 服务的地址和认证信息，用于在工作台中嵌入 AI 对话界面，以及同步知识库到 Open WebUI。</p>
            <p class="mt-1">API Key 用于知识库同步功能，确保文档创建/更新时自动同步到 Open WebUI。</p>
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

    <NCard class="max-w-2xl">
      <NForm label-placement="left" label-width="160px">
        <div class="text-sm font-medium mb-2 text-gray-500">物联网卡平台</div>
        <NFormItem label="API 地址">
          <NInput
            v-model:value="iotApiBaseUrl"
            placeholder="http://220.154.130.214:9000"
            :loading="loading"
          />
        </NFormItem>

        <NFormItem label="App ID">
          <NInput
            v-model:value="iotAppId"
            placeholder="19位数字"
            :loading="loading"
          />
        </NFormItem>

        <NFormItem label="App Secret">
          <NInput
            v-model:value="iotAppSecret"
            placeholder="应用密钥"
            type="password"
            show-password-on="click"
            :loading="loading"
          />
        </NFormItem>

        <NFormItem>
          <template #label>
            <span class="text-gray-500">说明</span>
          </template>
          <div class="text-sm text-gray-400">
            物联网卡平台接口凭证，用于同步卡片数据、查询余额、启用/禁用卡片等操作。
          </div>
        </NFormItem>

        <NSpace>
          <NButton type="primary" :loading="saving" @click="saveSettings">
            保存设置
          </NButton>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>