<script setup lang="ts">
import { ref, h } from 'vue'
import { NButton, NDataTable, NModal, NForm, NFormItem, NInput, NPopconfirm, useMessage } from 'naive-ui'
import { AddOutline, TrashOutline, EyeOutline, EyeOffOutline } from '@vicons/ionicons5'
import PageHeader from '../../components/common/PageHeader.vue'

const message = useMessage()

interface ApiKeyEntry {
  id: string
  name: string
  description: string
  key_preview: string
  key_full: string
  service: string
  created_at: string
}

const entries = ref<ApiKeyEntry[]>([])
const showAdd = ref(false)
const newEntry = ref({ name: '', description: '', service: '', api_key: '' })
const showKeys = ref<Record<string, boolean>>({})

function addEntry() {
  if (!newEntry.value.name || !newEntry.value.api_key) {
    message.warning('请填写名称和 API Key')
    return
  }
  const key = newEntry.value.api_key
  entries.value.unshift({
    id: Date.now().toString(36),
    name: newEntry.value.name,
    description: newEntry.value.description,
    service: newEntry.value.service,
    key_preview: key.slice(0, 6) + '••••••••' + key.slice(-4),
    key_full: key,
    created_at: new Date().toLocaleDateString('zh-CN'),
  })
  newEntry.value = { name: '', description: '', service: '', api_key: '' }
  showAdd.value = false
  message.success('已添加')
}

function deleteEntry(id: string) {
  entries.value = entries.value.filter(e => e.id !== id)
  message.success('已删除')
}

const columns = [
  { title: '名称', key: 'name', width: 140 },
  { title: '服务', key: 'service', width: 120,
    render(row: ApiKeyEntry) {
      const map: Record<string, string> = {
        openai: 'OpenAI', anthropic: 'Anthropic', groq: 'Groq', github: 'GitHub', other: '其他'
      }
      return map[row.service] || row.service
    }
  },
  { title: 'Key 预览', key: 'key_preview', render(row: ApiKeyEntry) {
    return row.key_preview
  }},
  { title: '描述', key: 'description', ellipsis: true },
  { title: '添加时间', key: 'created_at', width: 120 },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render(row: ApiKeyEntry) {
      return [
        h(NButton, {
          size: 'tiny', quaternary: true,
          onClick: () => { showKeys.value[row.id] = !showKeys.value[row.id] }
        }, {
          icon: () => h(showKeys.value[row.id] ? EyeOffOutline : EyeOutline, { class: 'w-3.5 h-3.5' })
        }),
        h(NPopconfirm, { onNegativeClick: () => deleteEntry(row.id) }, {
          trigger: () => h(NButton, { size: 'tiny', quaternary: true, class: 'text-red-400' }, {
            icon: () => h(TrashOutline, { class: 'w-3.5 h-3.5' })
          }),
          default: () => '确认删除？',
        }),
      ]
    }
  }
]
</script>

<template>
  <div>
    <PageHeader title="API 配置" subtitle="第三方 API 密钥与端点管理" />
    <div class="bg-base-100 rounded-xl border border-base-content/5 p-5 md:p-6">
      <div class="flex items-center justify-between mb-4">
        <p class="text-sm text-base-content/50">在此安全存储第三方 API Key。实际密钥不会明文显示，通过 AI 模型配置使用时自动解密。</p>
        <NButton size="small" type="primary" @click="showAdd = true">
          <AddOutline class="w-4 h-4 mr-1" /> 添加
        </NButton>
      </div>

      <NDataTable
        :columns="columns"
        :data="entries"
        :bordered="false"
        :single-line="false"
        class="text-sm"
      />

      <div v-if="entries.length === 0" class="text-center text-base-content/30 text-xs py-8">
        暂无配置的 API Key
      </div>
    </div>

    <!-- Add modal -->
    <NModal v-model:show="showAdd" preset="card" title="添加 API Key" style="width:440px">
      <NForm :model="newEntry" label-placement="top">
        <NFormItem label="名称">
          <NInput v-model:value="newEntry.name" placeholder="例如: 我的 OpenAI Key" />
        </NFormItem>
        <NFormItem label="服务">
          <NInput v-model:value="newEntry.service" placeholder="openai / anthropic / groq / github" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput v-model:value="newEntry.description" placeholder="用途说明（可选）" />
        </NFormItem>
        <NFormItem label="API Key" required>
          <NInput v-model:value="newEntry.api_key" type="password" placeholder="sk-..." show-password-on="click" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showAdd = false">取消</NButton>
          <NButton type="primary" @click="addEntry">保存</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>
