<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NButton, NInput, NSelect, NSpin, useMessage } from 'naive-ui'
import {
  AddOutline, ChatbubblesOutline, TrashOutline, StarOutline, SearchOutline,
  CopyOutline, CheckmarkCircleOutline, RefreshOutline, CreateOutline,
  ChatbubbleOutline, ReturnDownBackOutline, EllipsisHorizontalOutline,
} from '@vicons/ionicons5'
import { useAiChat } from '../../../composables/useAiChat'
import { apiListAiModels, apiSaveAiConversationToKb, type AiModel } from '../../../api/kb'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const {
  conversations, currentConversation, messages, sending,
  loadConversations, createConversation, updateConversation,
  deleteConversation, sendMessage, switchConversation, clearCurrent,
} = useAiChat()

const models = ref<AiModel[]>([])
const searchQ = ref('')
const inputContent = ref('')
const chatContainer = ref<HTMLDivElement>()
const selectedModel = ref('')
const editingMsgIdx = ref<number | null>(null)
const editContent = ref('')
const copiedIdx = ref<number | null>(null)
const showMsgMenuIdx = ref<number | null>(null)
const msgRatings = ref<Record<number, 'up' | 'down'>>({})
const userScrolled = ref(false)
const showJumpBtn = ref(false)

// ============================================================
// Suggestion chips (quick start prompts)
// ============================================================
const suggestions = [
  '帮我总结这篇文章的主要内容',
  '用中文解释这个概念',
  '这段代码有什么问题吗',
  '给我一些改进建议',
]

async function loadModels() {
  try {
    models.value = await apiListAiModels()
    const def = models.value.find(m => m.is_default)
    if (def) selectedModel.value = def.model_name
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
  if (id) await switchConversation(Number(id))
  else clearCurrent()
})

watch(messages, async () => {
  await nextTick()
  if (chatContainer.value && !userScrolled.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}, { deep: true })

// Detect user scroll — show jump-to-bottom button
function handleScroll() {
  if (!chatContainer.value) return
  const { scrollTop, scrollHeight, clientHeight } = chatContainer.value
  const atBottom = scrollHeight - scrollTop - clientHeight < 80
  showJumpBtn.value = !atBottom
  userScrolled.value = !atBottom
}

function jumpToBottom() {
  if (!chatContainer.value) return
  chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  showJumpBtn.value = false
  userScrolled.value = false
}

// ============================================================
// Message sending
// ============================================================
async function handleSend() {
  const content = inputContent.value.trim()
  if (!content || sending.value) return

  if (!currentConversation.value) {
    await handleNewConversation()
    await nextTick()
  }

  inputContent.value = ''
  try {
    await sendMessage(content)
    userScrolled.value = false
  } catch (e: any) {
    message.error(e?.message || '发送失败')
  }
}

async function handleNewConversation() {
  const conv = await createConversation('新对话', selectedModel.value || undefined)
  router.push({ name: 'cms-workspace-chat', params: { id: conv.id } })
}

async function handleSuggestion(text: string) {
  inputContent.value = text
  await handleSend()
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

// ============================================================
// Message actions
// ============================================================
function startEditMsg(idx: number) {
  editingMsgIdx.value = idx
  editContent.value = messages.value?.[idx]?.content ?? ''
  showMsgMenuIdx.value = null
}

async function confirmEditMsg(_idx: number) {
  editingMsgIdx.value = null
  message.info('消息已编辑（本地预览）')
}

function cancelEditMsg() {
  editingMsgIdx.value = null
}

async function handleCopyMsg(idx: number) {
  const text = messages.value?.[idx]?.content ?? ''
  try {
    await navigator.clipboard.writeText(text)
    copiedIdx.value = idx
    setTimeout(() => { copiedIdx.value = null }, 2000)
  } catch {
    message.error('复制失败')
  }
}

async function handleRegenerate() {
  if (!currentConversation.value) return
  const msgList = messages.value ?? []
  const lastUser = [...msgList].reverse().find(m => m.role === 'user')
  if (!lastUser) return
  const lastUserIdx = msgList.indexOf(lastUser)
  const trimmed = msgList.slice(0, lastUserIdx)
  messages.value = trimmed
  userScrolled.value = false
  try {
    await sendMessage(lastUser.content)
  } catch (e: any) {
    message.error(e?.message || '重新生成失败')
  }
}

async function handleContinue() {
  // Append "请继续" to continue truncated response
  if (!currentConversation.value) return
  try {
    await sendMessage('请继续')
  } catch (e: any) {
    message.error(e?.message || '继续失败')
  }
}

function handleRateMsg(idx: number, vote: 'up' | 'down') {
  const current = msgRatings.value[idx]
  if (current === vote) {
    delete msgRatings.value[idx]
    msgRatings.value = { ...msgRatings.value }
  } else {
    msgRatings.value[idx] = vote
    msgRatings.value = { ...msgRatings.value }
  }
  const emoji = vote === 'up' ? '👍' : '👎'
  message.info(`${emoji} 已记录反馈`)
}

function toggleMsgMenu(idx: number) {
  showMsgMenuIdx.value = showMsgMenuIdx.value === idx ? null : idx
}

// Close menus on outside click
function handleContainerClick(e: MouseEvent) {
  const el = e.target as HTMLElement
  if (!el.closest('.msg-menu-wrapper')) {
    showMsgMenuIdx.value = null
  }
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } catch { return ts }
}

// Render markdown-like text: **bold**, `code`, ```code block```
function renderContent(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`\n]+)`/g, '<code class="px-1 py-0.5 rounded bg-base-300 text-xs font-mono">$1</code>')
    .replace(/```(\w*)\n?([\s\S]+?)```/g, (_, lang, code) => {
      const escaped = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
      return `<pre class="rounded bg-[#1e1e1e] text-[#d4d4d4] p-3 my-2 overflow-x-auto text-xs font-mono"><div class="text-[#6a9955] text-[10px] mb-1">${lang || 'code'}</div><code>${escaped}</code><button class="copy-btn mt-1 text-[10px] text-[#4ec9b0] hover:text-[#9cdcfe]" onclick="navigator.clipboard.writeText(this.parentElement.querySelector('code').innerText).then(()=>{this.textContent='已复制!'})">复制</button></pre>`
    })
    .replace(/\n/g, '<br>')
}

const conversationList = computed(() => conversations.value || [])
const filteredConversations = computed(() => {
  const q = searchQ.value.toLowerCase()
  return q ? conversationList.value.filter(c => c.title.toLowerCase().includes(q)) : conversationList.value
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
      <NSelect
        v-if="models.length"
        v-model:value="selectedModel"
        :options="models.map(m => ({ label: m.name, value: m.model_name }))"
        size="tiny"
        style="width: 140px"
      />
      <NButton size="tiny" type="primary" @click="handleNewConversation">
        <AddOutline class="w-3.5 h-3.5 mr-1" /> 新建
      </NButton>
    </div>

    <!-- Main area -->
    <div class="flex flex-1 min-h-0 overflow-hidden">
      <!-- Left sidebar -->
      <div class="w-60 shrink-0 border-r border-base-content/10 bg-base-100 flex flex-col overflow-hidden">
        <div class="px-2 py-2 border-b border-base-content/5">
          <NInput v-model:value="searchQ" size="small" placeholder="搜索对话…" clearable>
            <template #prefix><SearchOutline class="w-3.5 h-3.5 text-base-content/30" /></template>
          </NInput>
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="conv in filteredConversations" :key="conv.id"
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
                <span>{{ conv.message_count }}条</span><span>·</span><span>{{ conv.model }}</span>
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
      <div class="flex-1 flex flex-col min-w-0 bg-base-50 relative" @click="handleContainerClick">
        <!-- Empty state -->
        <div v-if="!currentConversation" class="flex-1 flex flex-col items-center justify-center gap-5">
          <ChatbubblesOutline class="w-20 h-20 text-base-content/15" />
          <div class="text-center max-w-sm">
            <p class="text-base-content/40 text-sm mb-1">选择一个对话或新建对话开始</p>
            <p class="text-base-content/25 text-xs mb-4">你可以用中文或英文提问，支持代码、公式、多轮对话</p>
          </div>
          <!-- Suggestions -->
          <div class="flex flex-wrap gap-2 justify-center max-w-md px-4">
            <button
              v-for="s in suggestions" :key="s"
              class="px-3 py-1.5 rounded-full border border-base-content/15 text-xs text-base-content/60 hover:border-primary/40 hover:text-primary transition-all bg-base-100"
              @click="handleSuggestion(s)"
            >
              {{ s }}
            </button>
          </div>
          <NButton size="small" type="primary" class="mt-2" @click="handleNewConversation">
            <AddOutline class="w-3.5 h-3.5 mr-1" /> 新建对话
          </NButton>
        </div>

        <!-- Active conversation -->
        <template v-else>
          <!-- Header -->
          <div class="px-4 py-2 border-b border-base-content/10 shrink-0 bg-base-100 flex items-center justify-between">
            <div>
              <div class="text-sm font-medium">{{ currentConversation.title }}</div>
              <div class="text-[10px] text-base-content/40 mt-0.5">
                {{ currentConversation.model }} · {{ currentConversation.message_count }} 条消息
              </div>
            </div>
            <NButton size="tiny" quaternary @click="handleSaveToKb">💾 存入知识库</NButton>
          </div>

          <!-- Messages -->
          <div
            ref="chatContainer"
            class="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            @scroll="handleScroll"
          >
            <!-- Empty chat hint -->
            <div v-if="messageList.length === 0" class="flex flex-col items-center justify-center h-full gap-3 mt-10">
              <ChatbubbleOutline class="w-10 h-10 text-base-content/15" />
              <p class="text-base-content/30 text-xs text-center">开始对话吧，AI 会根据你的问题给出最佳回答</p>
              <div class="flex flex-wrap gap-2 justify-center">
                <button
                  v-for="s in suggestions" :key="s"
                  class="px-3 py-1.5 rounded-full border border-base-content/10 text-xs text-base-content/50 hover:border-primary/40 hover:text-primary transition-all"
                  @click="handleSuggestion(s)"
                >{{ s }}</button>
              </div>
            </div>

            <!-- Message bubbles -->
            <div
              v-for="(msg, idx) in messageList" :key="idx"
              :class="['flex gap-2', msg.role === 'user' ? 'flex-row-reverse' : 'flex-row']"
            >
              <!-- Avatar -->
              <div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium mt-0.5"
                :class="msg.role === 'user' ? 'bg-primary text-primary-content' : 'bg-base-300 text-base-content'">
                {{ msg.role === 'user' ? 'U' : 'AI' }}
              </div>

              <!-- Content area -->
              <div class="max-w-[80%]">
                <!-- Edit mode -->
                <div v-if="editingMsgIdx === idx" class="flex flex-col gap-1">
                  <NInput
                    v-model:value="editContent"
                    type="textarea"
                    :rows="3"
                    size="small"
                  />
                  <div class="flex gap-1">
                    <NButton size="tiny" type="primary" @click="confirmEditMsg(idx)">确认</NButton>
                    <NButton size="tiny" @click="cancelEditMsg">取消</NButton>
                  </div>
                </div>

                <!-- Normal display -->
                <div v-else>
                  <div class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words"
                    :class="msg.role === 'user'
                      ? 'bg-primary text-primary-content rounded-tr-2xl rounded-bl-2xl'
                      : 'bg-base-200 text-base-content rounded-tl-2xl rounded-br-2xl'">
                    <!-- eslint-disable-next-line vue/no-v-html -->
                    <div v-html="renderContent(msg.content)" />
                  </div>

                  <!-- Message footer: time + actions -->
                  <div class="flex items-center gap-2 mt-1 px-1 group">
                    <span class="text-[10px] text-base-content/30">{{ formatTime(msg.timestamp) }}</span>
                    <span v-if="msg.provider" class="text-[10px] text-base-content/20">{{ msg.provider }}</span>

                    <!-- Rating (assistant only) -->
                    <template v-if="msg.role === 'assistant'">
                      <button class="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        :class="msgRatings[idx] === 'up' ? 'text-green-500 opacity-100' : 'text-base-content/30 hover:text-green-400'"
                        @click="handleRateMsg(idx, 'up')">👍</button>
                      <button class="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                        :class="msgRatings[idx] === 'down' ? 'text-red-500 opacity-100' : 'text-base-content/30 hover:text-red-400'"
                        @click="handleRateMsg(idx, 'down')">👎</button>
                    </template>

                    <!-- Copy -->
                    <button
                      class="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-base-content/30 hover:text-base-content/60"
                      @click="handleCopyMsg(idx)"
                    >
                      <component :is="copiedIdx === idx ? CheckmarkCircleOutline : CopyOutline" class="w-3 h-3" />
                    </button>

                    <!-- More menu -->
                    <div class="relative msg-menu-wrapper">
                      <button
                        class="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-base-content/30 hover:text-base-content/60"
                        @click.stop="toggleMsgMenu(idx)"
                      >
                        <EllipsisHorizontalOutline class="w-3 h-3" />
                      </button>

                      <!-- Dropdown menu -->
                      <div
                        v-if="showMsgMenuIdx === idx"
                        class="absolute top-full left-0 mt-1 z-50 bg-base-100 border border-base-content/10 rounded-lg shadow-xl py-1 min-w-36 text-xs"
                      >
                        <button
                          v-if="msg.role === 'user'"
                          class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-base-200/50 text-left"
                          @click="startEditMsg(idx)"
                        >
                          <CreateOutline class="w-3.5 h-3.5" /> 编辑消息
                        </button>
                        <button
                          class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-base-200/50 text-left"
                          @click="handleCopyMsg(idx)"
                        >
                          <CopyOutline class="w-3.5 h-3.5" /> 复制内容
                        </button>
                        <button
                          v-if="msg.role === 'assistant'"
                          class="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-base-200/50 text-left"
                          @click="handleContinue"
                        >
                          <ReturnDownBackOutline class="w-3.5 h-3.5" /> 继续生成
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Streaming indicator -->
            <div v-if="sending" class="flex gap-2">
              <div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium bg-base-300 text-base-content">AI</div>
              <div class="max-w-[75%] rounded-2xl rounded-tl-2xl bg-base-200 px-4 py-3">
                <div class="flex items-center gap-1 text-base-content/50 text-sm">
                  <NSpin :size="12" />
                  <span class="text-xs">思考中…</span>
                </div>
              </div>
            </div>

            <!-- Regenerate bar (after assistant message when sending done) -->
            <div v-if="!sending && messageList.length > 0" class="flex justify-center gap-2 py-1">
              <button
                class="flex items-center gap-1 text-xs text-base-content/40 hover:text-base-content/70 px-3 py-1 rounded-full border border-base-content/10 hover:border-base-content/30 transition-all"
                @click="handleRegenerate"
              >
                <RefreshOutline class="w-3.5 h-3.5" /> 重新生成
              </button>
            </div>
          </div>

          <!-- Jump to bottom FAB -->
          <Transition name="fade">
            <button
              v-if="showJumpBtn"
              class="absolute bottom-20 right-6 w-10 h-10 rounded-full bg-base-100 border border-base-content/15 shadow-lg flex items-center justify-center text-base-content/50 hover:text-base-content/80 transition-all z-30"
              @click="jumpToBottom"
            >
              <span class="text-lg">↓</span>
            </button>
          </Transition>

          <!-- Input area -->
          <div class="shrink-0 border-t border-base-content/10 bg-base-100 p-3">
            <div class="flex items-end gap-2">
              <NInput
                v-model:value="inputContent"
                type="textarea"
                :rows="2"
                :autosize="{ minRows: 1, maxRows: 8 }"
                placeholder="输入消息… (Ctrl+Enter 发送, Shift+Enter 换行)"
                @keydown="handleKeydown"
              />
              <NButton type="primary" :loading="sending" @click="handleSend" style="height: auto; align-self: flex-end">
                发送
              </NButton>
            </div>
            <div class="flex items-center justify-between mt-1">
              <div class="flex gap-3">
                <span class="text-[10px] text-base-content/25">Ctrl+Enter 发送</span>
                <span class="text-[10px] text-base-content/25">支持 Markdown</span>
              </div>
              <span v-if="selectedModel" class="text-[10px] text-base-content/25">当前: {{ selectedModel }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
