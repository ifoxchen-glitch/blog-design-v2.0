<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- Filter bar -->
      <PanelCard>
        <div class="flex flex-wrap items-center gap-2">
          <select v-model="logLevel" class="select select-sm bg-base-200/30">
            <option value="">全部级别</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索日志内容..."
            class="input input-sm bg-base-200/30 flex-1 min-w-[200px]"
          />
          <button class="btn btn-sm btn-ghost bg-base-200/30" @click="clearLogs">
            清空
          </button>
        </div>
      </PanelCard>

      <!-- Log stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-info">{{ logCounts.info }}</div>
          <div class="text-xs text-base-content/50 mt-1">Info</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-warning">{{ logCounts.warn }}</div>
          <div class="text-xs text-base-content/50 mt-1">Warn</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums text-error">{{ logCounts.error }}</div>
          <div class="text-xs text-base-content/50 mt-1">Error</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums">{{ logs.length }}</div>
          <div class="text-xs text-base-content/50 mt-1">总计</div>
        </div>
      </div>

      <!-- Log list -->
      <PanelCard title="日志列表">
        <div class="space-y-1 font-mono text-xs max-h-[60vh] overflow-y-auto">
          <div
            v-for="log in filteredLogs"
            :key="log.id"
            :class="[
              'rounded-lg p-2 transition-colors',
              logLevelClass(log.level)
            ]"
          >
            <div class="flex items-start gap-2">
              <span class="shrink-0 text-base-content/40">{{ log.time }}</span>
              <span :class="['shrink-0 uppercase font-semibold', levelTextColor(log.level)]">
                [{{ log.level }}]
              </span>
              <span class="flex-1 break-all">{{ log.message }}</span>
            </div>
          </div>

          <div v-if="filteredLogs.length === 0" class="text-center text-base-content/40 py-8">
            暂无日志
          </div>
        </div>
      </PanelCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'

const logLevel = ref('')
const searchQuery = ref('')

interface Log {
  id: number
  time: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
}

const logs = ref<Log[]>([
  { id: 1, time: '09:15:23', level: 'info', message: '[TCP] 192.168.1.100:52341 --> api.github.com:443' },
  { id: 2, time: '09:15:22', level: 'info', message: '[TCP] 192.168.1.100:52340 --> cdn.apple.com:443' },
  { id: 3, time: '09:15:20', level: 'info', message: '[UDP] 192.168.1.100:52339 --> dns.google:53' },
  { id: 4, time: '09:15:18', level: 'warn', message: '[TCP] connection timeout: api.openai.com:443' },
  { id: 5, time: '09:15:15', level: 'info', message: '[TCP] 192.168.1.100:52338 --> google.com:443' },
  { id: 6, time: '09:15:10', level: 'error', message: '[TCP] connection failed: 192.168.1.100:52337 --> blocked.site:443' },
  { id: 7, time: '09:15:05', level: 'debug', message: '[Rule] DOMAIN-SUFFIX,github.com,PROXY matched' },
  { id: 8, time: '09:15:00', level: 'info', message: '[TCP] 192.168.1.100:52336 --> api.twitter.com:443' },
])

const filteredLogs = computed(() => {
  return logs.value.filter(log => {
    const matchLevel = !logLevel.value || log.level === logLevel.value
    const matchSearch = !searchQuery.value ||
      log.message.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchLevel && matchSearch
  })
})

const logCounts = computed(() => ({
  info: logs.value.filter(l => l.level === 'info').length,
  warn: logs.value.filter(l => l.level === 'warn').length,
  error: logs.value.filter(l => l.level === 'error').length,
}))

const logLevelClass = (level: string) => {
  switch (level) {
    case 'info': return 'bg-info/5'
    case 'warn': return 'bg-warning/10'
    case 'error': return 'bg-error/10'
    case 'debug': return 'bg-base-200/20'
    default: return ''
  }
}

const levelTextColor = (level: string) => {
  switch (level) {
    case 'info': return 'text-info'
    case 'warn': return 'text-warning'
    case 'error': return 'text-error'
    case 'debug': return 'text-base-content/50'
    default: return ''
  }
}

const clearLogs = () => {
  logs.value = []
}

// Simulate new logs
let logId = 9
let timer: ReturnType<typeof setInterval>
const messages = [
  '[TCP] 192.168.1.100:xxxxx --> api.example.com:443',
  '[UDP] 192.168.1.100:xxxxx --> dns.google:53',
  '[Rule] DOMAIN-SUFFIX,example.com,PROXY matched',
]

onMounted(() => {
  timer = setInterval(() => {
    const level = Math.random() > 0.9 ? 'warn' : Math.random() > 0.95 ? 'error' : 'info'
    logs.value.unshift({
      id: logId++,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      level,
      message: messages[Math.floor(Math.random() * messages.length)].replace('xxxxx', String(50000 + Math.floor(Math.random() * 10000))),
    })
    // Keep only last 100 logs
    if (logs.value.length > 100) {
      logs.value.pop()
    }
  }, 2000)
})

onUnmounted(() => clearInterval(timer))
</script>
