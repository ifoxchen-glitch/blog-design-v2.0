import { ref, type Ref } from 'vue'
import {
  apiListAiConversations,
  apiCreateAiConversation,
  apiGetAiConversation,
  apiCompareModels,
  apiRegenerateMessage,
  apiUploadAttachment,
  type CompareBranch,
  apiUpdateAiConversation,
  apiDeleteAiConversation,
  apiSendAiMessage,
  type AiConversation,
  type AiMessage,
  type AiAttachment,
} from '../api/kb'

export interface UseAiChatReturn {
  conversations: Ref<AiConversation[]>
  currentConversation: Ref<AiConversation | null>
  messages: Ref<AiMessage[]>
  loading: Ref<boolean>
  sending: Ref<boolean>
  total: Ref<number>

  loadConversations(opts?: { search?: string; model?: string }): Promise<void>
  loadConversation(id: number): Promise<void>
  createConversation(title?: string, model?: string): Promise<AiConversation>
  updateConversation(id: number, data: Parameters<typeof apiUpdateAiConversation>[1]): Promise<void>
  deleteConversation(id: number): Promise<void>
  sendMessage(content: string, temperature?: number, kbContext?: { docId: number; title: string; snippet: string }[], attachments?: AiAttachment[]): Promise<AiMessage>
  sendMessageStream(content: string, temperature?: number, kbContext?: { docId: number; title: string; snippet: string }[], attachments?: AiAttachment[]): () => void
  uploadAttachment(file: File): Promise<AiAttachment>
  compareModels(content: string, models: string[]): Promise<CompareBranch[]>
  regenerateMessage(idx: number): Promise<void>
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

  async function sendMessage(content: string, temperature?: number, kbContext?: { docId: number; title: string; snippet: string }[], attachments?: AiAttachment[]): Promise<AiMessage> {
    if (!currentConversation.value) throw new Error('No active conversation')
    sending.value = true
    try {
      const reply = await apiSendAiMessage(currentConversation.value.id, { content, temperature, kbContext, attachments })
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
   * Stream AI response via SSE using fetch + ReadableStream.
   * EventSource cannot set Authorization headers, so we manually parse SSE.
   * Returns a cleanup function.
   */
  function sendMessageStream(content: string, temperature?: number, kbContext?: { docId: number; title: string; snippet: string }[], attachments?: AiAttachment[]): () => void {
    if (!currentConversation.value) throw new Error('No active conversation')

    const userMsg: AiMessage = { role: 'user', content, timestamp: new Date().toISOString(), attachments }
    messages.value = [...messages.value, userMsg]

    const assistantMsg: AiMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString() }
    const assistantIdx = messages.value.length
    messages.value = [...messages.value, assistantMsg]

    sending.value = true
    let cancelled = false
    let readerClosed = false

    const url = `/api/v2/admin/kb/conversations/${currentConversation.value.id}/messages/stream` +
      `?content=${encodeURIComponent(content)}` +
      (temperature !== undefined ? `&temperature=${temperature}` : '') +
      (kbContext ? `&kbContext=${encodeURIComponent(JSON.stringify(kbContext))}` : '') +
      (attachments ? `&attachments=${encodeURIComponent(JSON.stringify(attachments))}` : '')

    const token = localStorage.getItem('admin.access_token')

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then(async (res) => {
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.error('[SSE] HTTP error', res.status, text)
        sending.value = false
        return
      }
      if (!res.body) {
        sending.value = false
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (!cancelled) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          // Parse SSE blocks separated by double newline
          let idx: number
          while ((idx = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 2)

            const lines = block.split('\n')
            let eventName = 'message'
            let dataText = ''
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventName = line.slice(7)
              } else if (line.startsWith('data: ')) {
                dataText = line.slice(6)
              }
            }

            if (eventName === 'data' || eventName === 'message') {
              if (!cancelled) {
                const current = messages.value[assistantIdx]
                if (current?.role === 'assistant') {
                  messages.value = messages.value.map((m, i) =>
                    i === assistantIdx ? { ...m, content: m.content + dataText } : m
                  )
                }
              }
            } else if (eventName === 'done') {
              sending.value = false
              readerClosed = true
              reader.releaseLock()
              if (currentConversation.value?.title === '新对话' && messages.value.length >= 2) {
                const firstUserMsg = messages.value.find(m => m.role === 'user')
                if (firstUserMsg) {
                  const title = firstUserMsg.content.slice(0, 30) + (firstUserMsg.content.length > 30 ? '…' : '')
                  updateConversation(currentConversation.value.id, { title })
                }
              }
              return
            } else if (eventName === 'error') {
              console.error('[SSE] server error:', dataText)
              sending.value = false
            }
          }
        }
      } catch (err) {
        if (!cancelled) console.error('[SSE] read error:', err)
      } finally {
        if (!readerClosed) {
          try { reader.releaseLock() } catch { /* ignore */ }
        }
        sending.value = false
      }
    }).catch((err) => {
      if (!cancelled) {
        console.error('[SSE] fetch error:', err)
        sending.value = false
      }
    })

    return () => {
      cancelled = true
      sending.value = false
    }
  }

  async function uploadAttachment(file: File): Promise<AiAttachment> {
    if (!currentConversation.value) throw new Error('No active conversation')
    return await apiUploadAttachment(currentConversation.value.id, file)
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

  async function regenerateMessage(idx: number): Promise<void> {
    if (!currentConversation.value) throw new Error('No active conversation')
    const msgList = messages.value
    if (idx < 0 || idx >= msgList.length || msgList[idx].role !== 'assistant') {
      throw new Error('Invalid message index')
    }

    sending.value = true
    try {
      const newMsg = await apiRegenerateMessage(currentConversation.value.id, idx)
      // Append new version to history; versions[] stores all prior responses in chronological order
      messages.value = messages.value.map((m, i) => {
        if (i !== idx) return m
        const existingVersions = m.versions || []
        // If first regeneration, archive current content into versions[0]
        const versions = existingVersions.length === 0
          ? [{ content: m.content, provider: m.provider, timestamp: m.timestamp }]
          : existingVersions
        // Push the newly generated response as the latest version
        versions.push({ content: newMsg.content, provider: newMsg.provider, timestamp: newMsg.timestamp })
        return {
          ...m,
          content: newMsg.content,
          provider: newMsg.provider,
          timestamp: newMsg.timestamp,
          versions,
        }
      })
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
    uploadAttachment,
    compareModels,
    regenerateMessage,
    switchConversation,
    clearCurrent,
  }
}
