<template>
  <div class="h-full overflow-x-hidden overflow-y-auto pb-20 md:pb-3">
    <div class="flex flex-col gap-3 p-3">
      <!-- Real-time traffic stream -->
      <PanelCard title="实时数据流" :default-open="true">
        <div class="space-y-2">
          <div
            v-for="event in liveEvents"
            :key="event.id"
            class="flex items-center gap-3 rounded-lg p-2 transition-all duration-300"
            :class="event.type === 'upload' ? 'bg-primary/10' : event.type === 'download' ? 'bg-success/10' : 'bg-warning/10'"
            style="animation: fadeIn 0.3s ease-out"
          >
            <span class="text-[10px] text-base-content/40 font-mono">{{ event.time }}</span>
            <StatusBadge
              :status="event.type === 'upload' ? 'info' : event.type === 'download' ? 'success' : 'warning'"
              :label="event.type === 'upload' ? '↑' : event.type === 'download' ? '↓' : '⚡'"
            />
            <span class="flex-1 truncate text-sm">{{ event.host }}</span>
            <span class="font-mono tabular-nums text-xs" :class="event.type === 'upload' ? 'text-primary' : 'text-success'">
              {{ event.speed }}
            </span>
          </div>
          
          <div v-if="liveEvents.length === 0" class="text-center text-base-content/40 py-8">
            等待数据流...
          </div>
        </div>
      </PanelCard>

      <!-- Speed gauges -->
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-base-200/30 rounded-xl p-4 text-center">
          <div class="text-xs text-base-content/50 uppercase tracking-wider">实时上传</div>
          <div class="mt-2 text-4xl font-extralight tabular-nums text-primary">{{ uploadSpeed }}</div>
          <div class="text-xs text-base-content/40 mt-1">MB/s</div>
          <!-- Animated bar -->
          <div class="mt-3 h-2 bg-base-200 rounded-full overflow-hidden">
            <div 
              class="h-full bg-primary transition-all duration-300"
              :style="{ width: (uploadPercent) + '%' }"
            />
          </div>
        </div>
        <div class="bg-base-200/30 rounded-xl p-4 text-center">
          <div class="text-xs text-base-content/50 uppercase tracking-wider">实时下载</div>
          <div class="mt-2 text-4xl font-extralight tabular-nums text-success">{{ downloadSpeed }}</div>
          <div class="text-xs text-base-content/40 mt-1">MB/s</div>
          <!-- Animated bar -->
          <div class="mt-3 h-2 bg-base-200 rounded-full overflow-hidden">
            <div 
              class="h-full bg-success transition-all duration-300"
              :style="{ width: (downloadPercent) + '%' }"
            />
          </div>
        </div>
      </div>

      <!-- Bandwidth usage -->
      <CollapseCard title="带宽使用详情" :default-open="true">
        <div class="space-y-3">
          <div v-for="(item, i) in bandwidthItems" :key="i" class="flex items-center gap-3">
            <span class="w-20 text-sm truncate">{{ item.label }}</span>
            <div class="flex-1 h-3 bg-base-200/50 rounded-full overflow-hidden">
              <div 
                class="h-full rounded-full transition-all duration-500"
                :class="item.color"
                :style="{ width: item.percent + '%' }"
              />
            </div>
            <span class="w-16 text-right font-mono text-xs tabular-nums">{{ item.value }}</span>
          </div>
        </div>
      </CollapseCard>

      <!-- Active streams -->
      <PanelCard title="活动数据流" :default-open="true">
        <div class="space-y-2">
          <div
            v-for="stream in activeStreams"
            :key="stream.id"
            class="bg-base-200/20 hover:bg-base-200/40 rounded-lg p-3 transition-colors"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ stream.name }}</span>
                <StatusBadge :status="stream.status === 'active' ? 'success' : 'warning'" :label="stream.status" />
              </div>
              <span class="text-xs text-base-content/50">{{ stream.duration }}</span>
            </div>
            <!-- Stream progress -->
            <div class="h-1.5 bg-base-200 rounded-full overflow-hidden mb-2">
              <div 
                class="h-full rounded-full transition-all duration-300"
                :class="stream.color"
                :style="{ width: stream.progress + '%' }"
              />
            </div>
            <div class="flex justify-between text-xs text-base-content/50">
              <span>↓ {{ stream.download }}</span>
              <span>↑ {{ stream.upload }}</span>
            </div>
          </div>
        </div>
      </PanelCard>

      <!-- Connection events log -->
      <CollapseCard title="连接事件" :default-open="false">
        <div class="space-y-1 font-mono text-xs max-h-48 overflow-y-auto">
          <div
            v-for="evt in connectionEvents"
            :key="evt.id"
            class="flex items-start gap-2 p-1 rounded"
            :class="evt.action === 'connect' ? 'bg-success/5' : 'bg-error/5'"
          >
            <span class="text-base-content/40">{{ evt.time }}</span>
            <span :class="evt.action === 'connect' ? 'text-success' : 'text-error'">
              {{ evt.action === 'connect' ? '●' : '○' }}
            </span>
            <span class="flex-1 break-all">{{ evt.message }}</span>
          </div>
        </div>
      </CollapseCard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import PanelCard from '@/components/common/PanelCard.vue'
import CollapseCard from '@/components/common/CollapseCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

// Live events (data stream)
interface LiveEvent {
  id: number
  time: string
  type: 'upload' | 'download' | 'connect'
  host: string
  speed: string
}

const liveEvents = ref<LiveEvent[]>([])
let eventId = 0

const hosts = [
  'api.github.com',
  'cdn.apple.com',
  'google.com',
  'api.openai.com',
  'cdn.jsdelivr.net',
  'raw.githubusercontent.com',
  'fonts.googleapis.com',
  'www.gstatic.com',
]

// Speed simulation
const uploadSpeed = ref('0.0')
const downloadSpeed = ref('0.0')
const uploadPercent = ref(0)
const downloadPercent = ref(0)

// Bandwidth items
const bandwidthItems = ref([
  { label: '视频流', value: '45.2 MB/s', percent: 75, color: 'bg-primary' },
  { label: '下载', value: '28.6 MB/s', percent: 48, color: 'bg-success' },
  { label: '网页', value: '12.3 MB/s', percent: 20, color: 'bg-warning' },
  { label: '其他', value: '5.8 MB/s', percent: 10, color: 'bg-secondary' },
])

// Active streams
const activeStreams = ref([
  { id: 1, name: 'Chrome - YouTube', status: 'active', progress: 65, download: '45.2 MB/s', upload: '1.2 MB/s', duration: '12:34', color: 'bg-primary' },
  { id: 2, name: 'Node - npm install', status: 'active', progress: 32, download: '28.6 MB/s', upload: '0.3 MB/s', duration: '02:15', color: 'bg-success' },
  { id: 3, name: 'Safari - 网页浏览', status: 'active', progress: 88, download: '12.3 MB/s', upload: '0.8 MB/s', duration: '00:45', color: 'bg-warning' },
])

// Connection events
interface ConnEvent {
  id: number
  time: string
  action: 'connect' | 'disconnect'
  message: string
}

const connectionEvents = ref<ConnEvent[]>([])
let connId = 0

// Main timer
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  // Update every 500ms for smooth streaming
  timer = setInterval(() => {
    const now = new Date()
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
    
    // Generate upload/download events
    if (Math.random() > 0.3) {
      const isDownload = Math.random() > 0.4
      const speed = (Math.random() * 50 + 1).toFixed(1)
      
      liveEvents.value.unshift({
        id: eventId++,
        time: timeStr,
        type: isDownload ? 'download' : 'upload',
        host: hosts[Math.floor(Math.random() * hosts.length)],
        speed: `${speed} MB/s`,
      })
      
      // Keep only last 20 events
      if (liveEvents.value.length > 20) {
        liveEvents.value.pop()
      }
    }
    
    // Update speeds
    uploadSpeed.value = (Math.random() * 30 + 2).toFixed(1)
    downloadSpeed.value = (Math.random() * 80 + 10).toFixed(1)
    uploadPercent.value = Math.min(100, parseFloat(uploadSpeed.value) / 40 * 100)
    downloadPercent.value = Math.min(100, parseFloat(downloadSpeed.value) / 100 * 100)
    
    // Update bandwidth items with fluctuation
    bandwidthItems.value = bandwidthItems.value.map(item => ({
      ...item,
      percent: Math.max(5, Math.min(100, item.percent + (Math.random() - 0.5) * 10)),
      value: `${(Math.random() * 50 + 5).toFixed(1)} MB/s`,
    }))
    
    // Update stream progress
    activeStreams.value = activeStreams.value.map(stream => ({
      ...stream,
      progress: Math.min(100, stream.progress + (Math.random() * 5)),
      download: `${(Math.random() * 50 + 10).toFixed(1)} MB/s`,
      upload: `${(Math.random() * 5 + 0.1).toFixed(1)} MB/s`,
    }))
    
    // Random connection events
    if (Math.random() > 0.8) {
      const action = Math.random() > 0.3 ? 'connect' : 'disconnect'
      connectionEvents.value.unshift({
        id: connId++,
        time: timeStr,
        action,
        message: `${hosts[Math.floor(Math.random() * hosts.length)]} ${action === 'connect' ? '已连接' : '已断开'}`,
      })
      
      if (connectionEvents.value.length > 30) {
        connectionEvents.value.pop()
      }
    }
  }, 500)
})

onUnmounted(() => clearInterval(timer))
</script>

<style scoped>
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
