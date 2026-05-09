<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- Filter bar -->
      <PanelCard>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="搜索主机或进程..."
            class="input input-sm bg-base-200/30 flex-1 min-w-[200px]"
          />
          <select v-model="filterType" class="select select-sm bg-base-200/30">
            <option value="">全部类型</option>
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
          </select>
          <StatusBadge :status="isConnected ? 'success' : 'error'" :label="isConnected ? '已连接' : '未连接'" />
        </div>
      </PanelCard>

      <!-- Stats -->
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums">{{ connections.length }}</div>
          <div class="text-xs text-base-content/50 mt-1">活跃连接</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums">{{ totalDownload }}</div>
          <div class="text-xs text-base-content/50 mt-1">下载</div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-3 text-center">
          <div class="text-2xl font-extralight tabular-nums">{{ totalUpload }}</div>
          <div class="text-xs text-base-content/50 mt-1">上传</div>
        </div>
      </div>

      <!-- Connection list -->
      <PanelCard title="连接列表">
        <div class="space-y-2">
          <div
            v-for="conn in filteredConnections"
            :key="conn.id"
            class="bg-base-200/20 hover:bg-base-200/40 rounded-lg p-3 transition-colors cursor-pointer"
            @click="selectedConnection = conn"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium truncate">{{ conn.host }}</span>
                  <span class="badge badge-sm bg-base-300/50">{{ conn.type }}</span>
                </div>
                <div class="text-xs text-base-content/50 mt-1 truncate">
                  {{ conn.process }} → {{ conn.chain }}
                </div>
              </div>
              <div class="text-right shrink-0">
                <div class="text-xs text-base-content/60">{{ conn.download }}</div>
                <div class="text-xs text-base-content/40">{{ conn.upload }}</div>
              </div>
            </div>
          </div>

          <div v-if="filteredConnections.length === 0" class="text-center text-base-content/40 py-8">
            暂无连接
          </div>
        </div>
      </PanelCard>

      <!-- Connection detail modal -->
      <dialog :class="['modal', { 'modal-open': selectedConnection }]">
        <div class="modal-box bg-base-200">
          <h3 class="font-bold text-lg mb-4">连接详情</h3>
          <div v-if="selectedConnection" class="space-y-3">
            <InfoRow label="主机" :value="selectedConnection.host" />
            <InfoRow label="类型" :value="selectedConnection.type" />
            <InfoRow label="进程" :value="selectedConnection.process" />
            <InfoRow label="链路" :value="selectedConnection.chain" />
            <InfoRow label="下载" :value="selectedConnection.download" />
            <InfoRow label="上传" :value="selectedConnection.upload" />
            <InfoRow label="开始时间" :value="selectedConnection.startTime" />
          </div>
          <div class="modal-action">
            <button class="btn btn-sm" @click="selectedConnection = null">关闭</button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button @click="selectedConnection = null">close</button>
        </form>
      </dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'
import InfoRow from '@/components/common/InfoRow.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

const searchQuery = ref('')
const filterType = ref('')
const isConnected = ref(true)
const selectedConnection = ref<any>(null)

const connections = ref<any[]>([
  { id: 1, host: 'api.github.com', type: 'TCP', process: 'Chrome', chain: '🇭🇰 香港 → GitHub', download: '2.4 MB', upload: '120 KB', startTime: '09:10:23' },
  { id: 2, host: 'cdn.apple.com', type: 'TCP', process: 'Safari', chain: '🇭🇰 香港 → Apple', download: '15.2 MB', upload: '45 KB', startTime: '09:08:45' },
  { id: 3, host: 'google.com', type: 'TCP', process: 'Chrome', chain: '🇭🇰 香港 → Google', download: '890 KB', upload: '230 KB', startTime: '09:05:12' },
  { id: 4, host: 'api.openai.com', type: 'TCP', process: 'Node', chain: '🇯🇵 日本 → OpenAI', download: '5.6 MB', upload: '340 KB', startTime: '09:02:33' },
  { id: 5, host: 'dns.google', type: 'UDP', process: 'System', chain: 'Direct', download: '12 KB', upload: '8 KB', startTime: '09:00:01' },
])

const filteredConnections = computed(() => {
  return connections.value.filter(conn => {
    const matchSearch = !searchQuery.value ||
      conn.host.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      conn.process.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchType = !filterType.value || conn.type === filterType.value
    return matchSearch && matchType
  })
})

const totalDownload = computed(() => {
  const total = connections.value.reduce((sum, c) => {
    const match = c.download.match(/[\d.]+/)
    return sum + (match ? parseFloat(match[0]) : 0)
  }, 0)
  return total > 1000 ? `${(total / 1000).toFixed(1)} GB` : `${total.toFixed(1)} MB`
})

const totalUpload = computed(() => {
  const total = connections.value.reduce((sum, c) => {
    const match = c.upload.match(/[\d.]+/)
    return sum + (match ? parseFloat(match[0]) : 0)
  }, 0)
  return total > 1000 ? `${(total / 1000).toFixed(1)} MB` : `${total.toFixed(1)} KB`
})

// Simulate new connections
let connId = 6
let timer: ReturnType<typeof setInterval>
const hosts = ['api.twitter.com', 'api.youtube.com', 'discord.com', 'api.slack.com', 'notion.so']
const processes = ['Chrome', 'Safari', 'Electron', 'Node']

onMounted(() => {
  timer = setInterval(() => {
    // Randomly add/remove connections
    if (Math.random() > 0.5 && connections.value.length < 20) {
      connections.value.unshift({
        id: connId++,
        host: hosts[Math.floor(Math.random() * hosts.length)],
        type: Math.random() > 0.2 ? 'TCP' : 'UDP',
        process: processes[Math.floor(Math.random() * processes.length)],
        chain: '🇭🇰 香港 → Direct',
        download: `${(Math.random() * 10).toFixed(1)} MB`,
        upload: `${(Math.random() * 500).toFixed(0)} KB`,
        startTime: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      })
    }
    if (Math.random() > 0.7 && connections.value.length > 3) {
      connections.value.pop()
    }
  }, 3000)
})

onUnmounted(() => clearInterval(timer))
</script>
