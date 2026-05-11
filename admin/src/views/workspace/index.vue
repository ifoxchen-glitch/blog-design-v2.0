<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { NButton, NCard } from 'naive-ui'
import {
  ChatbubblesOutline, BookOutline, ShapesOutline, BarChartOutline,
  CreateOutline, SparklesOutline,
} from '@vicons/ionicons5'
import PageHeader from '../../components/common/PageHeader.vue'
import { apiListAiConversations, apiListKbTasks, type AiConversation } from '../../api/kb'

const router = useRouter()

const recentConversations = ref<AiConversation[]>([])
const taskStats = ref({ todo: 0, in_progress: 0, done: 0 })
const notes = ref<{ id: string; text: string; done: boolean }[]>([])
const newNoteText = ref('')
const loadingConv = ref(false)
const loadingTasks = ref(false)
const noteInputRef = ref()

const QUICK_ENTRIES = [
  { label: 'AI 对话', icon: ChatbubblesOutline, route: '/cms/workspace/chat', color: 'bg-primary/10 text-primary', desc: '与 AI 模型对话' },
  { label: '知识库文档', icon: BookOutline, route: '/cms/kb/documents', color: 'bg-blue-50 text-blue-500', desc: '浏览知识库文档' },
  { label: '画布编辑器', icon: ShapesOutline, route: '/cms/kb/canvases', color: 'bg-purple-50 text-purple-500', desc: '思维导图画布' },
  { label: '看板工作室', icon: BarChartOutline, route: '/cms/kanban', color: 'bg-amber-50 text-amber-500', desc: '任务看板管理' },
  { label: 'AI 模型配置', icon: SparklesOutline, route: '/cms/ai-settings', color: 'bg-green-50 text-green-500', desc: '配置 AI 模型' },
  { label: '快捷笔记', icon: CreateOutline, route: '#quick-note', color: 'bg-orange-50 text-orange-500', desc: '快速记录想法' },
]

function loadNotes() {
  try {
    const raw = localStorage.getItem('kb-quick-notes')
    if (raw) notes.value = JSON.parse(raw)
  } catch { notes.value = [] }
}

function saveNotes() {
  localStorage.setItem('kb-quick-notes', JSON.stringify(notes.value.slice(0, 10)))
}

function addNote(text: string) {
  if (!text.trim()) return
  notes.value.unshift({ id: Date.now().toString(36), text: text.trim(), done: false })
  saveNotes()
}

function toggleNote(id: string) {
  const n = notes.value.find(n => n.id === id)
  if (n) { n.done = !n.done; saveNotes() }
}

function deleteNote(id: string) {
  notes.value = notes.value.filter(n => n.id !== id)
  saveNotes()
}

async function loadRecentConversations() {
  loadingConv.value = true
  try {
    const res = await apiListAiConversations({ limit: 3 })
    recentConversations.value = res.items
  } catch { /* silent */ }
  finally { loadingConv.value = false }
}

async function loadTaskStats() {
  loadingTasks.value = true
  try {
    const tasks = await apiListKbTasks()
    taskStats.value = {
      todo: tasks.filter(t => t.status === 'todo').length,
      in_progress: tasks.filter(t => t.status === 'in_progress').length,
      done: tasks.filter(t => t.status === 'done').length,
    }
  } catch { /* silent */ }
  finally { loadingTasks.value = false }
}

onMounted(() => {
  loadNotes()
  loadRecentConversations()
  loadTaskStats()
})
</script>

<template>
  <div>
    <PageHeader title="工作台" subtitle="快捷入口与工作概览" />

    <!-- Quick entries -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
      <div
        v-for="entry in QUICK_ENTRIES"
        :key="entry.label"
        class="flex flex-col items-center gap-2 p-4 rounded-xl border border-base-content/5 hover:border-primary/30 hover:bg-base-100 cursor-pointer transition-all group"
        @click="entry.route === '#quick-note' ? noteInputRef?.focus() : router.push(entry.route)"
      >
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-xl" :class="entry.color">
          <component :is="entry.icon" class="w-5 h-5" />
        </div>
        <div class="text-xs font-medium text-center">{{ entry.label }}</div>
        <div class="text-[10px] text-base-content/40 text-center">{{ entry.desc }}</div>
      </div>
    </div>

    <!-- Stats + Quick notes row -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <!-- AI 对话最近 -->
      <NCard size="small" class="bg-base-100">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <ChatbubblesOutline class="w-4 h-4 text-primary" />
              <span class="text-sm font-medium">最近 AI 对话</span>
            </div>
            <NButton size="tiny" quaternary @click="router.push('/cms/workspace/chat')">
              全部 →
            </NButton>
          </div>
        </template>
        <div v-if="recentConversations.length === 0" class="text-xs text-base-content/30 py-4 text-center">
          暂无对话记录
        </div>
        <div v-for="conv in recentConversations" :key="conv.id" class="py-1.5 border-b border-base-content/5 last:border-0">
          <div
            class="text-xs truncate cursor-pointer hover:text-primary"
            @click="router.push(`/cms/workspace/chat/${conv.id}`)"
          >{{ conv.title }}</div>
          <div class="text-[10px] text-base-content/30">{{ conv.model }} · {{ conv.message_count }}条</div>
        </div>
      </NCard>

      <!-- 看板统计 -->
      <NCard size="small" class="bg-base-100">
        <template #header>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <BarChartOutline class="w-4 h-4 text-amber-500" />
              <span class="text-sm font-medium">看板概览</span>
            </div>
            <NButton size="tiny" quaternary @click="router.push('/cms/kanban')">
              去看板 →
            </NButton>
          </div>
        </template>
        <div class="flex gap-4">
          <div class="text-center flex-1">
            <div class="text-xl font-bold text-base-content/70">{{ taskStats.todo }}</div>
            <div class="text-[10px] text-base-content/40">待办</div>
          </div>
          <div class="text-center flex-1 border-l border-base-content/5">
            <div class="text-xl font-bold text-blue-500">{{ taskStats.in_progress }}</div>
            <div class="text-[10px] text-base-content/40">进行中</div>
          </div>
          <div class="text-center flex-1 border-l border-base-content/5">
            <div class="text-xl font-bold text-green-500">{{ taskStats.done }}</div>
            <div class="text-[10px] text-base-content/40">已完成</div>
          </div>
        </div>
      </NCard>
    </div>

    <!-- 快捷笔记 -->
    <NCard size="small" class="bg-base-100">
      <template #header>
        <div class="flex items-center gap-2">
          <CreateOutline class="w-4 h-4 text-orange-500" />
          <span class="text-sm font-medium">快捷笔记</span>
        </div>
      </template>

      <!-- Add note input -->
      <div class="flex gap-2 mb-3">
const noteInputRef = ref()
        <NInput
          ref="noteInputRef"
          v-model:value="newNoteText"
          size="small"
          placeholder="快速记录…"
          @keydown.enter.prevent="addNote(newNoteText); newNoteText = ''"
        />
        <NButton size="small" @click="addNote(newNoteText); newNoteText = ''">
          <AddOutline class="w-3.5 h-3.5" />
        </NButton>
      </div>
      <p v-if="notes.length === 0" class="text-xs text-base-content/30">暂无笔记</p>

      <div class="space-y-1">
        <div
          v-for="note in notes.slice(0, 5)"
          :key="note.id"
          class="flex items-center gap-2 py-1 px-2 rounded hover:bg-base-200/50 group"
        >
          <input
            type="checkbox"
            :checked="note.done"
            class="checkbox checkbox-xs"
            @change="toggleNote(note.id)"
          />
          <span
            class="text-xs flex-1"
            :class="note.done ? 'line-through text-base-content/30' : 'text-base-content/70'"
          >{{ note.text }}</span>
          <button
            class="text-base-content/20 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            @click="deleteNote(note.id)"
          >×</button>
        </div>
      </div>
    </NCard>
  </div>
</template>
