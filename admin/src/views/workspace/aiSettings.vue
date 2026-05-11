<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { NButton, NDataTable, NTag, NModal, NForm, NFormItem, NInput, NSelect, NInputNumber, NSwitch, NPopconfirm, useMessage } from 'naive-ui'
import { AddOutline, PencilOutline, TrashOutline, CheckmarkCircleOutline, AlertCircleOutline } from '@vicons/ionicons5'
import PageHeader from '../../components/common/PageHeader.vue'
import { apiListAiModels, apiCreateAiModel, apiUpdateAiModel, apiDeleteAiModel, apiTestAiModel, type AiModel, type CreateAiModelPayload } from '../../api/kb'

const message = useMessage()
const models = ref<AiModel[]>([])
const loading = ref(false)
const testingId = ref<number | null>(null)
const testResults = ref<Record<string, { ok: boolean; response?: string; error?: string }>>({})

// Edit modal
const showEdit = ref(false)
const editingId = ref<number | null>(null)
const formData = ref<CreateAiModelPayload>({
  name: '',
  provider: 'openai',
  api_endpoint: 'https://api.openai.com/v1',
  api_key: '',
  model_name: '',
  max_tokens: 4096,
  temperature: 0.7,
  is_default: false,
  is_active: true,
  sort_order: 0,
})
const formLoading = ref(false)

const providerOptions = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Ollama', value: 'ollama' },
  { label: 'Groq', value: 'groq' },
  { label: 'Custom (OpenAI Compatible)', value: 'custom' },
]

const columns = [
  {
    title: '名称',
    key: 'name',
    width: 140,
    render(row: AiModel) {
      return h('div', { class: 'flex items-center gap-1' }, [
        h('span', { class: row.is_default ? 'font-medium' : '' }, row.name),
        row.is_default ? h(NTag, { size: 'tiny', type: 'success', bordered: false }, { default: () => '默认' }) : null,
        !row.is_active ? h(NTag, { size: 'tiny', type: 'default', bordered: false }, { default: () => '已禁用' }) : null,
      ])
    },
  },
  {
    title: 'Provider',
    key: 'provider',
    width: 120,
    render(row: AiModel) {
      const map: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', ollama: 'Ollama', groq: 'Groq', custom: 'Custom' }
      return map[row.provider] || row.provider
    },
  },
  {
    title: '模型名',
    key: 'model_name',
    width: 200,
    render(row: AiModel) {
      return h('code', { class: 'text-xs text-base-content/60' }, row.model_name)
    },
  },
  {
    title: 'API 端点',
    key: 'api_endpoint',
    render(row: AiModel) {
      return h('code', { class: 'text-xs text-base-content/50 truncate' }, row.api_endpoint)
    },
  },
  {
    title: 'API Key',
    key: 'api_key',
    width: 160,
    render(row: AiModel) {
      return row.has_api_key ? row.api_key : h(NTag, { size: 'tiny', type: 'warning', bordered: false }, { default: () => '未配置' })
    },
  },
  {
    title: 'Temperature',
    key: 'temperature',
    width: 100,
    render(row: AiModel) { return row.temperature.toFixed(1) },
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    render(row: AiModel) {
      return h('div', { class: 'flex items-center gap-1' }, [
        h(NButton, { size: 'tiny', quaternary: true, onClick: () => openEdit(row) }, { icon: () => h(PencilOutline, { class: 'w-3.5 h-3.5' }) }),
        h(NButton, {
          size: 'tiny', quaternary: true, loading: testingId.value === row.id,
          onClick: () => handleTest(row.id),
        }, { default: () => '测试' }),
        h(NPopconfirm, {
          onNegativeClick: () => handleDelete(row.id),
        }, {
          trigger: () => h(NButton, { size: 'tiny', quaternary: true, class: 'text-red-400' }, { icon: () => h(TrashOutline, { class: 'w-3.5 h-3.5' }) }),
          default: () => '确认删除此模型配置？',
        }),
      ])
    },
  },
]

import { h } from 'vue'

async function loadModels() {
  loading.value = true
  try {
    models.value = await apiListAiModels()
  } catch {
    message.error('加载模型列表失败')
  } finally {
    loading.value = false
  }
}

function openEdit(row?: AiModel) {
  if (row) {
    editingId.value = row.id
    formData.value = {
      name: row.name,
      provider: row.provider,
      api_endpoint: row.api_endpoint,
      api_key: row.api_key, // masked value
      model_name: row.model_name,
      max_tokens: row.max_tokens,
      temperature: row.temperature,
      is_default: row.is_default,
      is_active: row.is_active,
      sort_order: row.sort_order,
    }
  } else {
    editingId.value = null
    formData.value = {
      name: '',
      provider: 'openai',
      api_endpoint: 'https://api.openai.com/v1',
      api_key: '',
      model_name: '',
      max_tokens: 4096,
      temperature: 0.7,
      is_default: false,
      is_active: true,
      sort_order: models.value.length,
    }
  }
  showEdit.value = true
}

async function handleSave() {
  if (!formData.value.name || !formData.value.model_name) {
    message.warning('请填写名称和模型名')
    return
  }
  formLoading.value = true
  try {
    if (editingId.value) {
      await apiUpdateAiModel(editingId.value, formData.value)
      message.success('已更新')
    } else {
      await apiCreateAiModel(formData.value)
      message.success('已创建')
    }
    showEdit.value = false
    await loadModels()
  } catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败')
  } finally {
    formLoading.value = false
  }
}

async function handleDelete(id: number) {
  try {
    await apiDeleteAiModel(id)
    message.success('已删除')
    await loadModels()
  } catch {
    message.error('删除失败')
  }
}

async function handleTest(id: number) {
  testingId.value = id
  try {
    const result = await apiTestAiModel(id)
    testResults.value[id] = result
    if (result.ok) message.success('连接成功')
    else message.warning('连接失败: ' + (result.error || '未知错误'))
  } catch {
    message.error('测试失败')
  } finally {
    testingId.value = null
  }
}

onMounted(loadModels)
</script>

<template>
  <div>
    <PageHeader title="AI 模型配置" subtitle="管理 AI 模型 API 连接" />
    <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 md:p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-base-content/50">配置用于 AI 对话的模型。支持 OpenAI / Anthropic / Ollama / Groq 等 Provider。</p>
        <NButton size="small" type="primary" @click="openEdit()">
          <AddOutline class="w-4 h-4 mr-1" /> 添加模型
        </NButton>
      </div>

      <!-- Test result toasts -->
      <div v-if="Object.keys(testResults).length" class="mb-3 space-y-1">
        <template v-for="(result, id) in testResults" :key="id">
          <div v-if="result" class="flex items-start gap-2 text-xs p-2 rounded"
            :class="result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'">
            <component :is="result.ok ? CheckmarkCircleOutline : AlertCircleOutline" class="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span class="font-medium">{{ models.find(m => m.id === Number(id))?.name }}</span>
              <span v-if="result.response">: {{ result.response }}</span>
              <span v-if="result.error">: {{ result.error }}</span>
            </div>
          </div>
        </template>
      </div>

      <!-- Table -->
      <NDataTable
        :columns="columns"
        :data="models"
        :loading="loading"
        :bordered="false"
        :single-line="false"
        class="text-sm"
      />
    </div>

    <!-- Edit Modal -->
    <NModal v-model:show="showEdit" preset="card" :title="editingId ? '编辑模型' : '添加模型'" style="width:520px">
      <NForm :model="formData" label-placement="top">
        <NFormItem label="名称">
          <NInput v-model:value="formData.name" placeholder="例如: GPT-4o" />
        </NFormItem>
        <NFormItem label="Provider">
          <NSelect v-model:value="formData.provider" :options="providerOptions" />
        </NFormItem>
        <NFormItem label="API 端点">
          <NInput v-model:value="formData.api_endpoint" placeholder="https://api.openai.com/v1" />
        </NFormItem>
        <NFormItem label="API Key">
          <NInput v-model:value="formData.api_key" type="password" placeholder="sk-..." show-password-on="click" />
        </NFormItem>
        <NFormItem label="模型名">
          <NInput v-model:value="formData.model_name" placeholder="gpt-4o / claude-3-opus-20240229" />
        </NFormItem>
        <div class="grid grid-cols-2 gap-4">
          <NFormItem label="Max Tokens">
            <NInputNumber v-model:value="formData.max_tokens" :min="100" :max="200000" />
          </NFormItem>
          <NFormItem label="Temperature">
            <NInputNumber v-model:value="formData.temperature" :min="0" :max="2" :step="0.1" />
          </NFormItem>
        </div>
        <div class="flex items-center gap-6">
          <div class="flex items-center gap-2">
            <NSwitch v-model:value="formData.is_default" /> <span class="text-sm">设为默认模型</span>
          </div>
          <div class="flex items-center gap-2">
            <NSwitch v-model:value="formData.is_active" /> <span class="text-sm">启用</span>
          </div>
        </div>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showEdit = false">取消</NButton>
          <NButton type="primary" :loading="formLoading" @click="handleSave">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
