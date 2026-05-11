import { ref } from 'vue'
import {
  apiListAiConversations,
  apiCreateAiConversation,
  apiGetAiConversation,
  apiCompareModels,
  type CompareBranch,

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
  sendMessageStream(content: string, temperature?: number): () => void
  compareModels(content: string, models: string[]): Promise<CompareBranch[]>
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

  /**
   * Stream AI response via SSE — messages appear word-by-word.
   * Returns a cleanup function.
   */
  function sendMessageStream(content: string, temperature?: number): () => void {
    if (!currentConversation.value) throw new Error('No active conversation')

    // Append a placeholder user message immediately
    const userMsg: AiMessage = { role: 'user', content, timestamp: new Date().toISOString() }
    messages.value = [...messages.value, userMsg]

    // Append a streaming assistant message placeholder
    const assistantMsg: AiMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
    const assistantIdx = messages.value.length
    messages.value = [...messages.value, assistantMsg]

    sending.value = true
    let cancelled = false

    const url = `/api/v2/admin/kb/conversations/${currentConversation.value.id}/messages/stream` +
      `?content=${encodeURIComponent(content)}` +
      (temperature !== undefined ? `&temperature=${temperature}` : '')

    // Use fetch + ReadableStream (not EventSource, since we need POST-like behaviour with SSE)
    // Actually, we use GET SSE via EventSource but pass content via query string
    const es = new EventSource(url)

    es.addEventListener('user_message', (_e: MessageEvent) => {
      // User message already added above
    })

    es.addEventListener('data', (e: MessageEvent) => {
      if (cancelled) return
      // Accumulate streamed content into the assistant message
      const current = messages.value[assistantIdx]
      if (current?.role === 'assistant') {
        messages.value = messages.value.map((m, i) =>
          i === assistantIdx ? { ...m, content: m.content + e.data } : m
        )
      }
    })

    es.addEventListener('done', async () => {
      if (cancelled) return
      sending.value = false
      es.close()
      // Update conversation title if needed
      if (currentConversation.value?.title === '新对话' && messages.value.length >= 2) {
        const firstUserMsg = messages.value.find(m => m.role === 'user')
        if (firstUserMsg) {
          const title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '…' : '')
          await updateConversation(currentConversation.value.id, { title })
        }
      }
    })

    es.addEventListener('error', (e: Event) => {
      sending.value = false
      es.close()
      console.error('[SSE error]', e)
    })

    // Return cleanup function
    return () => {
      cancelled = true
      sending.value = false
      es.close()
    }
  }

  async function compareModels(content: string, models: string[]): Promise<CompareBranch[]> {
    if (!currentConversation.value) throw new Error('No active conversation')
    sending.value = true
    try {
      const result = await apiCompareModels(currentConversation.value.id, { content, models })
      return result.branches
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
    sendMessageStream,
    compareModels,
    switchConversation,
    clearCurrent,
  }
}
