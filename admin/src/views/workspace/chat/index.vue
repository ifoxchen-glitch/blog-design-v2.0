<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NSelect, NSpin, useMessage } from 'naive-ui'
import { AddOutline, ChatbubblesOutline, TrashOutline, StarOutline, SearchOutline } from '@vicons/ionicons5'
import { useAiChat } from '../../../composables/useAiChat'
import { apiListAiModels, apiSaveAiConversationToKb, type AiModel } from '../../../api/kb'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const {
  conversations,
  currentConversation,
  messages,
  sending,
  loadConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  sendMessage,
  switchConversation,
  clearCurrent,
} = useAiChat()

const models = ref<AiModel[]>([])
const searchQ = ref('')
const inputContent = ref('')
const chatContainer = ref<HTMLDivElement>()
const selectedModel = ref('')

async function loadModels() {
  try {
    models.value = await apiListAiModels()
    const defaultModel = models.value.find(m => m.is_default)
    if (defaultModel) selectedModel.value = defaultModel.model_name
  } catch { /* silent */ }
}

async function init() {
  await loadModels()
  const id = route.params.id
  if (id) {
    await switchConversation(Number(id))
    const convModel = currentConversation.value?.model
    if (convModel) selectedModel.value = convModel
  } else {
    clearCurrent()
  }
  await loadConversations()
}

onMounted(init)

watch(() => route.params.id, async (id) => {
  if (id) {
    await switchConversation(Number(id))
  } else {
    clearCurrent()
  }
})

watch(messages, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}, { deep: true })

async function handleNewConversation() {
  const conv = await createConversation('新对话', selectedModel.value || undefined)
  router.push({ name: 'cms-workspace-chat', params: { id: conv.id } })
}

async function handleSend() {
  const content = inputContent.value.trim()
  if (!content || sending.value) return

  if (!currentConversation.value) {
    const conv = await createConversation('新对话', selectedModel.value || undefined)
    router.push({ name: 'cms-workspace-chat', params: { id: conv.id } })
    await nextTick()
  }

  inputContent.value = ''
  try {
    await sendMessage(content)
  } catch (e: any) {
    message.error(e?.message || '发送失败')
  }
}

function handleKeydown(e: KeyboardEvent) {
  const isInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'
  if (!isInput) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

async function handleSelectConversation(id: number) {
  router.push({ name: 'cms-workspace-chat', params: { id: String(id) } })
}

async function handleStar(id: number) {
  const conv = (conversations.value || []).find(c => c.id === id)
  if (!conv) return
  await updateConversation(id, { is_starred: !conv.is_starred })
}

async function handleSaveToKb() {
  if (!currentConversation.value) return
  try {
    const result = await apiSaveAiConversationToKb(currentConversation.value.id)
    message.success(`已保存到知识库: ${result.path}`)
  } catch (e: any) {
    message.error(e?.response?.data?.message || '保存失败')
  }
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

const conversationList = computed(() => conversations.value || [])
const filteredConversations = computed(() => {
  const list = conversationList.value
  if (!searchQ.value) return list
  const q = searchQ.value.toLowerCase()
  return list.filter(c => c.title.toLowerCase().includes(q))
})

const messageList = computed(() => messages.value || [])
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden" style="height: calc(100vh - 180px); min-height: 500px">
    <!-- Top bar -->
    <div class="flex items-center gap-2 px-3 py-1.5 bg-base-100 border-b border-base-content/10 shrink-0">
      <NButton size="tiny" quaternary @click="router.push({ name: 'cms-workspace' })">
        ← 返回
      </NButton>
      <span class="text-sm font-medium">AI 对话</span>

      <div class="flex-1" />

      <!-- Model selector -->
      <NSelect
        v-if="models.length"
        v-model:value="selectedModel"
        :options="models.map(m => ({ label: m.name, value: m.model_name }))"
        size="tiny"
        style="width: 140px"
        placeholder="选择模型"
      />

      <NButton size="tiny" type="primary" @click="handleNewConversation">
        <AddOutline class="w-3.5 h-3.5 mr-1" /> 新建对话
      </NButton>
    </div>

    <!-- Main area -->
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <!-- Left sidebar: conversation list -->
      <div class="w-60 shrink-0 border-r border-base-content/10 bg-base-100 flex flex-col overflow-hidden">
        <!-- Search -->
        <div class="px-2 py-2 border-b border-base-content/5">
          <NInput v-model:value="searchQ" size="small" placeholder="搜索对话…" clearable>
            <template #prefix><SearchOutline class="w-3.5 h-3.5 text-base-content/30" /></template>
          </NInput>
        </div>

        <!-- List -->
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="conv in filteredConversations"
            :key="conv.id"
            class="flex items-start gap-1 px-2 py-2 cursor-pointer hover:bg-base-200/50 border-b border-base-content/5"
            :class="currentConversation?.id === conv.id ? 'bg-primary/10' : ''"
            @click="handleSelectConversation(conv.id)"
          >
            <ChatbubblesOutline class="w-4 h-4 shrink-0 mt-0.5 text-base-content/40" />
            <div class="flex-1 min-w-0">
              <div class="text-xs truncate" :class="currentConversation?.id === conv.id ? 'font-medium' : ''">
                {{ conv.title }}
              </div>
              <div class="text-[10px] text-base-content/40 mt-0.5 flex items-center gap-1">
                <span>{{ conv.message_count }}条</span>
                <span>·</span>
                <span>{{ conv.model }}</span>
              </div>
            </div>
            <button class="shrink-0 p-0.5 hover:bg-base-300/50 rounded" @click.stop="handleStar(conv.id)">
              <StarOutline :class="['w-3 h-3', conv.is_starred ? 'text-yellow-400 fill-yellow-400' : 'text-base-content/30']" />
            </button>
            <button class="shrink-0 p-0.5 hover:bg-red-50 rounded" @click.stop="deleteConversation(conv.id)">
              <TrashOutline class="w-3 h-3 text-base-content/30 hover:text-red-500" />
            </button>
          </div>

          <div v-if="!filteredConversations.length" class="px-3 py-6 text-center text-base-content/30 text-xs">
            暂无对话
          </div>
        </div>
      </div>

      <!-- Right: chat area -->
      <div class="flex-1 flex flex-col min-w-0 bg-base-50">
        <!-- No conversation selected -->
        <div v-if="!currentConversation" class="flex-1 flex flex-col items-center justify-center gap-4">
          <ChatbubblesOutline class="w-16 h-16 text-base-content/20" />
          <div class="text-center">
            <p class="text-base-content/50 text-sm">选择一个对话或新建对话开始</p>
            <NButton size="small" type="primary" class="mt-3" @click="handleNewConversation">
              <AddOutline class="w-3.5 h-3.5 mr-1" /> 新建对话
            </NButton>
          </div>
        </div>

        <!-- Active conversation -->
        <template v-else>
          <!-- Conversation header -->
          <div class="px-4 py-2 border-b border-base-content/10 shrink-0 bg-base-100 flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">{{ currentConversation.title }}</div>
              <div class="text-[10px] text-base-content/40 mt-0.5">
                {{ currentConversation.model }} · {{ currentConversation.message_count }} 条消息
              </div>
            </div>
            <NButton size="tiny" quaternary @click="handleSaveToKb">
              💾 存入知识库
            </NButton>
          </div>

          <!-- Messages -->
          <div ref="chatContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div v-if="messageList.length === 0" class="text-center text-base-content/30 text-xs mt-10">
              开始对话吧
            </div>

            <div v-for="(msg, idx) in messageList" :key="idx" :class="['flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row']">
              <!-- Avatar -->
              <div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium"
                :class="msg.role === 'user' ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content'">
                {{ msg.role === 'user' ? 'U' : 'AI' }}
              </div>

              <!-- Bubble -->
              <div class="max-w-[75%]">
                <div class="rounded-xl px-3 py-2 text-sm whitespace-pre-wrap break-words"
                  :class="msg.role === 'user'
                    ? 'bg-primary text-primary-content rounded-tr-sm'
                    : 'bg-base-200 text-base-content rounded-tl-sm'">
                  {{ msg.content }}
                </div>
                <div class="text-[10px] text-base-content/30 mt-1 px-1">
                  {{ formatTime(msg.timestamp) }}
                  <span v-if="msg.provider" class="ml-1">{{ msg.provider }}</span>
                </div>
              </div>
            </div>

            <!-- Sending indicator -->
            <div v-if="sending" class="flex gap-2">
              <div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium bg-base-300 text-base-content">
                AI
              </div>
              <div class="max-w-[75%]">
                <div class="rounded-xl rounded-tl-sm px-3 py-2 bg-base-200">
                  <NSpin :size="14" /> 思考中…
                </div>
              </div>
            </div>
          </div>

          <!-- Input area -->
          <div class="shrink-0 border-t border-base-content/10 bg-base-100 p-3">
            <div class="flex items-end gap-2">
              <NInput
                v-model:value="inputContent"
                type="textarea"
                :rows="2"
                :autosize="{ minRows: 1, maxRows: 6 }"
                placeholder="输入消息… (Ctrl+Enter 发送, Shift+Enter 换行)"
                @keydown="handleKeydown"
              />
              <NButton type="primary" :loading="sending" @click="handleSend" style="height: auto">
                发送
              </NButton>
            </div>
            <div class="flex items-center justify-between mt-1">
              <span class="text-[10px] text-base-content/30">Ctrl+Enter 发送 · Shift+Enter 换行</span>
              <span v-if="selectedModel" class="text-[10px] text-base-content/30">当前: {{ selectedModel }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
