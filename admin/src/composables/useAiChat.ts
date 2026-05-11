import { ref } from 'vue'
import {
  apiListAiConversations,
  apiCreateAiConversation,
  apiGetAiConversation,
  apiUpdateAiConversation,
  apiDeleteAiConversation,
  apiSendAiMessage,
  type AiConversation,
  type AiMessage,
} from '../api/kb'

export interface UseAiChatReturn {
  conversations: ReturnType<typeof ref<AiConversation[]>>
  currentConversation: ReturnType<typeof ref<AiConversation | null>>
  messages: ReturnType<typeof ref<AiMessage[]>>
  loading: ReturnType<typeof ref<boolean>>
  sending: ReturnType<typeof ref<boolean>>
  total: ReturnType<typeof ref<number>>

  loadConversations(opts?: { search?: string; model?: string }): Promise<void>
  loadConversation(id: number): Promise<void>
  createConversation(title?: string, model?: string): Promise<AiConversation>
  updateConversation(id: number, data: Parameters<typeof apiUpdateAiConversation>[1]): Promise<void>
  deleteConversation(id: number): Promise<void>
  sendMessage(content: string, temperature?: number): Promise<AiMessage>
  switchConversation(id: number): Promise<void>
  clearCurrent(): void
}

export function useAiChat(): UseAiChatReturn {
  const conversations = ref<AiConversation[]>([])
  const currentConversation = ref<AiConversation | null>(null)
  const messages = ref<AiMessage[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const total = ref(0)

  async function loadConversations(opts?: { search?: string; model?: string }) {
    loading.value = true
    try {
      const res = await apiListAiConversations(opts)
      conversations.value = res.items
      total.value = res.total
    } finally {
      loading.value = false
    }
  }

  async function loadConversation(id: number) {
    loading.value = true
    try {
      const conv = await apiGetAiConversation(id)
      currentConversation.value = conv
      messages.value = conv.messages || []
    } finally {
      loading.value = false
    }
  }

  async function createConversation(title?: string, model?: string): Promise<AiConversation> {
    const conv = await apiCreateAiConversation({ title, model })
    conversations.value.unshift(conv)
    total.value++
    return conv
  }

  async function updateConversation(id: number, data: Parameters<typeof apiUpdateAiConversation>[1]) {
    const updated = await apiUpdateAiConversation(id, data)
    const idx = conversations.value.findIndex(c => c.id === id)
    if (idx !== -1) conversations.value[idx] = updated
    if (currentConversation.value?.id === id) {
      currentConversation.value = { ...currentConversation.value, ...updated }
    }
  }

  async function deleteConversation(id: number) {
    await apiDeleteAiConversation(id)
    conversations.value = conversations.value.filter(c => c.id !== id)
    total.value--
    if (currentConversation.value?.id === id) clearCurrent()
  }

  async function sendMessage(content: string, temperature?: number): Promise<AiMessage> {
    if (!currentConversation.value) throw new Error('No active conversation')
    sending.value = true
    try {
      const reply = await apiSendAiMessage(currentConversation.value.id, { content, temperature })
      messages.value = [...messages.value, reply]
      // Update conversation title if it's still "新对话" and has first message exchange
      if (currentConversation.value.title === '新对话' && messages.value.length >= 2) {
        const firstUserMsg = messages.value.find(m => m.role === 'user')
        if (firstUserMsg) {
          const title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '…' : '')
          await updateConversation(currentConversation.value.id, { title })
        }
      }
      return reply
    } finally {
      sending.value = false
    }
  }

  async function switchConversation(id: number) {
    await loadConversation(id)
  }

  function clearCurrent() {
    currentConversation.value = null
    messages.value = []
  }

  return {
    conversations,
    currentConversation,
    messages,
    loading,
    sending,
    total,
    loadConversations,
    loadConversation,
    createConversation,
    updateConversation,
    deleteConversation,
    sendMessage,
    switchConversation,
    clearCurrent,
  }
}
