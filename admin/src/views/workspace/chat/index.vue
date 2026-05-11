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
import {
  apiListAiModels, apiSaveAiConversationToKb, apiListPromptTemplates,
  apiWebSearch,
  type AiModel, type PromptTemplate, type CompareBranch, type WebSearchResponse,
} from '../../../api/kb'
import InputVariablesModal from './InputVariablesModal.vue'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const {
  conversations, currentConversation, messages, sending,
  loadConversations, createConversation, updateConversation,
  deleteConversation, sendMessage, sendMessageStream, compareModels, switchConversation, clearCurrent,
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
const streamingMode = ref(false) // toggle: SSE streaming vs blocking
let streamCleanup: (() => void) | null = null

// Compare mode
const compareMode = ref(false)
const selectedCompareModels = ref<string[]>([])
const compareResults = ref<CompareBranch[]>([])
const compareLoading = ref(false)

// Web search mode
const showSearchPanel = ref(false)
const searchQuery = ref('')
const searchResults = ref<WebSearchResponse | null>(null)
const searchLoading = ref(false)
const selectedSearchResults = ref<Set<number>>(new Set())
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null

async function handleSearch(q: string) {
  if (!q.trim()) { showSearchPanel.value = false; searchResults.value = null; return }
  searchLoading.value = true
  try {
    searchResults.value = await apiWebSearch(q)
  } catch {
    searchResults.value = null
  } finally {
    searchLoading.value = false
  }
}

function toggleSearchResult(idx: number) {
  if (selectedSearchResults.value.has(idx)) {
    selectedSearchResults.value.delete(idx)
  } else {
    selectedSearchResults.value.add(idx)
  }
  selectedSearchResults.value = new Set(selectedSearchResults.value)
}

function confirmSearchResults() {
  if (!searchResults.value || selectedSearchResults.value.size === 0) {
    showSearchPanel.value = false; searchQuery.value = ''; return
  }
  // Build context string from selected results
  const selected = searchResults.value.results.filter((_, i) => selectedSearchResults.value.has(i))
  const contextLines = selected.map(r => `[搜索结果] ${r.snippet}`).join('\n')
  const finalMsg = `请结合以下网络搜索结果回答我的问题：\n\n${contextLines}\n\n我的问题：${searchQuery.value.replace(/^#\s*/, '')}`
  inputContent.value = finalMsg
  showSearchPanel.value = false
  searchQuery.value = ''
  selectedSearchResults.value = new Set()
  searchResults.value = null
}

function cancelSearch() {
  showSearchPanel.value = false
  searchQuery.value = ''
  searchResults.value = null
  selectedSearchResults.value = new Set()
}

// ============================================================
// Slash commands
// ============================================================
defineOptions({ components: { InputVariablesModal } })

const promptTemplates = ref<PromptTemplate[]>([])
const showSlashMenu = ref(false)
const slashFilter = ref('')
const slashSelectedIdx = ref(0)
const showVarModal = ref(false)
const selectedTemplate = ref<PromptTemplate | null>(null)

const filteredTemplates = computed(() => {
  const q = slashFilter.value.toLowerCase()
  return promptTemplates.value.filter(t => t.is_active && (
    t.command.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)
  ))
})

async function loadTemplates() {
  try {
    promptTemplates.value = await apiListPromptTemplates({ active: true })
  } catch { /* silent */ }
}

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
  await loadTemplates()
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
  userScrolled.value = false

  if (compareMode.value && selectedCompareModels.value.length >= 2) {
    // Multi-model compare mode
    compareResults.value = []
    compareLoading.value = true
    try {
      const branches = await compareModels(content, selectedCompareModels.value)
      compareResults.value = branches
    } catch (e: any) {
      message.error(e?.message || '对比失败')
    } finally {
      compareLoading.value = false
    }
    return
  }

  if (streamingMode.value) {
    // SSE streaming mode
    try {
      if (streamCleanup) streamCleanup()
      streamCleanup = sendMessageStream(content)
    } catch (e: any) {
      message.error(e?.message || '发送失败')
    }
  } else {
    // Blocking mode
    try {
      await sendMessage(content)
    } catch (e: any) {
      message.error(e?.message || '发送失败')
    }
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

  if (showSlashMenu.value) {
    if (e.key === 'ArrowDown') { e.preventDefault(); slashSelectedIdx.value = Math.min(slashSelectedIdx.value + 1, filteredTemplates.value.length - 1); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); slashSelectedIdx.value = Math.max(slashSelectedIdx.value - 1, 0); return }
    if (e.key === 'Enter') {
      e.preventDefault()
      const t = filteredTemplates.value[slashSelectedIdx.value]
      if (t) { handleSelectTemplate(t); return }
    }
    if (e.key === 'Escape') { showSlashMenu.value = false; return }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (showSlashMenu.value && filteredTemplates.value.length > 0) {
      const t = filteredTemplates.value[slashSelectedIdx.value]
      if (t) { handleSelectTemplate(t); return }
    }
    handleSend()
  }
}

// Detect slash command in input
function handleInput() {
  const text = inputContent.value

  // # search mode
  const hashIdx = text.lastIndexOf('#')
  if (hashIdx >= 0 && !text.slice(hashIdx).includes(' ')) {
    const q = text.slice(hashIdx + 1).trim()
    if (q.length > 0) {
      searchQuery.value = q
      showSearchPanel.value = true
      selectedSearchResults.value = new Set()
      // Debounce search
      if (searchDebounceTimer) clearTimeout(searchDebounceTimer)
      searchDebounceTimer = setTimeout(() => handleSearch(q), 500)
    }
    showSlashMenu.value = false
    return
  } else {
    showSearchPanel.value = false
    searchResults.value = null
  }

  // / command mode
  const slashIdx = text.lastIndexOf('/')
  if (slashIdx >= 0 && !text.slice(slashIdx).includes(' ')) {
    slashFilter.value = text.slice(slashIdx + 1)
    showSlashMenu.value = true
    slashSelectedIdx.value = 0
  } else {
    showSlashMenu.value = false
  }
}

function handleSelectTemplate(t: PromptTemplate) {
  selectedTemplate.value = t
  showSlashMenu.value = false
  if (t.variables && t.variables.length > 0) {
    showVarModal.value = true
  } else {
    // No variables — fill directly
    fillTemplateAndClose(t)
  }
}

function handleVarModalConfirm(filledContent: string) {
  inputContent.value = filledContent
  showVarModal.value = false
  selectedTemplate.value = null
}
void handleVarModalConfirm // referenced by template

function fillTemplateAndClose(t: PromptTemplate) {
  let content = t.content
  for (const v of t.variables) {
    content = content.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.default ?? '')
  }
  inputContent.value = content
  showSlashMenu.value = false
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
      <!-- Streaming toggle -->
      <button
        class="text-[10px] px-2 py-1 rounded border transition-all"
        :class="streamingMode ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-base-200/50 border-base-content/10 text-base-content/40 hover:text-base-content/60'"
        title="流式输出（打字机效果）"
        @click="streamingMode = !streamingMode"
      >
        {{ streamingMode ? '流式' : '普通' }}
      </button>
      <!-- Compare toggle -->
      <button
        class="text-[10px] px-2 py-1 rounded border transition-all"
        :class="compareMode ? 'bg-purple-50 border-purple-300 text-purple-600' : 'bg-base-200/50 border-base-content/10 text-base-content/40 hover:text-base-content/60'"
        title="多模型对比"
        @click="compareMode = !compareMode"
      >
        {{ compareMode ? '对比中' : '对比' }}
      </button>
      <!-- Compare model selector (shown when compare mode is on) -->
      <NSelect
        v-if="compareMode && models.length"
        v-model:value="selectedCompareModels"
        multiple
        :options="models.filter(m => m.is_active).map(m => ({ label: m.name, value: m.model_name }))"
        size="tiny"
        style="width: 180px"
        placeholder="选择 2-4 个模型"
        :max="4"
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

            <!-- Streaming / Thinking indicator -->
            <div v-if="sending" class="flex gap-2">
              <div class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-medium bg-base-300 text-base-content">AI</div>
              <div class="max-w-[75%] rounded-2xl rounded-tl-2xl bg-base-200 px-4 py-3">
                <div class="flex items-center gap-1 text-base-content/50 text-sm">
                  <NSpin v-if="!streamingMode" :size="12" />
                  <span v-if="streamingMode" class="text-xs animate-pulse">✦ </span>
                  <span class="text-xs">{{ streamingMode ? '生成中…' : '思考中…' }}</span>
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

          <!-- Compare results panel -->
          <div v-if="compareResults.length > 0" class="border-t border-base-content/10 bg-base-100 p-4 shrink-0">
            <div class="text-xs font-medium text-base-content/60 mb-3 flex items-center justify-between">
              <span>多模型对比结果</span>
              <button class="text-base-content/30 hover:text-base-content/60 text-[10px]" @click="compareResults = []">清除</button>
            </div>
            <div class="flex gap-3 overflow-x-auto">
              <div
                v-for="(branch, i) in compareResults"
                :key="i"
                class="flex-1 min-w-0 border border-base-content/10 rounded-xl p-3"
              >
                <div class="text-[10px] font-bold mb-2 flex items-center gap-1">
                  <span class="text-purple-600">{{ branch.model }}</span>
                  <span v-if="branch.status === 'done'" class="text-green-400 text-[8px]">✓</span>
                  <span v-if="branch.status === 'error'" class="text-red-400 text-[8px]">✗</span>
                </div>
                <div v-if="branch.status === 'error'" class="text-xs text-red-500">{{ branch.error }}</div>
                <div
                  v-else-if="branch.content"
                  class="text-xs leading-relaxed whitespace-pre-wrap break-words max-h-64 overflow-y-auto"
                >
                  <!-- eslint-disable-next-line vue/no-v-html -->
                  <div v-html="renderContent(branch.content)" />
                </div>
                <div v-else class="text-xs text-base-content/30 animate-pulse">等待回复…</div>
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
                :autosize="{ minRows: 1, maxRows: 8 }"
                placeholder="输入 / 触发快捷模板，# 触发网络搜索…"
                @input="handleInput"
                @keydown="handleKeydown"
              />

              <!-- Slash command popup -->
              <div
                v-if="showSlashMenu && filteredTemplates.length"
                class="absolute bottom-full left-0 mb-1 z-50 bg-base-100 border border-base-content/10 rounded-lg shadow-xl py-1 min-w-72 max-h-64 overflow-y-auto"
              >
                <div class="px-3 py-1 text-[10px] text-base-content/30 border-b border-base-content/5">快捷命令</div>
                <button
                  v-for="t in filteredTemplates"
                  :key="t.id"
                  class="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-200/50 text-left"
                  @click="handleSelectTemplate(t)"
                >
                  <span class="text-xs font-mono text-primary shrink-0">{{ t.command }}</span>
                  <span class="text-xs text-base-content/60">{{ t.title }}</span>
                </button>
              </div>

              <!-- Web search panel (#) -->
              <div
                v-if="showSearchPanel"
                class="absolute bottom-full left-0 mb-1 z-50 bg-base-100 border border-primary/30 rounded-xl shadow-xl w-[480px] max-h-80 overflow-y-auto"
              >
                <div class="flex items-center justify-between px-3 py-2 border-b border-base-content/10">
                  <div class="flex items-center gap-2">
                    <SearchOutline class="w-4 h-4 text-primary" />
                    <span class="text-xs font-medium text-primary">网络搜索</span>
                    <span class="text-[10px] text-base-content/30">#{{ searchQuery }}</span>
                  </div>
                  <div class="flex gap-2">
                    <NButton size="tiny" @click="cancelSearch">取消</NButton>
                    <NButton size="tiny" type="primary" :disabled="selectedSearchResults.size === 0" @click="confirmSearchResults">
                      插入 {{ selectedSearchResults.size > 0 ? `(${selectedSearchResults.size}条) ` : '' }}发送
                    </NButton>
                  </div>
                </div>
                <!-- Search results -->
                <div v-if="searchLoading" class="px-4 py-3 text-xs text-base-content/40 flex items-center gap-2">
                  <NSpin size="small" /> 搜索中…
                </div>
                <div v-else-if="searchResults?.error" class="px-4 py-3 text-xs text-red-400">
                  搜索失败: {{ searchResults.error }}
                </div>
                <div v-else-if="searchResults?.results.length === 0" class="px-4 py-3 text-xs text-base-content/30">
                  未找到结果
                </div>
                <div v-else class="py-1">
                  <div
                    v-for="(r, i) in searchResults?.results"
                    :key="i"
                    class="flex items-start gap-2 px-3 py-2 hover:bg-base-200/50 cursor-pointer"
                    :class="selectedSearchResults.has(i) ? 'bg-primary/5' : ''"
                    @click="toggleSearchResult(i)"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedSearchResults.has(i)"
                      class="checkbox checkbox-xs mt-0.5"
                    />
                    <div class="text-xs text-base-content/70 leading-relaxed">{{ r.snippet }}</div>
                  </div>
                </div>
              </div>
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

<!-- Slash command: variable fill modal -->
<InputVariablesModal
  v-model="showVarModal"
  :template="selectedTemplate"
  @confirm="handleVarModalConfirm"
/>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
